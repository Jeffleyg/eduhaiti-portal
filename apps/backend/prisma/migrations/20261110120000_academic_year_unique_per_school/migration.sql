-- Academic years were unique across the whole platform, so a second school could
-- not create "2026-2027". Make the year unique per school instead.

-- DropIndex
DROP INDEX "AcademicYear_year_key";

-- DropIndex (replaced by the unique index below, which serves the same lookups)
DROP INDEX "AcademicYear_schoolId_year_idx";

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_schoolId_year_key" ON "AcademicYear"("schoolId", "year");
