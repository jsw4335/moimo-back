import { IsString, IsNotEmpty, IsNumber, IsDateString } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  interestId: number;

  @IsNumber()
  @IsNotEmpty()
  maxParticipants: number;

  @IsDateString()
  @IsNotEmpty()
  meetingDate: string;

  @IsString()
  @IsNotEmpty()
  address: string;
}
