import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { AuthModule } from "./auth/auth.module"
import { PrismaModule } from "./prisma/prisma.module"
import { UsersModule } from "./users/users.module"
import { ClassesModule } from "./classes/classes.module"
import { GradesModule } from "./grades/grades.module"
import { AttendanceModule } from "./attendance/attendance.module"
import { MessagesModule } from "./messages/messages.module"
import { ResourcesModule } from "./resources/resources.module"
import { AssignmentsModule } from "./assignments/assignments.module"
import { AnnouncementsModule } from "./announcements/announcements.module"
import { SyncModule } from "./sync/sync.module"
import { HybridGatewayModule } from "./hybrid-gateway/hybrid-gateway.module"
import { HealthModule } from "./health/health.module"
import { FinanceIntegrationModule } from "./finance-integration/finance-integration.module"
import { ContentDeliveryModule } from "./content-delivery/content-delivery.module"
import { AnalyticsModule } from "./analytics/analytics.module"
import { AcademicPeriodsModule } from "./academic-periods/academic-periods.module"
import { AcademicSettingsModule } from "./academic-settings/academic-settings.module"
import { AcademicRequestsModule } from "./academic-requests/academic-requests.module"
import { DisciplinesModule } from "./disciplines/disciplines.module"
import { ForumsModule } from "./forums/forums.module"
import { FamilyAccessModule } from "./family-access/family-access.module"
import { ScorecardsModule } from "./scorecards/scorecards.module"
import { InventoryModule } from "./inventory/inventory.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ClassesModule,
    GradesModule,
    AttendanceModule,
    MessagesModule,
    ResourcesModule,
    AssignmentsModule,
    AnnouncementsModule,
    SyncModule,
    HybridGatewayModule,
    HealthModule,
    FinanceIntegrationModule,
    ContentDeliveryModule,
    AnalyticsModule,
    AcademicPeriodsModule,
    AcademicSettingsModule,
    AcademicRequestsModule,
    DisciplinesModule,
    ForumsModule,
    FamilyAccessModule,
    ScorecardsModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
