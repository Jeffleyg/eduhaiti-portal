import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator"

export class GuardianTuitionPaymentDto {
  @IsEnum(["moncash", "natcash"])
  provider!: "moncash" | "natcash"

  @IsString()
  @IsNotEmpty()
  accountNumber!: string

  @IsString()
  @IsNotEmpty()
  studentEnrollmentNumber!: string

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string

  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  amountHtg!: number

  @IsOptional()
  @IsString()
  tuitionPaymentId?: string

  @IsOptional()
  @IsString()
  guardianName?: string

  @IsOptional()
  @IsString()
  guardianPhone?: string
}
