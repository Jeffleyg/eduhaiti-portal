import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { SyncRequestMiddleware } from "./middleware/sync-request.middleware"
import { AuditLogService } from "./services/audit-log.service"
import { ConflictResolverService } from "./services/conflict-resolver.service"
import { SyncController } from "./sync.controller"
import { SyncService } from "./sync.service"

@Module({
  imports: [PrismaModule],
  controllers: [SyncController],
  providers: [SyncService, ConflictResolverService, AuditLogService],
})
export class SyncModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SyncRequestMiddleware).forRoutes(
      { path: "sync/push", method: RequestMethod.POST },
      { path: "sync/pull", method: RequestMethod.POST },
    )
  }
}
