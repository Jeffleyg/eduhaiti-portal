import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator"

export class HybridSmsDto {
  @IsOptional()
  @IsString()
  operator?: string

  @IsObject()
  @IsNotEmpty()
  payload!: Record<string, unknown>
}
