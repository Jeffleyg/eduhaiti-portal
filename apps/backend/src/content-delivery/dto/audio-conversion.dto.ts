import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AudioConversionDto {
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @IsOptional()
  @IsString()
  targetBitrate?: string;
}
