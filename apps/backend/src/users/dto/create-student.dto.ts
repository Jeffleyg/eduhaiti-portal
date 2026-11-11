import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
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

  /** Guardian phones: they enable absence SMS, the SMS/IVR gateway and the family portal OTP. */
  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s().-]{8,20}$/, { message: 'fatherPhone must be a valid phone number' })
  fatherPhone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s().-]{8,20}$/, { message: 'motherPhone must be a valid phone number' })
  motherPhone?: string;

  @IsOptional()
  @IsString()
  classId?: string;
}
