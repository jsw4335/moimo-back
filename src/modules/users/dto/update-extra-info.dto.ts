import {
  IsString,
  IsOptional,
  IsArray,
  ArrayUnique,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateExtraInfoDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  interests?: number[];
}
