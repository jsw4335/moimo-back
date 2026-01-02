import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 회원가입
  @Post('register')
  async register(
    @Body('username') username: string,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    const user = await this.usersService.registerUser(
      username,
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

  // 특정 유저 조회
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.usersService.findOne(Number(id));
  }
}
