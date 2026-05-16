# Owner Module - Architecture Overview

This document provides a visual overview of the Owner Module architecture and data flow.

## Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      OWNER MODULE (OwnerModule)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  OwnerController (50+ endpoints)          │  │
│  │  - Tenants: create, list, get, update, delete            │  │
│  │  - RBAC: setPermission, getRolePermissions, check         │  │
│  │  - Settings: set, get, gateway config                    │  │
│  │  - Audit: query, timeline, reports, export               │  │
│  │  - Metrics: dashboard, trends, analytics                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────┬────────────────────┬────────────┬────────┐   │
│  │              │                    │            │        │   │
│  ↓              ↓                    ↓            ↓        ↓   │
│┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐  │
││Tenant   │ │Permission│ │GlobalSet │ │Audit   │ │Metrics │  │
││Service  │ │Service   │ │Service   │ │Service │ │Service │  │
│└─────────┘ └──────────┘ └──────────┘ └────────┘ └────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    SuperAdminGuard                        │  │
│  │            (All endpoints: role === 'OWNER')             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
        ┌────────────────────┴────────────────────┐
        ↓                                          ↓
  ┌──────────────┐                         ┌──────────────┐
  │  PrismaService                         │  AuditService│
  │  (Database)                            │  (Logging)   │
  └──────────────┘                         └──────────────┘
```

## Data Flow Diagram

### Creating a Tenant
```
Client Request (POST /owner/tenants)
         ↓
   OwnerController
         ↓
   TenantService.createTenant()
    ├─→ PrismaService (create Tenant)
    ├─→ Validate limits
    └─→ Initialize default permissions
         ↓
   AuditService.log() [TENANT_CREATED]
         ↓
   Return { success, tenant }
```

### Setting Permissions
```
Client Request (POST /owner/rbac/permissions)
         ↓
   OwnerController
         ↓
   PermissionService.setRolePermission()
    ├─→ Validate permissions format (READ,WRITE,DELETE)
    ├─→ PrismaService (create/update RolePermission)
    └─→ Return result
         ↓
   AuditService.log() [PERMISSION_GRANT]
         ↓
   Return { success, permission }
```

### Checking User Permission
```
Client Request (POST /owner/rbac/check)
         ↓
   OwnerController
         ↓
   PermissionService.checkPermission()
    ├─→ Query RolePermission table
    ├─→ Parse permissions string
    └─→ Return boolean (allowed)
         ↓
   Return { allowed, user, resource, action }
```

### Encrypting Payment Gateway
```
Client Request (POST /owner/settings/gateway)
         ↓
   OwnerController
         ↓
   GlobalSettingsService.setPaymentGatewayConfig()
    ├─→ Validate provider format (Stripe, Asaas, Efí, MonCash)
    ├─→ Encrypt API Key with AES-256-CBC
    ├─→ PrismaService (save to GlobalSettings)
    └─→ Return success
         ↓
   AuditService.log() [SETTING_UPDATED] (no encrypted values)
         ↓
   Return { success, provider }
```

### Getting Dashboard Metrics
```
Client Request (GET /owner/metrics/dashboard)
         ↓
   OwnerController
         ↓
   MetricsService.generateExecutiveDashboard()
    ├─→ getTotalActiveStudents() 
    │   └─→ COUNT users WHERE role=STUDENT, isActive=true
    ├─→ getTotalActiveTeachers()
    │   └─→ COUNT users WHERE role=TEACHER, isActive=true
    ├─→ getEnrollmentGrowth(12 months)
    │   └─→ FOR EACH month: COUNT students created
    ├─→ getAttendanceStatistics(30 days)
    │   └─→ GROUP by status (PRESENT, ABSENT, LATE)
    └─→ getGradeDistribution()
        └─→ BUCKET grades (0-20, 21-40, ..., 81-100)
         ↓
   Return { summary, enrollment, attendance, academics }
```

### Auditing Admin Action
```
Admin performs action (e.g., create tenant)
         ↓
   TenantService creates record
         ↓
   OwnerController calls AuditService.log({
     userId: req.user.id,
     action: 'TENANT_CREATED',
     resource: 'Tenant',
     resourceId: result.id,
     newValues: result,
     ipAddress: req.ip
   })
         ↓
   AuditService encrypts JSON payloads
         ↓
   PrismaService.auditLog.create({
     userId, action, resource, newValues, 
     ipAddress, userAgent, timestamp
   })
         ↓
   Immutable audit trail created
```

## Service Responsibilities

### TenantService
- **Create**: Validate, create Tenant, init default permissions
- **Update**: Update limits (maxStudents, storageLimit)
- **Configure**: Set white label (logo, colors, favicon)
- **Retrieve**: Get tenant details, usage metrics
- **Delete**: Soft delete with timestamp
- **List**: Pagination support

### PermissionService
- **Assign**: Create/update RolePermission entries
- **Query**: Get permissions for a role/school
- **Check**: Verify if user has permission for action
- **Revoke**: Deactivate permission
- **Matrix**: Return full permission table
- **Defaults**: Initialize standard role permissions

### GlobalSettingsService
- **Set**: Store key-value setting (with encryption)
- **Get**: Retrieve setting (auto-decrypt)
- **Encrypt**: AES-256-CBC for sensitive keys
- **Decrypt**: Reverse process on retrieval
- **Gateway**: Payment provider specific config
- **Validate**: Format checks per provider
- **Defaults**: Initialize system settings

### AuditService
- **Log**: Create audit entry with before/after values
- **Query**: Search with filters (user, resource, action, date)
- **Report**: Generate compliance reports
- **Timeline**: User activity history
- **Detect**: Find suspicious patterns
- **Export**: CSV download of audit trail
- **Archive**: Delete logs older than retention period

### MetricsService
- **Count**: Total students, teachers, classes
- **Trend**: Enrollment growth month-over-month %
- **Rate**: Default/overdue payment rate
- **Stats**: Attendance percentages
- **Distribution**: Grade buckets
- **Performance**: School scoring algorithm
- **Utilization**: Resource usage analysis

## Request/Response Flow

### All Tenant Operations
```
Request:
  POST /owner/tenants
  Authorization: Bearer TOKEN
  Content-Type: application/json
  {
    "name": "Lycée Toussaint",
    "email": "admin@lycee.ht",
    "maxStudents": 500,
    "storageLimitGB": 100
  }

Response:
  200 OK
  {
    "success": true,
    "tenant": {
      "id": "tenant-123",
      "name": "Lycée Toussaint",
      "maxStudents": 500,
      ...
    },
    "message": "Tenant created successfully"
  }

Audit Log:
  {
    "userId": "user-123",
    "action": "TENANT_CREATED",
    "resource": "Tenant",
    "resourceId": "tenant-123",
    "newValues": { ...tenant data },
    "ipAddress": "192.168.1.1",
    "timestamp": "2025-01-15T10:30:00Z"
  }
```

## Security Layers

```
┌─────────────────────────────────────────────────┐
│            Client Request                        │
├─────────────────────────────────────────────────┤
│            JWT Auth Guard                        │
│       (Token validation + expiration)            │
├─────────────────────────────────────────────────┤
│            SuperAdminGuard                       │
│       (Check: role === 'OWNER')                  │
├─────────────────────────────────────────────────┤
│            Controller Route Handler              │
├─────────────────────────────────────────────────┤
│            Service Business Logic                │
│  - Input validation                              │
│  - Permission checks                             │
│  - Data sanitization                             │
├─────────────────────────────────────────────────┤
│            Database (Prisma)                     │
│  - Query parameterization (SQL injection safe)  │
│  - Row-level encryption for sensitive fields    │
├─────────────────────────────────────────────────┤
│            Audit Logging                         │
│  - Immutable trail                               │
│  - Before/after value tracking                   │
│  - IP + User-Agent logging                       │
└─────────────────────────────────────────────────┘
```

## Error Handling Flow

```
Client Request (invalid input)
         ↓
   OwnerController validates
         ↓
   BadRequestException thrown
         ↓
   Global exception filter catches
         ↓
   Return 400 with error details
         ↓
   AuditService logs rejection (if provided in filter)
```

## Database Relationships

```
User ──────────────┐
                   ├─→ AuditLog (userId)
                   ├─→ Tenant (owner)
                   └─→ RolePermission (userId)

Tenant ────────────┐
                   ├─→ School (multiple)
                   ├─→ User (owner)
                   ├─→ RolePermission (schoolId)
                   └─→ TenantMetric

RolePermission ─→ Tenant (schoolId)

GlobalSettings ─→ (key-based, no FK)

AuditLog ────────→ User (userId)

TenantMetric ───→ Tenant
```

## Performance Considerations

1. **Pagination**: All list endpoints support skip/take (default 50)
2. **Indexing**: AuditLog indexed on (userId, resource, timestamp) for query performance
3. **Caching**: Metrics can be cached (recalculated on-demand)
4. **Batch Operations**: Permission bulk updates in single transaction
5. **Query Optimization**: Use findMany with select/include for partial data

## Testing Strategy

```
Unit Tests:
  ├─ TenantService: Create, update, delete, validation
  ├─ PermissionService: Grant, check, revoke, matrix
  ├─ GlobalSettingsService: Set, get, encrypt/decrypt
  ├─ AuditService: Log, query, export
  └─ MetricsService: Calculations, aggregations

Integration Tests:
  ├─ E2E tenant lifecycle
  ├─ RBAC permission flow
  ├─ Settings encryption verification
  ├─ Audit trail immutability
  └─ Metrics accuracy

Security Tests:
  ├─ SuperAdminGuard enforcement
  ├─ Permission verification
  ├─ Encryption/decryption
  └─ Suspicious activity detection
```

## Deployment Checklist

- [ ] Environment variables set (ENCRYPTION_KEY, DATABASE_URL)
- [ ] Prisma migration created: `npx prisma migrate dev --name "add_owner_module"`
- [ ] Seed data loaded (default permissions, settings)
- [ ] Database backups configured
- [ ] Audit log retention policy set (365 days)
- [ ] Encryption key rotated and secured in vault
- [ ] API documentation deployed
- [ ] Tests passing (unit + integration)
- [ ] Load testing for metrics endpoints
- [ ] Monitoring/alerting configured
