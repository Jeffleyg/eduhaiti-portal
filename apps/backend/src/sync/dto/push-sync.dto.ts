import { Type } from "class-transformer"
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator"
import { SYNC_ENTITIES, SYNC_OPERATION } from "../types/sync.types"

export class PushSyncActionDto {
  @IsUUID()
  actionId!: string

  @IsEnum(SYNC_ENTITIES)
  entityType!: (typeof SYNC_ENTITIES)[number]

  @IsString()
  @IsNotEmpty()
  entityId!: string

  @IsEnum(SYNC_OPERATION)
  operation!: (typeof SYNC_OPERATION)[number]

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>

  @IsISO8601({ strict: true })
  clientTimestamp!: string
}

export class PushSyncDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PushSyncActionDto)
  actions!: PushSyncActionDto[]
}
