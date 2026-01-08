import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { PageOptionsDto } from './dto/page-options.dto';
import axios from 'axios';

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

  // hostId는 나중에 Guard를 통해 유저 정보에서 받아와야 합니다.
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
        address: dto.address,
        latitude: latitude,
        longitude: longitude,
        host: { connect: { id: hostId } },

        meetingInterests: {
          create: dto.interestIds.map((id) => ({
            interest: { connect: { id: id } },
          })),
        },
      },
    });
  }

  async findAll(dto: PageOptionsDto) {
    const { page = 1, limit = 10 } = dto;

    const skip = (page - 1) * limit;

    try {
      const [totalCount, meetings] = await Promise.all([
        this.prisma.meeting.count(),
        this.prisma.meeting.findMany({
          skip: skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            _count: { select: { participations: true } },
            meetingInterests: {
              include: { interest: true },
            },
          },
        }),
      ]);

      const mappedData = meetings.map((meeting) => ({
        meetingId: meeting.id,
        title: meeting.title,
        // interestName: meeting.meetingInterests[0]?.interest.name || '',
        interestName:
          meeting.meetingInterests
            .map((mi) => mi.interest.name) // 각 관심사 객체에서 이름만 추출
            .join(', ') || '',
        maxParticipants: meeting.maxParticipants,
        currentParticipants: meeting._count.participations,
        address: meeting.address,
        meetingDate: meeting.meetingDate,
      }));

      return {
        data: mappedData,
        meta: {
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch {
      throw new InternalServerErrorException(
        '모임 목록을 가져오는 중 오류가 발생했습니다.',
      );
    }
  }
}
