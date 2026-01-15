import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  HttpStatus,
  HttpException,
  Query,
  UseGuards,
  Req,
  Param,
  ParseIntPipe,
  Put,
  Delete,
} from '@nestjs/common';
import * as express from 'express';
import { MeetingsService } from './meetings.service';
import { ParticipationsService } from './participations.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingPageOptionsDto } from './dto/meeting-page-options.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { ParticipationUpdateItem } from './dto/update-participation.dto';
import { PageDto } from '../common/dto/page.dto';
import { MyMeetingDto } from './dto/meeting-item.dto';

@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly participationsService: ParticipationsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateMeetingDto,
    @Res() res: express.Response,
    @Req() req: express.Request & { user: JwtPayload },
  ) {
    try {
      const hostId = req.user.id;
      await this.meetingsService.create(dto, hostId);

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
    @Query() pageOptionsDto: MeetingPageOptionsDto,
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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyMeetings(
    @Query('status') status: string = 'all',
    @Query() pageOptionsDto: MeetingPageOptionsDto,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      const result: PageDto<MyMeetingDto> =
        await this.meetingsService.getMyMeetings(
          userId,
          status,
          pageOptionsDto,
        );

      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).send();
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: express.Response,
  ) {
    try {
      const result = await this.meetingsService.findOne(id);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException)
        return res.status(error.getStatus()).send();
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Post(':meetingId/participations')
  @UseGuards(JwtAuthGuard)
  async participate(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.participationsService.createParticipation(
        meetingId,
        userId,
      );
      return res.status(HttpStatus.CREATED).json(result);
    } catch (error) {
      if (error instanceof HttpException)
        return res.status(error.getStatus()).send();
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Get(':meetingId/participations')
  @UseGuards(JwtAuthGuard)
  async getApplicants(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.participationsService.findApplicants(
        meetingId,
        userId,
      );
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException)
        return res.status(error.getStatus()).send();
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Put(':meetingId/participations')
  @UseGuards(JwtAuthGuard)
  async updateParticipationStatuses(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Body() updates: ParticipationUpdateItem[],
    @Req() req: express.Request & { user: JwtPayload },
  ) {
    //이 부분 배포할때는 필요가 없는데, 지금 로컬에서 테스트할 때 빠르게 확인을 하기 위해서 남겨뒀습니다
    //추후에DB에서 수정하는 부분은 await로 남겨두고
    // return부분에는 res.status(HttpStatus.NO_CONTENT).send();로 수정할 예정입니다.
    return this.participationsService.updateStatuses(
      meetingId,
      req.user.id,
      updates,
    );
  }

  @Delete(':meetingId/participations/:participationId')
  @UseGuards(JwtAuthGuard)
  async deleteParticipation(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Param('participationId', ParseIntPipe) participationId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      await this.participationsService.deleteParticipation(
        meetingId,
        participationId,
        userId,
      );
      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      if (error instanceof HttpException)
        return res.status(error.getStatus()).send();
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }
}
