import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class HybridIvrDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  studentId!: string;

  /** Caller ID as reported by the (authenticated) operator. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  senderPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  responsibleDocumentId?: string;
}
