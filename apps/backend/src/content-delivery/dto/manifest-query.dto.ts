import { Type } from 'class-transformer';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class ManifestQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  since?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  classId?: string;
}
