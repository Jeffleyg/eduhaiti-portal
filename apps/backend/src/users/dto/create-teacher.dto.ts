import { Type } from "class-transformer"
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator"
import { Gender } from "@prisma/client"

class NewClassDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  level?: string

  @IsOptional()
  @IsString()
  academicYearId?: string

  @IsOptional()
  @IsString()
  seriesId?: string
}

export class CreateTeacherDto {
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
  @IsArray()
  @IsString({ each: true })
  subjects?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classIds?: string[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NewClassDto)
  newClasses?: NewClassDto[]
}
