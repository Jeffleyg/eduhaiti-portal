import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateInstallmentPlanDto {
  @IsString()
  @IsNotEmpty()
  studentEnrollmentNumber!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourcePaymentIds?: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(36)
  installments!: number;

  @IsDateString()
  firstDueDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(7)
  @Max(90)
  intervalDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5_000_000)
  customTotalAmountHtg?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  markSourceAsRenegotiated?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
