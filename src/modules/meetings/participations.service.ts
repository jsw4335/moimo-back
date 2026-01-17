import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  GoneException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ParticipationStatus, NotificationType, Prisma } from '@prisma/client';

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

    return;
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
      where: { meetingId, userId: { not: meeting.hostId } },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            bio: true,
            image: true,
            interests: {
              select: {
                interest: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return participations.map((p) => ({
      participationId: p.id,
      userId: p.user.id,
      nickname: p.user.nickname,
      bio: p.user.bio,
      profileImage: p.user.image,
      status: p.status,
      interests: p.user.interests.map((ui) => ({
        id: ui.interest.id,
        name: ui.interest.name,
      })),
    }));
  }

  async approveOne(
    meetingId: number,
    hostId: number,
    pId: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. 호스트 권한 및 모임 정보 확인
      const meeting = await tx.meeting.findUnique({
        where: { id: meetingId },
      });

      if (!meeting) throw new NotFoundException('모임을 찾을 수 없습니다.');
      if (meeting.hostId !== hostId) {
        throw new ForbiddenException('호스트만 승인할 수 있습니다.');
      }

      // 2. 정원 체크 (meeting이 Meeting 타입으로 추론되어 에러가 나지 않습니다.)
      if (meeting.currentParticipants >= meeting.maxParticipants) {
        throw new BadRequestException(
          `정원이 초과되었습니다. (최대 ${meeting.maxParticipants}명)`,
        );
      }

      // 3. 신청서 상태 확인
      const participation = await tx.participation.findUnique({
        where: { id: pId },
      });

      if (
        !participation ||
        participation.status !== ParticipationStatus.PENDING
      ) {
        throw new BadRequestException('승인 대기 중인 신청자가 아닙니다.');
      }

      // 4. 상태 업데이트 (ACCEPTED)
      await tx.participation.update({
        where: { id: pId },
        data: { status: ParticipationStatus.ACCEPTED },
      });

      // 5. 모임 현재 인원수 증가 (+1)
      await tx.meeting.update({
        where: { id: meetingId },
        data: { currentParticipants: { increment: 1 } },
      });

      // 6. 알림 처리
      // 호스트가 받았던 '참여 신청' 알림을 읽음 처리합니다.
      await tx.notification.updateMany({
        where: {
          meetingId,
          receiverId: hostId,
          senderId: participation.userId,
          type: NotificationType.PARTICIPATION_REQUEST,
          isRead: false,
        },
        data: { isRead: true },
      });

      // 참여자에게 '승인됨' 알림을 보냅니다.
      await tx.notification.create({
        data: {
          meetingId,
          receiverId: participation.userId,
          senderId: hostId,
          type: NotificationType.PARTICIPATION_ACCEPTED,
          isRead: false,
        },
      });

      // 반환값 없이 트랜잭션 종료
      return;
    });
  }
}
