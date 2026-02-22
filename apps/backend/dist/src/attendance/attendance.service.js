"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AttendanceService = class AttendanceService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByStudent(studentId) {
        return this.prisma.attendance.findMany({
            where: { studentId },
            include: { class: true },
        });
    }
    async findByClass(classId) {
        return this.prisma.attendance.findMany({
            where: { classId },
            include: { student: { select: { id: true, email: true, name: true } } },
            orderBy: { date: "desc" },
        });
    }
    async markAttendance(studentId, classId, date, status) {
        const existing = await this.prisma.attendance.findFirst({
            where: { studentId, classId, date: { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) } },
        });
        if (existing) {
            return this.prisma.attendance.update({
                where: { id: existing.id },
                data: { status },
            });
        }
        return this.prisma.attendance.create({
            data: { studentId, classId, date: new Date(date), status },
        });
    }
};
exports.AttendanceService = AttendanceService;
exports.AttendanceService = AttendanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AttendanceService);
//# sourceMappingURL=attendance.service.js.map