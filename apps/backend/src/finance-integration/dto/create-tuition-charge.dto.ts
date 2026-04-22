import { Type } from "class-transformer"
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator"

export class CreateTuitionChargeDto {
  @IsString()
  @IsNotEmpty()
  studentEnrollmentNumber!: string

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  amountHtg!: number

  @IsDateString()
  dueDate!: string

  @IsOptional()
  @IsString()
  description?: string
}
