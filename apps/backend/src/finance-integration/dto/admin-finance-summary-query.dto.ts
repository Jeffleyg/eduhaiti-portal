import { IsDateString, IsOptional } from "class-validator"

export class AdminFinanceSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string
}
