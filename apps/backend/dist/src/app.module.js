"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("./auth/auth.module");
const prisma_module_1 = require("./prisma/prisma.module");
const users_module_1 = require("./users/users.module");
const classes_module_1 = require("./classes/classes.module");
const grades_module_1 = require("./grades/grades.module");
const attendance_module_1 = require("./attendance/attendance.module");
const messages_module_1 = require("./messages/messages.module");
const resources_module_1 = require("./resources/resources.module");
const assignments_module_1 = require("./assignments/assignments.module");
const announcements_module_1 = require("./announcements/announcements.module");
const sync_module_1 = require("./sync/sync.module");
const hybrid_gateway_module_1 = require("./hybrid-gateway/hybrid-gateway.module");
const health_module_1 = require("./health/health.module");
const finance_integration_module_1 = require("./finance-integration/finance-integration.module");
const content_delivery_module_1 = require("./content-delivery/content-delivery.module");
const analytics_module_1 = require("./analytics/analytics.module");
const academic_periods_module_1 = require("./academic-periods/academic-periods.module");
const academic_settings_module_1 = require("./academic-settings/academic-settings.module");
const academic_requests_module_1 = require("./academic-requests/academic-requests.module");
const disciplines_module_1 = require("./disciplines/disciplines.module");
const forums_module_1 = require("./forums/forums.module");
const family_access_module_1 = require("./family-access/family-access.module");
const scorecards_module_1 = require("./scorecards/scorecards.module");
const inventory_module_1 = require("./inventory/inventory.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            prisma_module_1.PrismaModule,
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
            classes_module_1.ClassesModule,
            grades_module_1.GradesModule,
            attendance_module_1.AttendanceModule,
            messages_module_1.MessagesModule,
            resources_module_1.ResourcesModule,
            assignments_module_1.AssignmentsModule,
            announcements_module_1.AnnouncementsModule,
            sync_module_1.SyncModule,
            hybrid_gateway_module_1.HybridGatewayModule,
            health_module_1.HealthModule,
            finance_integration_module_1.FinanceIntegrationModule,
            content_delivery_module_1.ContentDeliveryModule,
            analytics_module_1.AnalyticsModule,
            academic_periods_module_1.AcademicPeriodsModule,
            academic_settings_module_1.AcademicSettingsModule,
            academic_requests_module_1.AcademicRequestsModule,
            disciplines_module_1.DisciplinesModule,
            forums_module_1.ForumsModule,
            family_access_module_1.FamilyAccessModule,
            scorecards_module_1.ScorecardsModule,
            inventory_module_1.InventoryModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map