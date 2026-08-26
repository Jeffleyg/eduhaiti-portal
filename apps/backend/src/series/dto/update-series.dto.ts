import { IsString, IsOptional } from 'class-validator';

export class UpdateSeriesDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
