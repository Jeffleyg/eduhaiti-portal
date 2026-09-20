import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAcademicYearDto {
  @IsString()
  year: string; // Ex: "2026-2027"

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}