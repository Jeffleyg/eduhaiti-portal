import { IsNumber, IsOptional, Max, Min } from "class-validator"

export class UpsertAcademicSettingDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  passAverage?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxAbsencesPerCourse?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  assignmentLateDaysLimit?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  gradeReviewWindowDays?: number
}
