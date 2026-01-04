import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 회원가입
  @Post('register')
  async register(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('tempToken') tempToken?: string,
    //TODO: tempToken 처리하는 로직 추가해야함
  ) {
    const user = await this.usersService.registerUser(
      email,
      password,
      tempToken,
    );
    return { message: '회원가입 성공', user };
  }

  // 전체 유저 조회
  @Get()
  async findAll() {
    return await this.usersService.findAll();
  }

  // 특정 유저 조회
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.usersService.findOne(Number(id));
  }

  //로그인
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.usersService.login(body.email, body.password);
  }
  //구글 로그인
  @Post('login/google')
  async loginWithGoogle(@Body() body: { code: string; redirectUri: string }) {
    const { code, redirectUri } = body;
    return this.usersService.loginWithGoogle(code, redirectUri);
  }
  //구글로그인 url 이걸 브라우저 주소에 넣고 이동해서 로그인하면 구글에서 google/callback 주소를 호출함
  // https://accounts.google.com/o/oauth2/v2/auth?client_id=432451487718-h713rue36vi4tb4ft1bpela2i56v2d1h.apps.googleusercontent.com&redirect_uri=http://localhost:3000/users/google/callback&response_type=code&scope=email%20profile
  //구글로그인테스트
  @Get('google/callback')
  async googleCallback(@Query('code') code: string) {
    const redirectUri = 'http://localhost:3000/users/google/callback';
    return this.usersService.loginWithGoogle(code, redirectUri);
  }
}
