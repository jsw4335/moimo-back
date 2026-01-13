import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ChatService } from './chats.service';

@WebSocketGateway({ cors: true }) // CORS 허용
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  // 채팅방 입장
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() meetingId: number,
    @ConnectedSocket() client: Socket,
  ) {
    await client.join(String(meetingId));
    return { status: 'joined', meetingId };
  }

  // 메시지 전송
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: { meetingId: number; senderId: number; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    // DB 저장
    const message = await this.chatService.createMessage(
      data.meetingId,
      data.senderId,
      data.content,
    );

    // 같은 방에 있는 모든 클라이언트에게 브로드캐스트
    client.to(String(data.meetingId)).emit('newMessage', message);

    return message;
  }
}
