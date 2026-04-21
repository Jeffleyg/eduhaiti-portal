import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export const EXPORT_FORMATS = ['csv', 'json.gz'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export class ExportReportDto {
  @IsOptional()
  @Type(() => String)
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsEnum(EXPORT_FORMATS)
  format?: ExportFormat;
}
