import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator"
import { Gender } from "@prisma/client"

export class CreateStudentDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(2)
  firstName: string

  @IsString()
  @MinLength(2)
  lastName: string

  @IsDateString()
  dateOfBirth: string

  @IsString()
  address: string

  @IsEnum(Gender)
  gender: Gender

  @IsOptional()
  @IsString()
  fatherName?: string

  @IsOptional()
  @IsString()
  motherName?: string

  @IsOptional()
  @IsString()
  classId?: string
}
