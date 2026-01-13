import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  ValidationPipe,
  UnauthorizedException,
  Res,
  Put,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateExtraInfoDto } from './dto/update-extra-info.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 회원가입
  @Post('register')
  async register(
    @Body('nickname') nickname: string,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    const user = await this.usersService.registerUser(
      nickname,
      email,
      password,
    );
    return { message: '회원가입 성공', user };
  }

  // 전체 유저 조회
  @Get()
  async findAll() {
    return await this.usersService.findAll();
  }

  //로그인
  @Post('login')
  async login(
    @Body(new ValidationPipe()) body: LoginDto,
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.usersService.login(
      body.email,
      body.password,
    );
    // 1. Authorization 헤더에 담기
    res.setHeader('Authorization', `Bearer ${accessToken}`);

    // 2. 쿠키에도 담기
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true, // HTTPS 환경에서만
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1시간
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    return res.json({ user });
  }
  //구글 로그인
  @Post('login/google')
  async loginWithGoogle(
    @Body() body: { code: string; redirectUri: string },
    @Res() res: Response,
  ) {
    const { code, redirectUri } = body;
    const { accessToken, refreshToken, user } =
      await this.usersService.loginWithGoogle(code, redirectUri);
    // 1. Authorization 헤더에 담기
    res.setHeader('Authorization', `Bearer ${accessToken}`);

    // 2. 쿠키에도 담기
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true, // HTTPS 환경에서만
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1시간
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    return res.json({ user });
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res.status(200).send();
  }

  // // 토큰 검증 API
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: Request & { user: JwtPayload }) {
    const user = req.user;

    const foundUser = await this.usersService.findById(user.id);

    if (!foundUser) {
      throw new UnauthorizedException('유효하지 않은 사용자입니다.');
    }

    return {
      isNewUser: !foundUser.bio,
      id: 12,
      email: foundUser.email,
      nickname: foundUser.nickname ?? null,

      bio: foundUser.bio,
      // TODO: interest목록 불러오는 로직 추가하기
      profile_image: '추가해야함',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('user-update')
  @UseInterceptors(
    FileInterceptor(
      'file',
      {
        storage: multer.memoryStorage(),
      }, // ✅ 여기서 직접 지정 가능
    ),
  )
  async updateUser(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: UpdateExtraInfoDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user.id;
    return this.usersService.updateUser(userId, dto, file);
  }
  @Post('check-nickname')
  async checkNickname(@Body('nickname') nickname: string) {
    const available = await this.usersService.isNicknameAvailable(nickname);
    console.log(available);

    if (!available) {
      throw new UnauthorizedException();
    }

    return;
  }
  @Post('check-email')
  async checkEmail(@Body('email') email: string) {
    const available = await this.usersService.isEmailAvailable(email);
    console.log(available);

    if (!available) {
      throw new UnauthorizedException();
    }
    return;
  }
}
