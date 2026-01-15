import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  GoneException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Participation,
  ParticipationStatus,
  NotificationType,
} from '@prisma/client';
import { ParticipationUpdateItem } from './dto/update-participation.dto';

@Injectable()
export class ParticipationsService {
  constructor(private prisma: PrismaService) {}

  async createParticipation(meetingId: number, userId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        hostId: true,
        meetingDate: true,
        maxParticipants: true,
        currentParticipants: true,
        meetingDeleted: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    if (meeting.meetingDeleted) {
      throw new GoneException('삭제된 모임에는 신청할 수 없습니다.');
    }

    if (new Date(meeting.meetingDate) < new Date()) {
      throw new BadRequestException(
        '이미 기한이 지난 모임은 신청할 수 없습니다.',
      );
    }

    if (meeting.hostId === userId) {
      throw new BadRequestException(
        '호스트는 본인의 모임에 참여 신청을 할 수 없습니다.',
      );
    }

    if (meeting.currentParticipants >= meeting.maxParticipants) {
      throw new BadRequestException(
        `이미 정원이 꽉 찬 모임입니다. (최대 ${meeting.maxParticipants}명)`,
      );
    }

    const existingParticipation = await this.prisma.participation.findUnique({
      where: { userIdMeetingId: { userId, meetingId } },
    });

    if (existingParticipation) {
      throw new ConflictException('이미 참여 신청을 한 모임입니다.');
    }

    await this.prisma.$transaction([
      this.prisma.participation.create({
        data: { meetingId, userId, status: ParticipationStatus.PENDING },
      }),
      this.prisma.notification.create({
        data: {
          meetingId,
          receiverId: meeting.hostId,
          senderId: userId,
          type: NotificationType.PARTICIPATION_REQUEST,
        },
      }),
    ]);

    return { status: ParticipationStatus.PENDING };
  }

  async findApplicants(meetingId: number, userId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { hostId: true, meetingDeleted: true },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    if (meeting.meetingDeleted) {
      throw new GoneException('삭제된 모임입니다.');
    }

    if (meeting.hostId !== userId) {
      throw new ForbiddenException(
        '호스트만 신청자 목록을 조회할 수 있습니다.',
      );
    }

    const participations = await this.prisma.participation.findMany({
      where: { meetingId },
      include: {
        user: {
          select: {
            nickname: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return participations.map((p) => ({
      participationId: p.id,
      nickname: p.user.nickname,
      bio: p.user.bio,
      status: p.status,
    }));
  }

  async updateStatuses(
    meetingId: number,
    userId: number,
    updates: ParticipationUpdateItem[],
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.findUnique({
        where: { id: meetingId },
        select: {
          hostId: true,
          maxParticipants: true,
          currentParticipants: true,
          meetingDeleted: true,
        },
      });

      if (!meeting) throw new NotFoundException('모임을 찾을 수 없습니다.');
      if (meeting.meetingDeleted) {
        throw new GoneException(
          '삭제된 모임입니다. 상태를 변경할 수 없습니다.',
        );
      }
      if (meeting.hostId !== userId) {
        throw new ForbiddenException(
          '호스트만 신청 상태를 변경할 수 있습니다.',
        );
      }

      let tempAcceptedCount = meeting.currentParticipants;
      const results: Participation[] = [];

      for (const update of updates) {
        const currentParticipation = await tx.participation.findUnique({
          where: { id: update.participationId },
        });

        if (
          !currentParticipation ||
          currentParticipation.status === update.status
        )
          continue;

        if (update.status === ParticipationStatus.ACCEPTED) {
          if (tempAcceptedCount >= meeting.maxParticipants) {
            throw new BadRequestException(
              `정원이 초과되었습니다. (최대 ${meeting.maxParticipants}명)`,
            );
          }

          tempAcceptedCount++;
          await tx.meeting.update({
            where: { id: meetingId },
            data: { currentParticipants: { increment: 1 } },
          });
        } else if (
          currentParticipation.status === ParticipationStatus.ACCEPTED
        ) {
          tempAcceptedCount--;
          await tx.meeting.update({
            where: { id: meetingId },
            data: { currentParticipants: { decrement: 1 } },
          });
        }

        const updatedParticipation = await tx.participation.update({
          where: {
            id: update.participationId,
            meetingId: meetingId,
          },
          data: { status: update.status },
        });

        await tx.notification.updateMany({
          where: {
            meetingId: meetingId,
            receiverId: userId,
            senderId: updatedParticipation.userId,
            type: NotificationType.PARTICIPATION_REQUEST,
            isRead: false,
          },
          data: { isRead: true },
        });

        if (update.status !== ParticipationStatus.PENDING) {
          await tx.notification.create({
            data: {
              meetingId: meetingId,
              receiverId: updatedParticipation.userId,
              senderId: userId,
              type:
                update.status === ParticipationStatus.ACCEPTED
                  ? NotificationType.PARTICIPATION_ACCEPTED
                  : NotificationType.PARTICIPATION_REJECTED,
              isRead: false,
            },
          });
        }

        results.push(updatedParticipation);
      }

      return results;
    });
  }

  async deleteParticipation(
    meetingId: number,
    participationId: number,
    userId: number,
  ) {
    const participation = await this.prisma.participation.findUnique({
      where: { id: participationId },
      include: { meeting: true },
    });

    if (!participation || participation.meetingId !== meetingId) {
      throw new NotFoundException('참여 정보를 찾을 수 없습니다.');
    }

    if (participation.meeting.meetingDeleted) {
      throw new GoneException('삭제된 모임의 참여 정보는 변경할 수 없습니다.');
    }

    const isHost = participation.meeting.hostId === userId;
    const isParticipant = participation.userId === userId;

    if (isHost && participation.userId === userId) {
      throw new BadRequestException(
        '호스트는 참여 명단에서 본인을 삭제할 수 없습니다.',
      );
    }

    if (!isHost && !isParticipant) {
      throw new ForbiddenException('권한이 없습니다.');
    }

    return await this.prisma.$transaction(async (tx) => {
      if (participation.status === ParticipationStatus.ACCEPTED) {
        await tx.meeting.update({
          where: { id: meetingId },
          data: { currentParticipants: { decrement: 1 } },
        });
      }

      await tx.participation.delete({
        where: { id: participationId },
      });

      if (isParticipant) {
        await tx.notification.deleteMany({
          where: {
            meetingId,
            senderId: userId,
            receiverId: participation.meeting.hostId,
            type: NotificationType.PARTICIPATION_REQUEST,
          },
        });
      } else if (isHost) {
        await tx.notification.create({
          data: {
            meetingId,
            receiverId: participation.userId,
            senderId: userId,
            type: NotificationType.PARTICIPATION_REJECTED,
            isRead: false,
          },
        });

        await tx.notification.deleteMany({
          where: {
            meetingId,
            senderId: participation.userId,
            receiverId: userId,
            type: NotificationType.PARTICIPATION_REQUEST,
          },
        });
      }

      return;
    });
  }
}
