import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class GuardianDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @Matches(/^\+?[\d\s().-]{8,20}$/, {
    message: 'phoneNumber must be a valid phone number',
  })
  phoneNumber!: string;

  @IsIn(['FATHER', 'MOTHER', 'GUARDIAN'])
  relationship!: 'FATHER' | 'MOTHER' | 'GUARDIAN';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  documentId?: string;
}

export class UpdateGuardiansDto {
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => GuardianDto)
  guardians!: GuardianDto[];
}
