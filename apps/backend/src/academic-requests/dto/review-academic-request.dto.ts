import { AcademicRequestStatus } from "@prisma/client"
import { IsEnum, IsOptional, IsString } from "class-validator"

export class ReviewAcademicRequestDto {
  @IsEnum(AcademicRequestStatus)
  status: AcademicRequestStatus

  @IsOptional()
  @IsString()
  resolutionComment?: string
}
