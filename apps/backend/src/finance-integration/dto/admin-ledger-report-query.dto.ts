import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class AdminLedgerReportQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(2000)
  limit?: number;
}
