import { Module } from '@nestjs/common';
import { MailsService } from './mails.service';

@Module({
  providers: [MailsService],
  exports: [MailsService], // 다른 모듈에서 사용 가능하도록 export
})
export class MailsModule {}
