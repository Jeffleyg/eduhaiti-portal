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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
