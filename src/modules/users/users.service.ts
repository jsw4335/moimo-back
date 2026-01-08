import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { User } from '@prisma/client'; // Prisma 모델 타입 가져오기
import { UpdateExtraInfoDto } from './dto/update-extra-info.dto';
import 'dotenv/config';

//구글 토큰 엔드포인트 응답 구조를 타입으로 정의
interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}
interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // 1-1 일반 회원가입
  async registerUser(
    nickname: string,
    email: string,
    password: string,
  ): Promise<User> {
    try {
      console.log('DATABASE_URL:', process.env.DATABASE_URL);
      const existing = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existing) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }
      console.log(
        password,
        '---------------------------------------------------',
      );

      const hashedPassword: string = await bcrypt.hash(password, 10);

      const created = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nickname,
        },
      });

      return created;
    } catch (err: unknown) {
      if (err instanceof ConflictException) {
        throw err;
      }
      if (err instanceof Error) {
        console.error('회원가입 에러:', err.message);
      } else {
        console.error('회원가입 에러: 알 수 없는 타입', err);
      }
      throw new InternalServerErrorException(
        '회원가입 처리 중 오류가 발생했습니다.',
      );
    }
  }
  // 전체 유저 조회
  async findAll(): Promise<User[]> {
    return await this.prisma.user.findMany();
  }

  // // 1-2 구글 로그인
  async loginWithGoogle(
    code: string,
    redirectUri: string,
  ): Promise<
    | { isNewUser: true; email: string; tempToken: string }
    | {
        accessToken: string;
        refreshToken: string;
        user: { email: string; provider_id: string };
      }
  > {
    try {
      // 1. 구글 토큰 교환
      const tokenRes = await axios.post<GoogleTokenResponse>(
        'https://oauth2.googleapis.com/token',
        {
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        },
        { headers: { 'Content-Type': 'application/json' } },
      );

      const accessToken = tokenRes.data.access_token;

      // 2. 사용자 정보 조회
      const userInfoRes = await axios.get<GoogleUserInfo>(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const { email, id: providerId, name } = userInfoRes.data;

      // 3. DB 확인
      const user: User | null = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // 신규 회원 → DB에 바로 생성
        const newUser = await this.prisma.user.create({
          data: {
            email,
            nickname: name,
            // TODO: 닉네임 받아오는 로직
          },
        });

        const payload = { id: newUser.id, email: newUser.email };
        const jwtAccess = this.jwtService.sign(payload, {
          secret: process.env.JWT_SECRET,
          expiresIn: '1m',
        });
        const jwtRefresh = this.jwtService.sign(payload, {
          secret: process.env.JWT_SECRET,
          expiresIn: '7d',
        });

        return {
          accessToken: jwtAccess,
          refreshToken: jwtRefresh,
          user: { email, provider_id: providerId },
        };
      }

      // 기존 회원 → Access/Refresh Token 발급

      const payload = {
        id: user.id,
        email: user.email,
      };
      const jwtAccess = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '5m',
      });
      const jwtRefresh = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '7d',
      });

      return {
        accessToken: jwtAccess,
        refreshToken: jwtRefresh,
        user: { email, provider_id: providerId },
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw new InternalServerErrorException(
          `구글 로그인 실패: ${err.message}`,
        );
      }
      throw new InternalServerErrorException(
        '구글 로그인 중 알 수 없는 오류 발생',
      );
    }
  }

  async login(email: string, password: string) {
    // 1. 사용자 조회
    const user = await this.prisma.user.findUnique({ where: { email } });

    // 2. 사용자 존재 여부 및 비밀번호 null 체크
    if (!user || !user.password) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 3. 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 4. JWT 토큰 발급
    const payload = { id: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '5m',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '7d',
    });

    // 5. 응답 반환
    return {
      accessToken,
      refreshToken,
      user: {
        email: user.email,
      },
    };
  }

  async updateExtraInfo(userId: number, dto: UpdateExtraInfoDto) {
    // optional: nickname 중복 체크 (자기 자신 제외)
    if (!userId) {
      throw new Error('User ID is missing');
    }

    if (dto.nickname) {
      const exists = await this.prisma.user.findFirst({
        where: { nickname: dto.nickname, id: { not: userId } },
        select: { id: true },
      });
      if (exists) throw new ConflictException('Nickname already in use');
    }

    // 닉네임/소개는 바로 업데이트
    const userBaseUpdate = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: dto.nickname,
        bio: dto.bio,
      },
      select: { id: true, email: true, nickname: true, bio: true },
    });

    // 관심사 동기화 (N:M: user_interests 테이블)
    // - 전달된 interests가 있으면: 기존 연결 중 전달 목록에 없는 것 삭제, 없는 것은 추가
    // - 전달이 없으면: 아무 변경 없음
    if (dto.interests) {
      // 유효한 interest id인지 확인 (선택: 없으면 무시 또는 에러)
      const validInterests = await this.prisma.interest.findMany({
        where: { id: { in: dto.interests } },
        select: { id: true },
      });
      const validIds = new Set(validInterests.map((i) => i.id));

      // 현재 유저의 연결된 관심사 조회
      const currentLinks = await this.prisma.userInterest.findMany({
        where: { userId },
        select: { id: true, interestId: true },
      });

      const desired = Array.from(validIds);

      const toDelete = currentLinks
        .filter((link) => !validIds.has(link.interestId))
        .map((link) => link.id);

      const currentIds = new Set(currentLinks.map((l) => l.interestId));
      const toAdd = desired.filter((id) => !currentIds.has(id));

      // 트랜잭션으로 삭제/추가
      await this.prisma.$transaction([
        ...(toDelete.length
          ? [
              this.prisma.userInterest.deleteMany({
                where: { id: { in: toDelete } },
              }),
            ]
          : []),
        ...toAdd.map((interestId) =>
          this.prisma.userInterest.create({
            data: { userId, interestId },
          }),
        ),
      ]);
    }

    // 최신 관심사 목록 반환
    const interests = await this.prisma.userInterest.findMany({
      where: { userId },
      include: { interest: true },
    });

    return {
      id: userBaseUpdate.id,
      email: userBaseUpdate.email,
      nickname: userBaseUpdate.nickname,
      bio: userBaseUpdate.bio,
      interests: interests.map((i) => ({
        id: i.interestId,
        name: i.interest.name,
      })),
    };
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
