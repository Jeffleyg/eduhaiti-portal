import { IsEnum, IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator"

export class MobileMoneyPaymentDto {
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
}
