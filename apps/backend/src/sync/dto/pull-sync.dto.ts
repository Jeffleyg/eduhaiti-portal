import { Transform } from "class-transformer"
import { IsArray, IsEnum, IsInt, IsISO8601, IsOptional, Max, Min } from "class-validator"
import { SYNC_ENTITIES } from "../types/sync.types"

export class PullSyncDto {
  @IsISO8601({ strict: true })
  since!: string

  @IsOptional()
  @IsArray()
  @IsEnum(SYNC_ENTITIES, { each: true })
  entities?: Array<(typeof SYNC_ENTITIES)[number]>

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number
}
