import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  HttpStatus,
  HttpException,
  Query,
  //아래의 2개는 상세조회에서 쓸 라이브러리
} from '@nestjs/common';
import * as express from 'express';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { PageOptionsDto } from './dto/page-options.dto';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  async create(@Body() dto: CreateMeetingDto, @Res() res: express.Response) {
    // 임시로 ID가 1인 유저가 방장이라고 가정하고 전달합니다.
    // (추후 JWT 가드 설치 후 req.user.id로 교체될 예정입니다)
    try {
      const tempHostId = 2;
      await this.meetingsService.create(dto, tempHostId);

      return res.status(HttpStatus.CREATED).send();
    } catch (error) {
      if (error instanceof HttpException) {
        const status = error.getStatus();
        return res.status(status).send();
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Get()
  async findAll(
    @Res() res: express.Response,
    @Query() pageOptionsDto: PageOptionsDto,
  ) {
    try {
      const result = await this.meetingsService.findAll(pageOptionsDto);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).send();
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }
}
