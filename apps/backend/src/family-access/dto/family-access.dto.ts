import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class RequestFamilyCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  enrollmentNumber!: string;

  @IsString()
  @Matches(/^\+?[\d\s().-]{8,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone!: string;
}

export class VerifyFamilyCodeDto extends RequestFamilyCodeDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must have 6 digits' })
  code!: string;
}

export class FamilyContactRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;
}
