import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { TokenExpiredError } from 'jsonwebtoken';
import axios from 'axios';
import { User } from '@prisma/client'; // Prisma 모델 타입 가져오기
import { UpdateExtraInfoDto } from './dto/update-extra-info.dto';
import 'dotenv/config';
import type { JwtPayload } from 'src/auth/jwt-payload.interface';
import { Storage } from '@google-cloud/storage';
import type { Bucket, File } from '@google-cloud/storage';
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
  private bucket: Bucket;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    this.bucket = storage.bucket(process.env.GCS_BUCKET_NAME || '');
  }

  // 일반 회원가입
  async registerUser(
    nickname: string,
    email: string,
    password: string,
  ): Promise<User> {
    try {
      const checkEmail = await this.isEmailAvailable(email);
      if (!checkEmail) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }

      const checkNickname = await this.isNicknameAvailable(nickname);
      if (!checkNickname) {
        throw new ConflictException('이미 존재하는 닉네임입니다.');
      }

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
  //구글로그인
  async loginWithGoogle(
    code: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { isNewUser: boolean; email: string; nickname: string };
  }> {
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

      const googleAccessToken = tokenRes.data.access_token;

      // 2. 사용자 정보 조회
      const userInfoRes = await axios.get<GoogleUserInfo>(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${googleAccessToken}` } },
      );

      const { email, name } = userInfoRes.data;

      // 3. DB 확인
      let user: User | null = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // 신규 회원 → DB에 바로 생성
        user = await this.prisma.user.create({
          data: {
            email,
            nickname: name,
            // TODO: 닉네임 받아오는 로직
          },
        });
      }

      // 4. refreshToken 확인 및 발급/갱신
      let refreshToken = user.refreshToken;
      if (!refreshToken) {
        // 없으면 새로 발급
        refreshToken = this.jwtService.sign(
          { id: user.id, email: user.email },
          { secret: process.env.JWT_SECRET, expiresIn: '7d' },
        );
        await this.prisma.user.update({
          where: { id: user.id },
          data: { refreshToken },
        });
      } else {
        // 있으면 검증
        try {
          this.jwtService.verify(refreshToken, {
            secret: process.env.JWT_SECRET,
          });
          // 유효하면 그대로 사용
        } catch (err: any) {
          if (err instanceof TokenExpiredError) {
            // 만료 → 새로 발급
            refreshToken = this.jwtService.sign(
              { id: user.id, email: user.email },
              { secret: process.env.JWT_SECRET, expiresIn: '7d' },
            );
            await this.prisma.user.update({
              where: { id: user.id },
              data: { refreshToken },
            });
          } else {
            throw new UnauthorizedException(
              '유효하지 않은 Refresh 토큰입니다.',
            );
          }
        }
      }

      // 5. accessToken은 항상 새로 발급
      const accessToken = this.jwtService.sign(
        { id: user.id, email: user.email },
        { secret: process.env.JWT_SECRET, expiresIn: '1h' },
      );

      // 6. 응답 반환
      return {
        accessToken,
        refreshToken,
        user: {
          isNewUser: !user.bio,
          email: user.email,
          nickname: user.nickname,
        },
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
  //일반로그인
  async login(email: string, password: string) {
    // 1. 사용자 조회
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 2. 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 3. refreshToken 확인
    let refreshToken = user.refreshToken;
    if (!refreshToken) {
      // 없으면 새로 발급
      refreshToken = this.jwtService.sign(
        { id: user.id, email: user.email },
        { secret: process.env.JWT_SECRET, expiresIn: '7d' },
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });
    } else {
      // 있으면 검증
      try {
        this.jwtService.verify(refreshToken, {
          secret: process.env.JWT_SECRET,
        });
        // 유효하면 그대로 사용
      } catch (err) {
        if (err instanceof TokenExpiredError) {
          // 만료 → 새로 발급
          refreshToken = this.jwtService.sign(
            { id: user.id, email: user.email },
            { secret: process.env.JWT_SECRET, expiresIn: '7d' },
          );
          await this.prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
          });
        } else {
          throw new UnauthorizedException('유효하지 않은 Refresh 토큰입니다.');
        }
      }
    }

    // 4. accessToken은 항상 새로 발급
    const accessToken = this.jwtService.sign(
      { id: user.id, email: user.email },
      { secret: process.env.JWT_SECRET, expiresIn: '1h' },
    );

    // 5. 응답 반환
    return {
      accessToken,
      refreshToken,
      user: {
        isNewUser: !user.bio,
        email: user.email,
        nickname: user.nickname,
      },
    };
  }
  async updateExtraInfo(
    userId: number,
    dto: UpdateExtraInfoDto,
    file?: Express.Multer.File, // 업로드된 파일 (선택적)
  ) {
    // 1. 유저 ID가 없으면 에러 발생
    if (!userId) throw new Error('User ID is missing');

    // 2. 닉네임 중복 체크 (자기 자신 제외)
    if (dto.nickname) {
      const exists = await this.prisma.user.findFirst({
        where: { nickname: dto.nickname, id: { not: userId } },
        select: { id: true },
      });
      if (exists) throw new ConflictException('Nickname already in use');
    }

    // 3. 파일 업로드 처리 (Google Cloud Storage)
    let imageUrl: string | undefined;
    if (file) {
      const blob = this.bucket.file(
        `${userId}-${Date.now()}-${file.originalname}`,
      );
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: file.mimetype,
      });

      await new Promise<void>((resolve, reject) => {
        blobStream.on('error', reject);
        blobStream.on('finish', () => {
          imageUrl = `https://storage.googleapis.com/${this.bucket.name}/${blob.name}`;
          resolve();
        });
        blobStream.end(file.buffer);
      });
    }

    // 4. 닉네임/소개/이미지 업데이트 (DB 반영)
    const userBaseUpdate = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: dto.nickname,
        bio: dto.bio,
        ...(imageUrl ? { image: imageUrl } : {}),
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        bio: true,
        image: true,
      },
    });

    // 5. interests 동기화 (DTO에서 이미 배열로 파싱됨)
    if (dto.interests && dto.interests.length > 0) {
      // 유효한 interest id인지 확인
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

      // 삭제할 관심사
      const toDelete = currentLinks
        .filter((link) => !validIds.has(link.interestId))
        .map((link) => link.id);

      // 추가할 관심사
      const currentIds = new Set(currentLinks.map((l) => l.interestId));
      const toAdd = desired.filter((id) => !currentIds.has(id));

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

    // 6. 최신 관심사 목록 조회
    const interests = await this.prisma.userInterest.findMany({
      where: { userId },
      include: { interest: true },
    });

    // 7. 최종 반환
    return {
      id: userBaseUpdate.id,
      email: userBaseUpdate.email,
      nickname: userBaseUpdate.nickname,
      bio: userBaseUpdate.bio,
      image: userBaseUpdate.image,
      interests: interests.map((i) => ({
        id: i.interestId,
        name: i.interest.name,
      })),
    };
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  //닉네임 중복체크
  async isNicknameAvailable(nickname: string): Promise<boolean> {
    const existing = await this.prisma.user.findUnique({
      where: { nickname },
    });
    console.log(nickname);
    console.log(existing);

    return !existing;
  }
  //이메일 중복체크
  async isEmailAvailable(email: string): Promise<boolean> {
    const existing = await this.prisma.user.findFirst({
      where: { email },
    });
    console.log(email);
    console.log(existing);

    return !existing;
  }
  //새 토큰 발급
  async refreshAccessToken(refreshToken: string) {
    try {
      const { email } = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('유효하지 않은 Refresh 토큰입니다.');
      }

      const newAccessToken = this.jwtService.sign(
        { id: user.id, email: user.email },
        { secret: process.env.JWT_SECRET, expiresIn: '1h' },
      );

      return { accessToken: newAccessToken, refreshToken };
    } catch (err: any) {
      if (err instanceof TokenExpiredError) {
        // 새 refreshToken 발급
        const decoded = this.jwtService.decode<JwtPayload | null>(refreshToken);
        if (!decoded || typeof decoded === 'string') {
          throw new UnauthorizedException('Refresh token decode 실패');
        }
        const { id, email } = decoded;
        const newRefreshToken = this.jwtService.sign(
          { id, email },
          { secret: process.env.JWT_SECRET, expiresIn: '7d' },
        );

        await this.prisma.user.update({
          where: { id },
          data: { refreshToken: newRefreshToken },
        });

        const newAccessToken = this.jwtService.sign(
          { id, email },
          { secret: process.env.JWT_SECRET, expiresIn: '1h' },
        );

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
      }

      throw new UnauthorizedException('Refresh 토큰 검증 실패');
    }
  }
}
