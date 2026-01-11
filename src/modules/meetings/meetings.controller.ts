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
} from '@nestjs/common';
import * as express from 'express';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { PageOptionsDto } from './dto/page-options.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

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
}
