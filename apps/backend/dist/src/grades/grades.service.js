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
exports.GradesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let GradesService = class GradesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(payload) {
        const classData = await this.prisma.class.findUnique({
            where: { id: payload.classId },
            include: { series: true },
        });
        if (!classData) {
            throw new common_1.NotFoundException("Class not found");
        }
        const discipline = await this.prisma.discipline.findUnique({
            where: { id: payload.disciplineId },
        });
        if (!discipline || discipline.seriesId !== classData.seriesId) {
            throw new common_1.BadRequestException("Discipline does not belong to this class's series");
        }
        return this.prisma.grade.create({
            data: {
                studentId: payload.studentId,
                classId: payload.classId,
                disciplineId: payload.disciplineId,
                academicYearId: payload.academicYearId,
                score: payload.score,
                maxScore: payload.maxScore || 20,
                weight: payload.weight || 1.0,
                status: "DRAFT",
            },
            include: {
                student: { select: { id: true, name: true, email: true } },
                discipline: { select: { id: true, name: true } },
            },
        });
    }
    async update(gradeId, payload) {
        const existing = await this.prisma.grade.findUnique({
            where: { id: gradeId },
        });
        if (!existing) {
            throw new common_1.NotFoundException("Grade not found");
        }
        return this.prisma.grade.update({
            where: { id: gradeId },
            data: payload,
            include: {
                student: { select: { id: true, name: true } },
                discipline: { select: { id: true, name: true } },
            },
        });
    }
    async delete(gradeId) {
        const existing = await this.prisma.grade.findUnique({
            where: { id: gradeId },
        });
        if (!existing) {
            throw new common_1.NotFoundException("Grade not found");
        }
        await this.prisma.grade.delete({ where: { id: gradeId } });
        return { message: "Grade deleted successfully" };
    }
    async publishGrades(classId, disciplineId) {
        return this.prisma.grade.updateMany({
            where: {
                classId,
                disciplineId,
                status: "DRAFT",
            },
            data: { status: "PUBLISHED" },
        });
    }
    async findByStudent(studentId, academicYearId) {
        const where = { studentId };
        if (academicYearId) {
            where.academicYearId = academicYearId;
        }
        return this.prisma.grade.findMany({
            where,
            include: {
                class: { select: { id: true, name: true } },
                discipline: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async findByClass(classId, disciplineId) {
        const where = { classId };
        if (disciplineId) {
            where.disciplineId = disciplineId;
        }
        return this.prisma.grade.findMany({
            where,
            include: {
                student: { select: { id: true, email: true, name: true } },
                discipline: { select: { id: true, name: true } },
            },
            orderBy: [{ discipline: { name: "asc" } }, { student: { name: "asc" } }],
        });
    }
    async calculateClassAverage(classId, disciplineId) {
        const grades = await this.prisma.grade.findMany({
            where: {
                classId,
                disciplineId,
                status: "PUBLISHED",
            },
            select: { score: true, maxScore: true, weight: true },
        });
        if (grades.length === 0) {
            return { average: 0, count: 0 };
        }
        const totalWeightedScore = grades.reduce((sum, g) => sum + (g.score / g.maxScore) * g.weight, 0);
        const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0);
        return {
            average: (totalWeightedScore / totalWeight) * 20,
            count: grades.length,
        };
    }
    async getStudentReport(studentId, academicYearId) {
        const grades = await this.prisma.grade.findMany({
            where: {
                studentId,
                academicYearId,
                status: "PUBLISHED",
            },
            include: {
                discipline: { select: { id: true, name: true } },
                class: { select: { id: true, name: true } },
            },
            orderBy: { discipline: { name: "asc" } },
        });
        const summary = {};
        grades.forEach((grade) => {
            const key = grade.discipline.name;
            if (!summary[key]) {
                summary[key] = [];
            }
            summary[key].push({
                score: grade.score,
                maxScore: grade.maxScore,
                percentage: (grade.score / grade.maxScore) * 100,
            });
        });
        return {
            studentId,
            academicYearId,
            grades,
            summary,
        };
    }
    async listAcademicYearsForStudent(studentId) {
        const grades = await this.prisma.grade.findMany({
            where: {
                studentId,
                status: "PUBLISHED",
            },
            select: {
                academicYear: {
                    select: {
                        id: true,
                        year: true,
                        startDate: true,
                        endDate: true,
                        isActive: true,
                    },
                },
            },
            distinct: ["academicYearId"],
            orderBy: {
                academicYear: {
                    year: "desc",
                },
            },
        });
        return grades.map((item) => item.academicYear);
    }
};
exports.GradesService = GradesService;
exports.GradesService = GradesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GradesService);
//# sourceMappingURL=grades.service.js.map