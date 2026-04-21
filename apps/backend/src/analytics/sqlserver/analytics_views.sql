/*
  SQL Server optimized analytics layer for EduHaiti.
  These views are read-focused and can be scheduled/materialized by infra.
*/

CREATE OR ALTER VIEW dbo.vw_dropout_risk_summary
AS
WITH AttendanceWindow AS (
    SELECT
        a.studentId,
        SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) AS absences_90d,
        COUNT(1) AS attendance_events_90d
    FROM dbo.Attendance a
    WHERE a.[date] >= DATEADD(DAY, -90, SYSUTCDATETIME())
    GROUP BY a.studentId
),
GradeWindow AS (
    SELECT
        g.studentId,
        AVG(CAST(g.score AS FLOAT)) AS avg_score_90d,
        MAX(g.createdAt) AS last_grade_at
    FROM dbo.Grade g
    WHERE g.createdAt >= DATEADD(DAY, -90, SYSUTCDATETIME())
    GROUP BY g.studentId
)
SELECT
    u.id AS student_id,
    u.enrollmentNumber,
    u.name AS student_name,
    COALESCE(aw.absences_90d, 0) AS absences_90d,
    COALESCE(aw.attendance_events_90d, 0) AS attendance_events_90d,
    COALESCE(gw.avg_score_90d, 0) AS avg_score_90d,
    CASE
        WHEN COALESCE(aw.attendance_events_90d, 0) = 0 THEN 0
        ELSE CAST(COALESCE(aw.absences_90d, 0) AS FLOAT) / CAST(aw.attendance_events_90d AS FLOAT)
    END AS absence_rate_90d,
    CASE
        WHEN COALESCE(aw.attendance_events_90d, 0) >= 10
             AND (CAST(COALESCE(aw.absences_90d, 0) AS FLOAT) / NULLIF(CAST(aw.attendance_events_90d AS FLOAT), 0)) >= 0.35
             AND COALESCE(gw.avg_score_90d, 0) < 10
        THEN 1
        ELSE 0
    END AS at_risk_dropout
FROM dbo.[User] u
LEFT JOIN AttendanceWindow aw ON aw.studentId = u.id
LEFT JOIN GradeWindow gw ON gw.studentId = u.id
WHERE u.role = 'STUDENT';
GO

CREATE OR ALTER VIEW dbo.vw_average_grade_by_region
AS
SELECT
    COALESCE(NULLIF(s.city, ''), s.country, 'Unknown') AS region,
    COUNT(DISTINCT g.studentId) AS students_count,
    COUNT(1) AS grades_count,
    AVG(CAST(g.score AS FLOAT)) AS avg_grade,
    MAX(g.updatedAt) AS last_update_at
FROM dbo.Grade g
INNER JOIN dbo.Class c ON c.id = g.classId
INNER JOIN dbo.AcademicYear ay ON ay.id = c.academicYearId
INNER JOIN dbo.School s ON s.id = ay.schoolId
GROUP BY COALESCE(NULLIF(s.city, ''), s.country, 'Unknown');
GO

CREATE OR ALTER VIEW dbo.vw_realtime_payment_flow_15m
AS
SELECT
    DATEADD(MINUTE, DATEDIFF(MINUTE, 0, p.createdAt) / 15 * 15, 0) AS bucket_15m,
    p.status,
    COUNT(1) AS payments_count,
    SUM(CAST(p.amount AS FLOAT)) AS amount_total,
    MIN(p.createdAt) AS first_event_at,
    MAX(p.createdAt) AS last_event_at
FROM dbo.Payment p
WHERE p.createdAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
GROUP BY
    DATEADD(MINUTE, DATEDIFF(MINUTE, 0, p.createdAt) / 15 * 15, 0),
    p.status;
GO

/*
  Transparency view: diaspora remittances -> estimated scholarships.
  estimate_rule: each scholarship unit = 15,000 HTG (adjust in BI layer if needed).
*/
CREATE OR ALTER VIEW dbo.vw_diaspora_scholarship_impact
AS
WITH DiasporaCredits AS (
    SELECT
        p.id AS payment_id,
        p.schoolId,
        p.amount AS credited_amount_htg,
        p.createdAt
    FROM dbo.Payment p
    INNER JOIN dbo.AuditLog al
        ON al.entityId = p.id
       AND al.entityType = 'PAYMENT'
       AND al.action = 'DIASPORA_REMITTANCE_CREDIT'
)
SELECT
    d.schoolId,
    CAST(d.createdAt AS DATE) AS impact_date,
    COUNT(1) AS remittance_volume,
    SUM(CAST(d.credited_amount_htg AS FLOAT)) AS credited_total_htg,
    FLOOR(SUM(CAST(d.credited_amount_htg AS FLOAT)) / 15000.0) AS estimated_scholarships
FROM DiasporaCredits d
GROUP BY d.schoolId, CAST(d.createdAt AS DATE);
GO

/* Suggested indexes for SQL Server runtime */
-- CREATE INDEX IX_Attendance_student_date ON dbo.Attendance(studentId, [date]);
-- CREATE INDEX IX_Grade_student_created ON dbo.Grade(studentId, createdAt);
-- CREATE INDEX IX_Payment_created_status ON dbo.Payment(createdAt, status);
-- CREATE INDEX IX_AuditLog_entity_action ON dbo.AuditLog(entityType, action, entityId);
