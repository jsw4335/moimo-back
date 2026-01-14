import { IsEnum, IsInt } from 'class-validator';
import { ParticipationStatus } from '@prisma/client';

export class ParticipationUpdateItem {
  @IsInt()
  participationId: number;

  @IsEnum(ParticipationStatus)
  status: ParticipationStatus;
}
