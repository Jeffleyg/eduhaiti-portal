import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateStudentDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  address: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fatherName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  motherName?: string;

  @IsOptional()
  @IsString()
  classId?: string;
}
