import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsArray,
} from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  interestIds: number[];

  @IsNumber()
  @IsNotEmpty()
  maxParticipants: number;

  @IsDateString()
  @IsNotEmpty()
  meetingDate: string;

  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}
