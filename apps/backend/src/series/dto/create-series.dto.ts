import { IsString, IsOptional } from 'class-validator';

export class CreateSeriesDto {
  @IsString()
  name: string;

  @IsString()
  academicYearId: string;

  @IsOptional()
  @IsString()
  description?: string;
}
