import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';

export enum PixKeyType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  RANDOM = 'RANDOM',
}

export class CreatePixAccountDto {
  @IsEnum(PixKeyType)
  keyType: PixKeyType;

  @IsString()
  @MinLength(1)
  key: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;

  @IsOptional()
  @IsString()
  bankCode?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  accountBranch?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
