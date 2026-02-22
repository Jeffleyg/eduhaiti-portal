import { IsEmail, IsString, MinLength, IsEnum } from "class-validator"
import { Role } from "@prisma/client"

export class SignupDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(3)
  name: string

  @IsEnum(["TEACHER", "STUDENT"])
  role: Role
}
