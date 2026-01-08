import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Patch,
  Req,
  ValidationPipe,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateExtraInfoDto } from './dto/update-extra-info.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
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

  @Get('check-nickname')
  async checkNickname(@Query('nickname') nickname: string) {
    const available = await this.usersService.isNicknameAvailable(nickname);
    console.log(available);

    if (!available) {
      throw new UnauthorizedException();
    }

    return;
  }
}
