import { Type } from "class-transformer"
import { IsDateString, IsEnum, IsOptional, IsString, Max, Min } from "class-validator"
import { PaymentStatus } from "@prisma/client"

export class AdminPaymentsQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus

  @IsOptional()
  @IsString()
  studentEnrollmentNumber?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize?: number
}
