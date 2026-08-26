import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Gender } from '@prisma/client';

class NewClassDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  seriesId?: string;
}

export class CreateTeacherDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @Matches(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/, {
    message: 'dateOfBirth must be a valid date (YYYY-MM-DD) or ISO 8601 string',
  })
  dateOfBirth: string;

  @IsString()
  address: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsString()
  motherName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NewClassDto)
  newClasses?: NewClassDto[];
}
