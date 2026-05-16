# Owner Module - Super Admin Control Panel

## Overview

The Owner Module provides a comprehensive super admin control panel for managing the entire EduHaiti platform. It handles tenant management, role-based access control (RBAC), global system settings, audit logging, and business analytics.

## Features

### 1. **Tenant Management**
- Create new tenants/schools with configuration limits
- Update tenant limits (max students, storage)
- Configure white label branding (logo, colors, favicon)
- Get tenant usage metrics
- Soft delete tenants (logical deletion with restore capability)
- List tenants with pagination

**Key Endpoints:**
- `POST /owner/tenants` - Create tenant
- `GET /owner/tenants` - List tenants
- `GET /owner/tenants/:id` - Get tenant details
- `PUT /owner/tenants/:id/limits` - Update limits
- `POST /owner/tenants/:id/white-label` - Configure branding
- `GET /owner/tenants/:id/usage` - Get usage metrics
- `DELETE /owner/tenants/:id` - Soft delete tenant

### 2. **Role-Based Access Control (RBAC)**
- Dynamic permission assignment per role
- Permission matrix for each school/tenant
- Check permissions for users
- Revoke permissions
- Initialize default permission sets
- Support for actions: READ, WRITE, DELETE
- Support for resources: students, grades, classes, users, settings, etc.

**Key Endpoints:**
- `POST /owner/rbac/permissions` - Set/update permission
- `GET /owner/rbac/roles/:role` - Get role permissions
- `GET /owner/rbac/permissions` - List all permissions
- `GET /owner/rbac/matrix` - Get permission matrix
- `POST /owner/rbac/check` - Check user permission
- `DELETE /owner/rbac/permissions/:role/:resource` - Revoke permission
- `POST /owner/rbac/init-defaults` - Initialize defaults

### 3. **Global Settings**
- Key-value configuration store
- Encryption support for sensitive data
- Payment gateway configuration (Stripe, Asaas, Efí, MonCash)
- Validation for gateway credentials
- Initialize default settings
- Bulk update settings

**Encrypted Settings:**
- `GATEWAY_STRIPE_KEY` / `GATEWAY_STRIPE_SECRET`
- `GATEWAY_ASAAS_KEY` / `GATEWAY_ASAAS_SECRET`
- `GATEWAY_EFI_KEY` / `GATEWAY_EFI_SECRET`
- `GATEWAY_MONCASH_KEY` / `GATEWAY_MONCASH_SECRET`

**Public Settings:**
- `SYSTEM_NAME` - System display name (default: "EduHaiti")
- `SYSTEM_LANGUAGE` - Default language (default: "pt-BR")
- `DEFAULT_PASSING_GRADE` - Minimum passing grade (default: 60)
- `ACADEMIC_YEAR_START` - Academic year start date (default: "01-09")
- `ACADEMIC_YEAR_END` - Academic year end date (default: "30-06")
- `MAX_FILE_UPLOAD_SIZE_MB` - Max upload size (default: 50)
- `SYSTEM_MAINTENANCE_MODE` - Maintenance mode flag (default: false)
- `SUPPORTED_LANGUAGES` - Supported languages (default: "pt-BR,en,fr")
- `EMAIL_FROM_ADDRESS` - Default email sender
- `ENABLE_STUDENT_REGISTRATION` - Allow student registration (default: true)
- `ENABLE_PARENT_ACCESS` - Allow parent access (default: true)
- `SECURITY_SESSION_TIMEOUT_MINUTES` - Session timeout (default: 30)
- `SECURITY_PASSWORD_MIN_LENGTH` - Min password length (default: 8)
- `SECURITY_PASSWORD_REQUIRE_SPECIAL_CHAR` - Require special chars (default: true)
- `DATA_RETENTION_DAYS` - Audit log retention (default: 365)

**Key Endpoints:**
- `POST /owner/settings` - Set a setting
- `GET /owner/settings/:key` - Get specific setting
- `GET /owner/settings` - List all settings
- `GET /owner/system-config` - Get public config
- `POST /owner/settings/gateway` - Configure payment gateway
- `GET /owner/settings/gateway/:provider` - Get gateway config
- `POST /owner/settings/init-defaults` - Initialize defaults

### 4. **Audit Logging**
- Comprehensive action logging
- Track all admin operations (CREATE, UPDATE, DELETE, PERMISSION_GRANT, etc.)
- Log user activity with IP and user agent
- Query audit logs with filters
- Generate compliance reports
- Export logs to CSV
- Detect suspicious activities
- Archive old logs for data retention

**Key Endpoints:**
- `GET /owner/audit-logs` - Query logs
- `GET /owner/audit-logs/user/:userId/timeline` - Get user timeline
- `GET /owner/audit-logs/summary` - Get activity summary
- `GET /owner/audit-logs/compliance-report` - Generate compliance report
- `GET /owner/audit-logs/export/csv` - Export to CSV
- `POST /owner/audit-logs/suspicious-check/:userId` - Detect suspicious activity

### 5. **Business Metrics & Analytics**
- Total active students/teachers count
- Enrollment growth trends (month-over-month)
- Default rate calculation (overdue payments)
- Attendance statistics
- Grade distribution analysis
- Enrollment by class
- School performance scoring
- Resource utilization
- Executive dashboard

**Key Endpoints:**
- `GET /owner/metrics/dashboard` - Executive dashboard
- `GET /owner/metrics/students` - Total students
- `GET /owner/metrics/teachers` - Total teachers
- `GET /owner/metrics/enrollment-growth` - Enrollment trends
- `GET /owner/metrics/default-rate` - Default rate
- `GET /owner/metrics/attendance` - Attendance stats
- `GET /owner/metrics/grades` - Grade distribution
- `GET /owner/metrics/enrollment-by-class` - Class enrollment
- `GET /owner/metrics/school-performance/:schoolId` - Performance metrics
- `GET /owner/metrics/resource-utilization/:schoolId` - Resource usage

## Security

### Access Control
- All endpoints protected by `SuperAdminGuard`
- Only users with `OWNER` role can access Owner module
- Request decorator `@UseGuards(SuperAdminGuard)` on all endpoints

### Data Protection
- Sensitive settings encrypted with AES-256-CBC
- Encryption key from environment variable `ENCRYPTION_KEY`
- Payment gateway keys never logged in audit trails
- IP address and user agent tracking for security

### Audit Trail
- All admin actions logged
- JSON payloads store before/after values
- Immutable audit log storage
- 365-day default retention

## Services Architecture

### TenantService
```typescript
createTenant(dto: CreateTenantDto): Creates new tenant
updateTenantLimits(tenantId, limits): Updates configuration
configureWhiteLabel(tenantId, branding): Sets branding
getTenantUsage(tenantId): Gets usage metrics
softDeleteTenant(tenantId): Logical deletion
listTenants(skip, take): Paginated list
getTenant(tenantId): Get tenant details
```

### PermissionService
```typescript
setRolePermission(schoolId, dto, userId): Create/update permission
getRolePermissions(schoolId, role): Get all permissions
checkPermission(schoolId, role, resource, action): Verify permission
getPermissionMatrix(schoolId): Get full matrix
revokePermission(schoolId, role, resource, userId): Revoke
createDefaultPermissions(schoolId): Initialize defaults
```

### GlobalSettingsService
```typescript
setSetting(key, value, encrypted, userId): Set a setting
getSetting(key): Get setting (auto-decrypt)
listSettings(skip, take): List all settings
setPaymentGatewayConfig(provider, key, secret): Save gateway
getPaymentGatewayConfig(provider): Get gateway config
validateGatewayConfig(provider, key): Validate key format
initializeDefaults(): Initialize default settings
```

### AuditService
```typescript
log(options): Create audit log entry
query(filters): Query with filters
getActivitySummary(startDate, endDate): Activity stats
getUserActivityTimeline(userId, days): User timeline
generateComplianceReport(start, end, resource): Export report
detectSuspiciousActivity(userId, hoursWindow): Check for patterns
exportToCSV(filters): Export logs
```

### MetricsService
```typescript
getTotalActiveStudents(schoolId?): Count active students
getTotalActiveTeachers(schoolId?): Count active teachers
getEnrollmentGrowth(schoolId?, months): Month-over-month %
calculateDefaultRate(schoolId?, days): Overdue payment rate
getAttendanceStatistics(schoolId?, days): Attendance %
getGradeDistribution(schoolId?): Grade buckets
getEnrollmentByClass(schoolId?): Class-level stats
generateExecutiveDashboard(schoolId?): Composite metrics
getSchoolPerformanceMetrics(schoolId): Score 0-100
```

## Database Models

### Tenant
```prisma
model Tenant {
  id                String
  name              String
  logoUrl           String?
  primaryColor      String?
  secondaryColor    String?
  faviconUrl        String?
  maxStudents       Int
  storageLimit      Int (GB)
  isActive          Boolean
  owner             User
  students          User[]
  classes           Class[]
  rolePermissions   RolePermission[]
  deletedAt         DateTime? (soft delete)
  createdAt         DateTime
  updatedAt         DateTime
}
```

### RolePermission
```prisma
model RolePermission {
  id          String
  schoolId    String
  role        String (ADMIN, TEACHER, STUDENT, SECRETARY)
  resource    String (students, grades, classes, etc.)
  permissions String (comma-separated: READ,WRITE,DELETE)
  isActive    Boolean
  metadata    Json?
  createdAt   DateTime
  updatedAt   DateTime
}
```

### GlobalSettings
```prisma
model GlobalSettings {
  settingKey  String (unique)
  settingValue String
  isEncrypted Boolean
  description String?
  updatedBy   String
  updatedAt   DateTime
}
```

### AuditLog
```prisma
model AuditLog {
  id            String
  userId        String
  schoolId      String?
  action        String
  resource      String
  resourceId    String?
  description   String?
  oldValues     Json?
  newValues     Json?
  ipAddress     String?
  userAgent     String?
  timestamp     DateTime (indexed)
}
```

### TenantMetric
```prisma
model TenantMetric {
  id                    String
  tenantId              String
  totalStudentsActive   Int
  defaultRate           Float (%)
  enrollmentGrowthMoM   Float (%)
  totalRevenueCollected Float
  timestamp             DateTime (indexed)
}
```

## Query Examples

### Create Tenant
```bash
curl -X POST http://localhost:3000/owner/tenants \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lycée Toussaint",
    "email": "admin@lycee-toussaint.ht",
    "maxStudents": 500,
    "storageLimitGB": 100
  }'
```

### Set Permission
```bash
curl -X POST http://localhost:3000/owner/rbac/permissions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "TEACHER",
    "resource": "grades",
    "permissions": "READ,WRITE"
  }'
```

### Get Metrics Dashboard
```bash
curl -X GET http://localhost:3000/owner/metrics/dashboard \
  -H "Authorization: Bearer TOKEN"
```

## Environment Variables

```env
# Encryption for sensitive settings
ENCRYPTION_KEY=your-secret-key-min-32-characters

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/eduhaiti

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRATION=24h
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "statusCode": 400,
  "message": "Invalid input",
  "error": "BadRequestException"
}
```

Common errors:
- `400 Bad Request` - Invalid input validation
- `401 Unauthorized` - Missing/invalid JWT token
- `403 Forbidden` - User not OWNER role
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Best Practices

1. **Permission Design**: Keep permission matrix simple with clear resource/action mappings
2. **Audit Logging**: Always log sensitive operations for compliance
3. **Encryption**: Use encryption key from secure environment variable
4. **Retention**: Implement audit log archival for data retention compliance
5. **Monitoring**: Use metrics dashboard for system health checks
6. **Backup**: Backup audit logs regularly for compliance requirements

## Testing

```bash
# Run unit tests
npm run test owner

# Run integration tests
npm run test:e2e owner

# Generate coverage
npm run test:cov owner
```

## Future Enhancements

- [ ] Bulk tenant operations (import/export)
- [ ] Advanced RBAC with resource hierarchies
- [ ] Permission templates for common roles
- [ ] SSO integration for tenant admins
- [ ] Advanced analytics with data visualization
- [ ] Scheduled reports delivery
- [ ] Custom alert rules
- [ ] Multi-tenancy isolation verification
- [ ] Compliance report generation (GDPR, FERPA)
- [ ] Automated backups management
