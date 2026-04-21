import { Gender } from "@prisma/client"
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator"

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fatherName?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  motherName?: string
}
