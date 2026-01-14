import { Module } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { ParticipationsService } from './participations.service';
import { MeetingsController } from './meetings.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, ParticipationsService],
})
export class MeetingsModule {}
