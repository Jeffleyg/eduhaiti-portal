import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class DiasporaRemittanceDto {
  @IsString()
  @IsNotEmpty()
  sourcePlatform!: string;

  @IsString()
  @IsNotEmpty()
  transferId!: string;

  @IsString()
  @IsNotEmpty()
  studentEnrollmentNumber!: string;

  @IsNumber()
  @Min(0.01)
  @Max(100_000)
  amount!: number;

  @IsIn(['USD', 'EUR'])
  currency!: 'USD' | 'EUR';

  @IsOptional()
  @IsString()
  senderPhone?: string;
}
