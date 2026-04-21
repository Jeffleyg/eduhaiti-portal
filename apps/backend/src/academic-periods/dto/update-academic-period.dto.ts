import { IsBoolean, IsDateString, IsOptional, IsString } from "class-validator"

export class UpdateAcademicPeriodDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean

  @IsOptional()
  @IsString()
  description?: string
}
