import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';

@Injectable()
export class MeetingsService {
  constructor(private prisma: PrismaService) {}

  // hostId는 나중에 Guard를 통해 유저 정보에서 받아와야 합니다.
  async create(dto: CreateMeetingDto, hostId: number) {
    return this.prisma.meeting.create({
      data: {
        title: dto.title,
        description: dto.description,
        maxParticipants: dto.maxParticipants,
        meetingDate: new Date(dto.meetingDate),
        latitude: dto.latitude,
        longitude: dto.longitude,
        host: { connect: { id: hostId } },
        // 관계 설정
        // N:M 관계 생성 로직
        meetingInterests: {
          create: dto.interestIds.map((id) => ({
            interest: { connect: { id: id } },
          })),
        },
      },
    });
  }

  // 2. 누락된 findAll 메서드 추가
  async findAll() {
    return this.prisma.meeting.findMany({
      include: {
        host: true, // 방장 정보 포함
        meetingInterests: {
          include: {
            interest: true, // 중간 테이블을 거쳐 실제 관심사 정보를 가져옴
          },
        },
      },
    });
  }
}
