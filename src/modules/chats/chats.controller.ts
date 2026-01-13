import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ChatService } from './chats.service';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // 메시지 전송
  @Post(':meetingId/messages')
  async sendMessage(
    @Param('meetingId') meetingId: number,
    @Body() body: { senderId: number; content: string },
  ) {
    return this.chatService.createMessage(
      meetingId,
      body.senderId,
      body.content,
    );
  }

  // 메시지 조회
  @Get(':meetingId/messages')
  async getMessages(@Param('meetingId') meetingId: number) {
    return this.chatService.getMessages(meetingId);
  }
}
