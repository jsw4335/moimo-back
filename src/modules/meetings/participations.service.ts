import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ParticipationsService {
  constructor(private prisma: PrismaService) {}
  async createParticipation(meetingId: number, userId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { hostId: true, meetingDate: true },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
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

    const existingParticipation = await this.prisma.participation.findUnique({
      where: { userIdMeetingId: { userId, meetingId } },
    });

    if (existingParticipation) {
      throw new BadRequestException('이미 참여 신청을 한 모임입니다.');
    }

    await this.prisma.$transaction([
      this.prisma.participation.create({
        data: { meetingId, userId, status: 'PENDING' },
      }),
      this.prisma.notification.create({
        data: {
          meetingId,
          receiverId: meeting.hostId,
          senderId: userId,
          type: 'PARTICIPATION_REQUEST',
        },
      }),
    ]);

    return { status: 'PENDING' };
  }

  async findApplicants(meetingId: number, userId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { hostId: true },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
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
            image: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return participations.map((p) => ({
      participationId: p.id,
      nickname: p.user.nickname,
      profileImage: p.user.image,
      bio: p.user.bio,
      status: p.status,
    }));
  }
}
