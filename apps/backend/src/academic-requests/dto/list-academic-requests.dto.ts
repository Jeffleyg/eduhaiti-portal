import { AcademicRequestStatus } from "@prisma/client"
import { IsEnum, IsOptional, IsString } from "class-validator"

export class ListAcademicRequestsDto {
  @IsOptional()
  @IsString()
  classId?: string

  @IsOptional()
  @IsEnum(AcademicRequestStatus)
  status?: AcademicRequestStatus
}
