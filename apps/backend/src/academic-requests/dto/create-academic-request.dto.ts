import { AcademicRequestType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateAcademicRequestDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsEnum(AcademicRequestType)
  type: AcademicRequestType;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  details: string;
}
