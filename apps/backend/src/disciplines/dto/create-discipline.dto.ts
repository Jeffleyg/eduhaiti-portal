import { IsOptional, IsString, IsNumber, IsNotEmpty } from "class-validator"

export class CreateDisciplineDto {
  @IsString()
  @IsNotEmpty()
  seriesId: string

  @IsString()
  @IsNotEmpty()
  name: string

  @IsOptional()
  @IsString()
  code?: string

  @IsOptional()
  @IsNumber()
  credits?: number
}
