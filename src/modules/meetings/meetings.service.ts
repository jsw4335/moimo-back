import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import {
  MeetingPageOptionsDto,
  MeetingSort,
} from './dto/meeting-page-options.dto';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PageDto } from '../common/dto/page.dto';
import { PageMetaDto } from '../common/dto/page-meta.dto';
import { MeetingItemDto, MyMeetingDto } from './dto/meeting-item.dto';

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
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMeetingDto, hostId: number) {
    let latitude: number;
    let longitude: number;

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

    await this.prisma.meeting.create({
      data: {
        title: dto.title,
        description: dto.description,
        maxParticipants: dto.maxParticipants,
        meetingDate: new Date(dto.meetingDate),
        interestId: dto.interestId,
        address: dto.address,
        latitude: latitude,
        longitude: longitude,
        hostId: hostId,
      },
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
            _count: {
              select: { participations: { where: { status: 'ACCEPTED' } } },
            },
            interest: { select: { name: true } },
          },
        }),
      ]);

      const mappedData: MeetingItemDto[] = meetings.map((meeting) => ({
        meetingId: meeting.id,
        title: meeting.title,
        interestName: meeting.interest.name,
        maxParticipants: meeting.maxParticipants,
        currentParticipants: meeting._count.participations,
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
          },
        },
        interest: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    return {
      id: meeting.id,
      title: meeting.title,
      description: meeting.description,
      interestName: meeting.interest.name,
      maxParticipants: meeting.maxParticipants,

      meetingDate: meeting.meetingDate,
      location: {
        address: meeting.address,
        lat: meeting.latitude,
        lng: meeting.longitude,
      },
      host: {
        nickname: meeting.host.nickname,
        bio: meeting.host.bio || '',
      },
    };
  }

  async getMyMeetings(
    userId: number,
    statusQuery: string = 'all',
    dto: MeetingPageOptionsDto,
  ): Promise<PageDto<MyMeetingDto>> {
    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;
    const now = new Date();

    let where: Prisma.MeetingWhereInput = {
      OR: [
        { hostId: userId },
        { participations: { some: { userId: userId } } },
      ],
    };

    if (statusQuery === 'pending') {
      where = {
        participations: {
          some: { userId: userId, status: 'PENDING' },
        },
      };
    } else if (statusQuery === 'accepted') {
      where = {
        meetingDate: { gte: now },
        OR: [
          { hostId: userId },
          { participations: { some: { userId: userId, status: 'ACCEPTED' } } },
        ],
      };
    } else if (statusQuery === 'completed') {
      where = {
        meetingDate: { lt: now },
        OR: [
          { hostId: userId },
          { participations: { some: { userId: userId, status: 'ACCEPTED' } } },
        ],
      };
    }
    try {
      const [totalCount, meetings] = await Promise.all([
        this.prisma.meeting.count({ where }),
        this.prisma.meeting.findMany({
          where,
          skip,
          take: limit,
          include: {
            _count: {
              select: { participations: { where: { status: 'ACCEPTED' } } },
            },
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
          currentParticipants: m._count.participations,
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
}
