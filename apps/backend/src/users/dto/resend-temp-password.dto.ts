import { IsEmail } from "class-validator"

export class ResendTempPasswordDto {
  @IsEmail()
  email: string
}
