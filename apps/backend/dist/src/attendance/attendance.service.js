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
    async markAttendance(payload) {
        const student = await this.prisma.user.findUnique({
            where: { id: payload.studentId },
        });
        if (!student) {
            throw new common_1.NotFoundException("Student not found");
        }
        const classData = await this.prisma.class.findUnique({
            where: { id: payload.classId },
        });
        if (!classData) {
            throw new common_1.NotFoundException("Class not found");
        }
        const startOfDay = new Date(payload.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(payload.date);
        endOfDay.setHours(23, 59, 59, 999);
        const existing = await this.prisma.attendance.findFirst({
            where: {
                studentId: payload.studentId,
                classId: payload.classId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
        });
        if (existing) {
            return this.prisma.attendance.update({
                where: { id: existing.id },
                data: {
                    status: payload.status,
                    remarks: payload.remarks,
                },
                include: {
                    student: { select: { id: true, name: true } },
                    class: { select: { id: true, name: true } },
                },
            });
        }
        return this.prisma.attendance.create({
            data: {
                studentId: payload.studentId,
                classId: payload.classId,
                date: new Date(payload.date),
                status: payload.status,
                remarks: payload.remarks,
            },
            include: {
                student: { select: { id: true, name: true } },
                class: { select: { id: true, name: true } },
            },
        });
    }
    async findByStudent(studentId, startDate, endDate) {
        const where = { studentId };
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.gte = startDate;
            if (endDate)
                where.date.lte = endDate;
        }
        return this.prisma.attendance.findMany({
            where,
            include: {
                class: { select: { id: true, name: true } },
            },
            orderBy: { date: "desc" },
        });
    }
    async findByClass(classId, date) {
        const where = { classId };
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            where.date = {
                gte: startOfDay,
                lte: endOfDay,
            };
        }
        return this.prisma.attendance.findMany({
            where,
            include: {
                student: {
                    select: { id: true, email: true, name: true, enrollmentNumber: true },
                },
            },
            orderBy: { date: "desc" },
        });
    }
    async getStudentAttendanceStats(studentId, classId) {
        const records = await this.prisma.attendance.findMany({
            where: { studentId, classId },
            select: { status: true },
        });
        const stats = {
            total: records.length,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
        };
        records.forEach((r) => {
            if (r.status === "PRESENT")
                stats.present++;
            else if (r.status === "ABSENT")
                stats.absent++;
            else if (r.status === "LATE")
                stats.late++;
            else if (r.status === "EXCUSED")
                stats.excused++;
        });
        const absencePercentage = stats.total > 0 ? (stats.absent / stats.total) * 100 : 0;
        return {
            ...stats,
            absencePercentage,
            isAtRisk: absencePercentage > 25,
        };
    }
    async getClassAttendanceReport(classId) {
        const students = await this.prisma.user.findMany({
            where: {
                classesAttending: {
                    some: { id: classId },
                },
            },
            select: { id: true, name: true, email: true },
        });
        const report = await Promise.all(students.map(async (student) => {
            const stats = await this.getStudentAttendanceStats(student.id, classId);
            return {
                student,
                ...stats,
            };
        }));
        return report;
    }
    async delete(attendanceId) {
        const existing = await this.prisma.attendance.findUnique({
            where: { id: attendanceId },
        });
        if (!existing) {
            throw new common_1.NotFoundException("Attendance record not found");
        }
        await this.prisma.attendance.delete({ where: { id: attendanceId } });
        return { message: "Attendance record deleted" };
    }
};
exports.AttendanceService = AttendanceService;
exports.AttendanceService = AttendanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AttendanceService);
//# sourceMappingURL=attendance.service.js.map