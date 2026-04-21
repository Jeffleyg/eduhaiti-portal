import { IsOptional, IsString, IsNumber } from "class-validator"

export class UpdateDisciplineDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  code?: string

  @IsOptional()
  @IsNumber()
  credits?: number
}
