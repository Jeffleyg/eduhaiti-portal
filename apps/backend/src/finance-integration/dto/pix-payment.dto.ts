import { IsString, IsNumber, IsOptional, Min, MinLength } from 'class-validator';

export class PixPaymentDto {
  @IsString()
  @MinLength(1)
  studentEnrollmentNumber: string;

  @IsNumber()
  @Min(0.01)
  amountHtg: number;

  @IsOptional()
  @IsString()
  tuitionPaymentId?: string; // Link to specific charge if applicable

  @IsString()
  @MinLength(10)
  guardianPhone: string; // For webhook callback/verification

  @IsOptional()
  @IsString()
  guardianEmail?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
