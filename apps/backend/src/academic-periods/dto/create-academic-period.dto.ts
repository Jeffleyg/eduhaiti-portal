import { IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class CreateAcademicPeriodDto {
  @IsString()
  @IsNotEmpty()
  schoolId: string

  @IsString()
  @IsNotEmpty()
  name: string

  @IsDateString()
  startDate: string

  @IsDateString()
  endDate: string

  @IsOptional()
  @IsString()
  description?: string
}
