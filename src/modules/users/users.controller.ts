import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Patch,
  Req,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateExtraInfoDto } from './dto/update-extra-info.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';

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
  async login(@Body(new ValidationPipe()) body: LoginDto) {
    return this.usersService.login(body.email, body.password);
  }
  //구글 로그인
  @Post('login/google')
  async loginWithGoogle(@Body() body: { code: string; redirectUri: string }) {
    const { code, redirectUri } = body;
    return this.usersService.loginWithGoogle(code, redirectUri);
  }
  //구글로그인 url 이걸 브라우저 주소에 넣고 이동해서 로그인하면 구글에서 google/callback 주소를 호출함
  // https://accounts.google.com/o/oauth2/v2/auth?client_id=432451487718-h713rue36vi4tb4ft1bpela2i56v2d1h.apps.googleusercontent.com&redirect_uri=http://localhost:5173/users/google/callback&response_type=code&scope=email%20profile
  //구글로그인테스트
  @Get('google/callback')
  async googleCallback(@Query('code') code: string) {
    const redirectUri = 'http://localhost:3000/users/google/callback';
    return this.usersService.loginWithGoogle(code, redirectUri);
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
      email: foundUser.email,
      nickname: foundUser.nickname ?? null,
    };
  }

  //프로필추가
  @UseGuards(JwtAuthGuard)
  @Patch('extraInfo')
  async updateExtraInfo(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: UpdateExtraInfoDto,
  ) {
    const userId = req.user.id;
    return this.usersService.updateExtraInfo(userId, dto);
  }
}
