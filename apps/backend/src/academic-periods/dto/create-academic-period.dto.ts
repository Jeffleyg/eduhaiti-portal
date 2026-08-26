import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateAcademicPeriodDto {
  @IsString()
  @IsNotEmpty()
  schoolId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @Matches(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/, {
    message:
      'startDate must be a valid date string (YYYY-MM-DD or ISO 8601)',
  })
  startDate: string;

  @Matches(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/, {
    message:
      'endDate must be a valid date string (YYYY-MM-DD or ISO 8601)',
  })
  endDate: string;

  @IsOptional()
  @IsString()
  description?: string;
}
