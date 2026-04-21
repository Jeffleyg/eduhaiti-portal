import { AcademicRequestType } from "@prisma/client"
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class CreateAcademicRequestDto {
  @IsOptional()
  @IsString()
  classId?: string

  @IsEnum(AcademicRequestType)
  type: AcademicRequestType

  @IsString()
  @IsNotEmpty()
  title: string

  @IsString()
  @IsNotEmpty()
  details: string
}
