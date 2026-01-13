import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async createMessage(meetingId: number, senderId: number, content: string) {
    return await this.prisma.chatMessage.create({
      data: {
        meetingId,
        senderId,
        content,
      },
      include: { sender: true },
    });
  }

  async getMessages(meetingId: number) {
    return this.prisma.chatMessage.findMany({
      where: { meetingId },
      include: { sender: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
