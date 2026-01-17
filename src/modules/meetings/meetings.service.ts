import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import {
  MeetingPageOptionsDto,
  MeetingSort,
} from './dto/meeting-page-options.dto';
import { NotificationType, ParticipationStatus, Prisma } from '@prisma/client';
import axios from 'axios';
import { PageDto } from '../common/dto/page.dto';
import { PageMetaDto } from '../common/dto/page-meta.dto';
import { MeetingItemDto, MyMeetingDto } from './dto/meeting-item.dto';
import { UploadService } from '../upload/upload.service';

interface KakaoAddressDocument {
  x: string;
  y: string;
  address_name: string;
}

interface KakaoAddressResponse {
  documents: KakaoAddressDocument[];
}

@Injectable()
export class MeetingsService {
  constructor(
    private prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async create(
    dto: CreateMeetingDto,
    hostId: number,
    file?: Express.Multer.File,
  ) {
    let latitude: number;
    let longitude: number;
    let imageUrl: string | null = null;

    if (file) {
      try {
        imageUrl = await this.uploadService.uploadFile('meeting', file);
      } catch {
        throw new InternalServerErrorException(
          '이미지 업로드 중 오류가 발생했습니다.',
        );
      }
    }

    try {
      const kakaoResponse = await axios.get<KakaoAddressResponse>(
        'https://dapi.kakao.com/v2/local/search/address.json',
        {
          params: { query: dto.address },
          headers: {
            Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
          },
        },
      );

      const document = kakaoResponse.data.documents[0];
      if (!document) {
        throw new BadRequestException(
          '입력하신 주소를 찾을 수 없습니다. 도로명 주소를 정확히 입력해 주세요.',
        );
      }

      longitude = parseFloat(document.x);
      latitude = parseFloat(document.y);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        '카카오 주소 변환 중 오류가 발생했습니다.',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: {
          title: dto.title,
          description: dto.description,
          maxParticipants: Number(dto.maxParticipants),
          meetingDate: new Date(dto.meetingDate),
          interestId: Number(dto.interestId),
          address: dto.address,
          latitude: latitude,
          longitude: longitude,
          image: imageUrl,
          hostId: hostId,
          currentParticipants: 1,
        },
      });

      await tx.participation.create({
        data: {
          meetingId: meeting.id,
          userId: hostId,
          status: 'ACCEPTED',
        },
      });

      return meeting;
    });
  }

  async findAll(dto: MeetingPageOptionsDto): Promise<PageDto<MeetingItemDto>> {
    const {
      page = 1,
      limit = 10,
      sort = MeetingSort.NEW,
      interestFilter = 'ALL',
      finishedFilter = false,
    } = dto;

    const skip = (page - 1) * limit;
    const where: Prisma.MeetingWhereInput = {};

    where.meetingDeleted = false;

    if (!finishedFilter) {
      where.meetingDate = { gte: new Date() };
    }

    if (interestFilter && interestFilter !== 'ALL') {
      where.interestId = Number(interestFilter);
    }

    let orderBy: Prisma.MeetingOrderByWithRelationInput;

    switch (sort) {
      case MeetingSort.UPDATE:
        orderBy = { updatedAt: 'desc' };
        break;
      case MeetingSort.DEADLINE:
        orderBy = { meetingDate: 'asc' };
        break;
      case MeetingSort.NEW:
      default:
        orderBy = { createdAt: 'desc' };
    }

    try {
      const [totalCount, meetings] = await Promise.all([
        this.prisma.meeting.count({ where }),
        this.prisma.meeting.findMany({
          where,
          skip: skip,
          take: limit,
          orderBy: orderBy,
          include: {
            interest: { select: { name: true } },
          },
        }),
      ]);

      const mappedData: MeetingItemDto[] = meetings.map((meeting) => ({
        meetingId: meeting.id,
        title: meeting.title,
        meetingImage: meeting.image,
        interestName: meeting.interest.name,
        maxParticipants: meeting.maxParticipants,
        currentParticipants: meeting.currentParticipants,
        address: meeting.address,
        meetingDate: meeting.meetingDate,
      }));

      return new PageDto(mappedData, new PageMetaDto(totalCount, page, limit));
    } catch {
      throw new InternalServerErrorException(
        '모임 목록을 가져오는 중 오류가 발생했습니다.',
      );
    }
  }

  async findOne(id: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: {
        host: {
          select: {
            nickname: true,
            bio: true,
            image: true,
          },
        },
        interest: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    if (meeting.meetingDeleted) {
      throw new GoneException('삭제된 모임입니다.');
    }

    return {
      id: meeting.id,
      title: meeting.title,
      meetingImage: meeting.image,
      description: meeting.description,
      interestId: meeting.interestId,
      maxParticipants: meeting.maxParticipants,
      currentParticipants: meeting.currentParticipants,
      meetingDate: meeting.meetingDate,
      location: {
        address: meeting.address,
        lat: meeting.latitude,
        lng: meeting.longitude,
      },
      host: {
        hostId: meeting.hostId,
        nickname: meeting.host.nickname,
        bio: meeting.host.bio || '',
        hostImage: meeting.host.image,
      },
    };
  }

  async getMyMeetings(
    userId: number,
    statusQuery: string = 'all',
    viewQuery: string = 'all',
    dto: MeetingPageOptionsDto,
  ): Promise<PageDto<MyMeetingDto>> {
    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;
    const now = new Date();

    const conditions: Prisma.MeetingWhereInput[] = [{ meetingDeleted: false }];
    if (viewQuery === 'hosted') {
      conditions.push({ hostId: userId });
    } else if (viewQuery === 'joined') {
      conditions.push({
        hostId: { not: userId },
        participations: { some: { userId } },
      });
    } else {
      conditions.push({ participations: { some: { userId } } });
    }

    if (statusQuery === 'pending') {
      conditions.push({
        participations: { some: { userId, status: 'PENDING' } },
      });
    } else if (statusQuery === 'accepted') {
      conditions.push({ meetingDate: { gte: now } });
      conditions.push({
        participations: { some: { userId, status: 'ACCEPTED' } },
      });
    } else if (statusQuery === 'completed') {
      conditions.push({ meetingDate: { lt: now } });
      conditions.push({
        participations: { some: { userId, status: 'ACCEPTED' } },
      });
    }

    const where: Prisma.MeetingWhereInput = { AND: conditions };

    try {
      const [totalCount, meetings] = await Promise.all([
        this.prisma.meeting.count({ where }),
        this.prisma.meeting.findMany({
          where,
          skip,
          take: limit,
          include: {
            interest: { select: { name: true } },
            participations: {
              where: { userId: userId },
              select: { status: true },
            },
          },
          orderBy: { meetingDate: 'desc' },
        }),
      ]);

      const mappedData: MyMeetingDto[] = meetings.map((m) => {
        const isHost = m.hostId === userId;
        const isCompleted = m.meetingDate < now;
        const myStatus = isHost
          ? 'ACCEPTED'
          : m.participations[0]?.status || 'PENDING';

        return {
          meetingId: m.id,
          title: m.title,
          interestName: m.interest.name,
          maxParticipants: m.maxParticipants,
          currentParticipants: m.currentParticipants,
          address: m.address,
          meetingDate: m.meetingDate,
          status: myStatus,
          isHost: isHost,
          isCompleted: isCompleted,
        };
      });

      return new PageDto(mappedData, new PageMetaDto(totalCount, page, limit));
    } catch {
      throw new InternalServerErrorException(
        '내 모임 목록을 가져오는 중 오류가 발생했습니다.',
      );
    }
  }

  async softDelete(meetingId: number, userId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participations: {
          where: {
            status: ParticipationStatus.ACCEPTED,
          },
          select: { userId: true },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    if (meeting.hostId !== userId) {
      throw new ForbiddenException('모임 주최자만 삭제할 수 있습니다.');
    }

    const now = new Date();
    if (meeting.meetingDate < now) {
      throw new BadRequestException('이미 종료된 모임은 삭제할 수 없습니다.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.meeting.update({
          where: { id: meetingId },
          data: { meetingDeleted: true },
        });

        const notifications = meeting.participations.map((p) => ({
          receiverId: p.userId,
          senderId: userId,
          meetingId: meetingId,
          type: NotificationType.MEETING_DELETED,
        }));

        if (notifications.length > 0) {
          await tx.notification.createMany({
            data: notifications,
          });
        }
      });
    } catch {
      throw new InternalServerErrorException(
        '모임 삭제 및 알림 처리 중 오류가 발생했습니다.',
      );
    }
  }

  async searchMeetings(keyword: string) {
    if (!keyword || keyword.trim() === '') {
      throw new BadRequestException('검색어를 입력해주세요.');
    }

    const now = new Date();

    const meetings = await this.prisma.meeting.findMany({
      where: {
        meetingDeleted: false,
        meetingDate: {
          gte: now,
        },
        OR: [
          {
            title: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
          {
            interest: {
              name: {
                contains: keyword,
                mode: 'insensitive',
              },
            },
          },
          {
            host: {
              nickname: {
                contains: keyword,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
      include: {
        interest: true,
        host: {
          select: {
            nickname: true,
          },
        },
      },
      orderBy: {
        meetingDate: 'asc',
      },
    });

    return meetings.map((m) => ({
      id: m.id,
      title: m.title,
      meetingImage: m.image,
      interestName: m.interest.name,
      currentParticipants: m.currentParticipants,
      maxParticipants: m.maxParticipants,
      meetingDate: m.meetingDate,
      address: m.address,
      hostNickname: m.host.nickname,
    }));
  }
}
