import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum MeetingSort {
  NEW = 'NEW',
  UPDATE = 'UPDATE',
  DEADLINE = 'DEADLINE',
  POPULAR = 'POPULAR',
}

export class PageOptionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(MeetingSort)
  sort?: MeetingSort = MeetingSort.NEW;

  @IsOptional()
  @IsString()
  interestFilter?: string = 'ALL';

  @IsOptional()
  @IsString()
  finishedFilter?: string = 'false';
}
