import { IsNotEmpty, IsString } from "class-validator"

export class DidTrustTokenDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string

  @IsString()
  @IsNotEmpty()
  studentEnrollmentNumber!: string
}
