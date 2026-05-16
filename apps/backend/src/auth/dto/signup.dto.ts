import { IsEmail, IsString, MinLength, MaxLength, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsEnum(['TEACHER', 'STUDENT'])
  role: Role;
}
