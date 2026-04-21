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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const email_service_1 = require("../common/services/email.service");
let UsersService = class UsersService {
    prisma;
    emailService;
    constructor(prisma, emailService) {
        this.prisma = prisma;
        this.emailService = emailService;
    }
    findById(userId) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, role: true, isActive: true },
        });
    }
    async generateEnrollmentNumber() {
        const year = new Date().getFullYear();
        const count = await this.prisma.user.count({
            where: { enrollmentNumber: { startsWith: `${year}-` } },
        });
        const next = count + 1;
        return `${year}-${String(next).padStart(4, "0")}`;
    }
    generateTempPassword() {
        return (0, crypto_1.randomBytes)(6).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
    }
    async createStudent(payload) {
        const normalizedEmail = payload.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            throw new common_1.BadRequestException("User already exists with this email");
        }
        const tempPassword = this.generateTempPassword();
        const passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
        const enrollmentNumber = await this.generateEnrollmentNumber();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const fullName = `${payload.firstName} ${payload.lastName}`.trim();
        if (payload.classId) {
            const classExists = await this.prisma.class.findUnique({ where: { id: payload.classId } });
            if (!classExists) {
                throw new common_1.BadRequestException("Class not found");
            }
        }
        const user = await this.prisma.user.create({
            data: {
                email: normalizedEmail,
                name: fullName,
                firstName: payload.firstName,
                lastName: payload.lastName,
                dateOfBirth: new Date(payload.dateOfBirth),
                address: payload.address,
                gender: payload.gender,
                fatherName: payload.fatherName,
                motherName: payload.motherName,
                enrollmentNumber,
                passwordHash,
                mustChangePassword: true,
                tempPasswordExpiresAt: expiresAt,
                role: client_1.Role.STUDENT,
                ...(payload.classId && { classesAttending: { connect: [{ id: payload.classId }] } }),
            },
            select: { id: true, email: true, role: true, name: true, enrollmentNumber: true },
        });
        await this.emailService.sendTempPasswordEmail(normalizedEmail, tempPassword, expiresAt);
        return user;
    }
    async createTeacher(payload) {
        const normalizedEmail = payload.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            throw new common_1.BadRequestException("User already exists with this email");
        }
        const tempPassword = this.generateTempPassword();
        const passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
        const enrollmentNumber = await this.generateEnrollmentNumber();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const fullName = `${payload.firstName} ${payload.lastName}`.trim();
        const user = await this.prisma.user.create({
            data: {
                email: normalizedEmail,
                name: fullName,
                firstName: payload.firstName,
                lastName: payload.lastName,
                dateOfBirth: new Date(payload.dateOfBirth),
                address: payload.address,
                gender: payload.gender,
                fatherName: payload.fatherName,
                motherName: payload.motherName,
                enrollmentNumber,
                passwordHash,
                mustChangePassword: true,
                tempPasswordExpiresAt: expiresAt,
                role: client_1.Role.TEACHER,
                subjects: payload.subjects ?? [],
            },
            select: { id: true, email: true, role: true, name: true, enrollmentNumber: true },
        });
        if (payload.classIds && payload.classIds.length > 0) {
            await this.prisma.class.updateMany({
                where: { id: { in: payload.classIds } },
                data: { teacherId: user.id },
            });
        }
        if (payload.newClasses && payload.newClasses.length > 0) {
            const defaultAcademicYear = await this.prisma.academicYear.findFirst();
            const defaultSeries = await this.prisma.series.findFirst();
            if (!defaultAcademicYear || !defaultSeries) {
                throw new common_1.BadRequestException("No academic year or series found in database");
            }
            for (const newClass of payload.newClasses) {
                await this.prisma.class.create({
                    data: {
                        name: newClass.name,
                        level: newClass.level ?? "3eme",
                        teacherId: user.id,
                        academicYearId: newClass.academicYearId ?? defaultAcademicYear.id,
                        seriesId: newClass.seriesId ?? defaultSeries.id,
                    },
                });
            }
        }
        await this.emailService.sendTempPasswordEmail(normalizedEmail, tempPassword, expiresAt);
        return user;
    }
    async findAllStudents() {
        return this.prisma.user.findMany({
            where: { role: client_1.Role.STUDENT },
            select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
                enrollmentNumber: true,
                classesAttending: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
                isActive: true,
                createdAt: true,
            },
            orderBy: { name: "asc" },
        });
    }
    async findAllTeachers() {
        return this.prisma.user.findMany({
            where: { role: client_1.Role.TEACHER },
            select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
                enrollmentNumber: true,
                subjects: true,
                classesTeaching: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
                isActive: true,
                createdAt: true,
            },
            orderBy: { name: "asc" },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService])
], UsersService);
//# sourceMappingURL=users.service.js.map