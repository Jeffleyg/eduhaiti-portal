import { IsOptional, IsString } from 'class-validator';

export class CreateSeriesDto {
  @IsString()
  name: string; // Ex: "3ème Année Fondamentale"

  @IsOptional()
  @IsString()
  code?: string; // Ex: "3AF"

  @IsOptional()
  @IsString()
  academicYearId?: string;
}