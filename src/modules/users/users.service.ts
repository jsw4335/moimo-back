import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
// import axios from 'axios';
import { User } from '@prisma/client'; // Prisma 모델 타입 가져오기

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // 1-1 일반 회원가입
  async registerUser(
    username: string,
    email: string,
    password: string,
  ): Promise<User> {
    try {
      const existing = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existing) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }

      // bcrypt.hash 반환 타입을 string으로 명시
      const hashedPassword: string = await bcrypt.hash(password, 10);

      const created = await this.prisma.user.create({
        data: { email, password: hashedPassword, nickname: username },
      });

      return created;
    } catch (err: unknown) {
      if (err instanceof ConflictException) {
        throw err; // 위에서 던진 경우 그대로 전달
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

  // 특정 유저 조회
  async findOne(id: number): Promise<User | null> {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  // // 1-2 구글 로그인
  // async loginWithGoogle(
  //   code: string,
  //   redirectUri: string,
  // ): Promise<
  //   | {
  //       isNewUser: true;
  //       email: string;
  //       tempToken: string;
  //     }
  //   | {
  //       accessToken: string;
  //       refreshToken: string;
  //       user: { email: string; provider_id: string };
  //     }
  // > {
  //   try {
  //     // 구글 토큰 교환
  //     const tokenRes = await axios.post(
  //       'https://oauth2.googleapis.com/token',
  //       {
  //         code,
  //         client_id: process.env.GOOGLE_CLIENT_ID,
  //         client_secret: process.env.GOOGLE_CLIENT_SECRET,
  //         redirect_uri: redirectUri,
  //         grant_type: 'authorization_code',
  //       },
  //       { headers: { 'Content-Type': 'application/json' } },
  //     );

  //     const accessToken: string = tokenRes.data.access_token;

  //     // 사용자 정보 조회
  //     const userInfoRes = await axios.get(
  //       'https://www.googleapis.com/oauth2/v2/userinfo',
  //       { headers: { Authorization: `Bearer ${accessToken}` } },
  //     );

  //     const { email, id: providerId } = userInfoRes.data as {
  //       email: string;
  //       id: string;
  //     };

  //     // DB 확인
  //     const user: User | null = await this.prisma.user.findUnique({
  //       where: { email },
  //     });

  //     if (!user) {
  //       const tempToken = this.jwtService.sign(
  //         { email, providerId },
  //         { expiresIn: '10m' },
  //       );
  //       return { isNewUser: true, email, tempToken };
  //     }

  //     const payload = { email, providerId };
  //     const jwtAccess = this.jwtService.sign(payload, { expiresIn: '1h' });
  //     const jwtRefresh = this.jwtService.sign(payload, { expiresIn: '7d' });

  //     return {
  //       accessToken: jwtAccess,
  //       refreshToken: jwtRefresh,
  //       user: { email, provider_id: providerId },
  //     };
  //   } catch (err: unknown) {
  //     if (err instanceof Error) {
  //       throw new InternalServerErrorException(
  //         `구글 로그인 실패: ${err.message}`,
  //       );
  //     }
  //     throw new InternalServerErrorException(
  //       '구글 로그인 중 알 수 없는 오류 발생',
  //     );
  //   }
  // }

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
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // 5. 응답 반환
    return {
      accessToken,
      refreshToken,
      user: {
        email: user.email,
      },
    };
  }
}
