import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator"

export class HybridUssdDto {
  @IsOptional()
  @IsString()
  operator?: string

  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, unknown>
}
