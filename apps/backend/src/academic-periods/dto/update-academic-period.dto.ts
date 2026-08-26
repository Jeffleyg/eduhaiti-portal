import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateAcademicPeriodDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/, {
    message:
      'startDate must be a valid date string (YYYY-MM-DD or ISO 8601)',
  })
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/, {
    message:
      'endDate must be a valid date string (YYYY-MM-DD or ISO 8601)',
  })
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
