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
exports.AssignmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AssignmentsService = class AssignmentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(classId, title, description, dueDate, filePath, createdById) {
        return this.prisma.assignment.create({
            data: {
                classId,
                title,
                description,
                dueDate,
                filePath,
                createdById,
            },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
                submissions: {
                    include: {
                        student: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
        });
    }
    async findByClass(classId) {
        return this.prisma.assignment.findMany({
            where: { classId },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
                submissions: {
                    include: {
                        student: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
            orderBy: { dueDate: "asc" },
        });
    }
    async findById(assignmentId) {
        return this.prisma.assignment.findUnique({
            where: { id: assignmentId },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
                submissions: {
                    include: {
                        student: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
        });
    }
    async findForStudent(studentId) {
        const classes = await this.prisma.class.findMany({
            where: {
                students: {
                    some: {
                        id: studentId,
                    },
                },
            },
            select: { id: true },
        });
        const classIds = classes.map((c) => c.id);
        return this.prisma.assignment.findMany({
            where: {
                classId: { in: classIds },
            },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
                submissions: {
                    where: { studentId },
                    include: {
                        student: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
            orderBy: { dueDate: "asc" },
        });
    }
    async submitAssignment(assignmentId, studentId, filePath) {
        return this.prisma.assignmentSubmission.upsert({
            where: {
                assignmentId_studentId: {
                    assignmentId,
                    studentId,
                },
            },
            update: {
                filePath,
                submittedAt: new Date(),
            },
            create: {
                assignmentId,
                studentId,
                filePath,
            },
            include: {
                student: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
    }
    async update(assignmentId, title, description, dueDate) {
        return this.prisma.assignment.update({
            where: { id: assignmentId },
            data: {
                title,
                description,
                dueDate,
            },
        });
    }
    async gradeSubmission(submissionId, grade, feedback) {
        return this.prisma.assignmentSubmission.update({
            where: { id: submissionId },
            data: {
                grade,
                feedback,
            },
        });
    }
    async delete(assignmentId) {
        return this.prisma.assignment.delete({
            where: { id: assignmentId },
        });
    }
};
exports.AssignmentsService = AssignmentsService;
exports.AssignmentsService = AssignmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AssignmentsService);
//# sourceMappingURL=assignments.service.js.map