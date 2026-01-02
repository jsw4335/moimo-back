import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
//아래는 DB접근이 안되어 제가 따로 추가했습니다.
import * as dotenv from 'dotenv';

// 1. 파일 최상단에서 환경 변수를 명시적으로 로드합니다.
dotenv.config();

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    console.log('로드된 DB URL:', process.env.DATABASE_URL);

    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
