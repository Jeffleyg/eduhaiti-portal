import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ResetTokenDto {
  @IsString()
  @Length(64, 64)
  token: string;
}

export class ResetPasswordDto extends ResetTokenDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
