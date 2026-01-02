import { Controller, Post, Body, Get } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  create(@Body() dto: CreateMeetingDto) {
    // 임시로 ID가 1인 유저가 방장이라고 가정하고 전달합니다.
    // (추후 JWT 가드 설치 후 req.user.id로 교체될 예정입니다)
    const tempHostId = 4;
    return this.meetingsService.create(dto, tempHostId);
  }

  @Get()
  findAll() {
    return this.meetingsService.findAll();
  }
}
