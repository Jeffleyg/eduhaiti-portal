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
exports.ClassesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let ClassesService = class ClassesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(payload) {
        const series = await this.prisma.series.findUnique({
            where: { id: payload.seriesId },
        });
        if (!series || series.academicYearId !== payload.academicYearId) {
            throw new common_1.BadRequestException("Series does not belong to the specified academic year");
        }
        const existing = await this.prisma.class.findFirst({
            where: {
                academicYearId: payload.academicYearId,
                seriesId: payload.seriesId,
                name: payload.name,
            },
        });
        if (existing) {
            throw new common_1.BadRequestException("Class with this name already exists in this series");
        }
        return this.prisma.class.create({
            data: {
                name: payload.name,
                level: payload.level || series.name,
                academicYearId: payload.academicYearId,
                seriesId: payload.seriesId,
                teacherId: payload.teacherId,
                maxStudents: payload.maxStudents || 30,
            },
            include: {
                teacher: { select: { id: true, name: true, email: true } },
                series: { select: { id: true, name: true } },
                students: { select: { id: true, name: true } },
            },
        });
    }
    async update(classId, payload) {
        const existing = await this.prisma.class.findUnique({
            where: { id: classId },
        });
        if (!existing) {
            throw new common_1.NotFoundException("Class not found");
        }
        if (payload.name && payload.name !== existing.name) {
            const duplicate = await this.prisma.class.findFirst({
                where: {
                    id: { not: classId },
                    academicYearId: existing.academicYearId,
                    seriesId: existing.seriesId,
                    name: payload.name,
                },
            });
            if (duplicate) {
                throw new common_1.BadRequestException("Class with this name already exists in this series");
            }
        }
        if (payload.teacherId) {
            const teacher = await this.prisma.user.findUnique({
                where: { id: payload.teacherId },
                select: { id: true, role: true },
            });
            if (!teacher || teacher.role !== client_1.Role.TEACHER) {
                throw new common_1.BadRequestException("Teacher not found");
            }
        }
        if (payload.maxStudents !== undefined && payload.maxStudents < 1) {
            throw new common_1.BadRequestException("maxStudents must be greater than zero");
        }
        return this.prisma.class.update({
            where: { id: classId },
            data: payload,
            include: {
                teacher: { select: { id: true, name: true, email: true } },
                students: { select: { id: true, name: true } },
            },
        });
    }
    async delete(classId) {
        const existing = await this.prisma.class.findUnique({
            where: { id: classId },
            include: { students: { select: { id: true } } },
        });
        if (!existing) {
            throw new common_1.NotFoundException("Class not found");
        }
        if (existing.students && existing.students.length > 0) {
            throw new common_1.BadRequestException("Cannot delete class with enrolled students");
        }
        await this.prisma.class.delete({
            where: { id: classId },
        });
        return { message: "Class deleted successfully" };
    }
    async enrollStudent(classId, studentId) {
        const classExists = await this.prisma.class.findUnique({
            where: { id: classId },
            include: { students: { select: { id: true } } },
        });
        if (!classExists) {
            throw new common_1.NotFoundException("Class not found");
        }
        if (classExists.maxStudents &&
            classExists.students.length >= classExists.maxStudents) {
            throw new common_1.BadRequestException("Class is full");
        }
        if (classExists.students.some((s) => s.id === studentId)) {
            throw new common_1.BadRequestException("Student already enrolled in this class");
        }
        return this.prisma.class.update({
            where: { id: classId },
            data: {
                students: {
                    connect: { id: studentId },
                },
            },
            include: {
                students: { select: { id: true, name: true, email: true } },
            },
        });
    }
    async removeStudent(classId, studentId) {
        return this.prisma.class.update({
            where: { id: classId },
            data: {
                students: {
                    disconnect: { id: studentId },
                },
            },
            include: {
                students: { select: { id: true, name: true } },
            },
        });
    }
    async findByTeacher(teacherId) {
        return this.prisma.class.findMany({
            where: { teacherId },
            include: {
                teacher: { select: { id: true, name: true } },
                students: { select: { id: true, email: true, name: true } },
                series: { select: { id: true, name: true } },
                academicYear: { select: { id: true, year: true } },
            },
            orderBy: { name: "asc" },
        });
    }
    async findAll(academicYearId, seriesId) {
        const where = {};
        if (academicYearId) {
            where.academicYearId = academicYearId;
        }
        if (seriesId) {
            where.seriesId = seriesId;
        }
        return this.prisma.class.findMany({
            where,
            include: {
                teacher: { select: { id: true, name: true, email: true } },
                students: { select: { id: true, name: true } },
                series: { select: { id: true, name: true } },
                academicYear: { select: { year: true } },
            },
            orderBy: [{ academicYear: { year: "desc" } }, { name: "asc" }],
        });
    }
    async findById(classId) {
        const classData = await this.prisma.class.findUnique({
            where: { id: classId },
            include: {
                teacher: { select: { id: true, email: true, name: true } },
                students: { select: { id: true, email: true, name: true } },
                series: { select: { id: true, name: true } },
                grades: {
                    select: {
                        id: true,
                        studentId: true,
                        score: true,
                        disciplineId: true,
                    },
                },
            },
        });
        if (!classData) {
            throw new common_1.NotFoundException("Class not found");
        }
        return classData;
    }
    async findByStudent(studentId) {
        return this.prisma.class.findMany({
            where: { students: { some: { id: studentId } } },
            include: {
                teacher: { select: { id: true, name: true } },
                series: { select: { id: true, name: true } },
                academicYear: { select: { id: true, year: true } },
            },
            orderBy: { name: "asc" },
        });
    }
    async listAcademicYears() {
        return this.prisma.academicYear.findMany({
            select: { id: true, year: true, startDate: true, endDate: true, isActive: true },
            orderBy: { year: "desc" },
        });
    }
    async listSeries(academicYearId) {
        return this.prisma.series.findMany({
            where: academicYearId ? { academicYearId } : undefined,
            select: {
                id: true,
                name: true,
                academicYearId: true,
                academicYear: { select: { id: true, year: true } },
            },
            orderBy: [{ academicYear: { year: "desc" } }, { name: "asc" }],
        });
    }
};
exports.ClassesService = ClassesService;
exports.ClassesService = ClassesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ClassesService);
//# sourceMappingURL=classes.service.js.map