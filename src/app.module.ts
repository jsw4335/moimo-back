import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { MeetingsModule } from './modules/meetings/meetings.module';

import { AppService } from './app.service';

@Module({
  imports: [PrismaModule, UsersModule, MeetingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
