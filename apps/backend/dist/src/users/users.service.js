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
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const email_service_1 = require("../common/services/email.service");
let UsersService = UsersService_1 = class UsersService {
    prisma;
    emailService;
    logger = new common_1.Logger(UsersService_1.name);
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
        return `${year}-${String(next).padStart(4, '0')}`;
    }
    generateTempPassword() {
        return (0, crypto_1.randomBytes)(6)
            .toString('base64')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 8);
    }
    async createStudent(payload, schoolId) {
        const normalizedEmail = payload.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existing) {
            throw new common_1.BadRequestException('User already exists with this email');
        }
        if (!payload.fatherName?.trim() && !payload.motherName?.trim()) {
            throw new common_1.BadRequestException('At least one parent/guardian name is required');
        }
        const tempPassword = this.generateTempPassword();
        const passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
        const enrollmentNumber = await this.generateEnrollmentNumber();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const fullName = `${payload.firstName} ${payload.lastName}`.trim();
        let resolvedSchoolId = schoolId;
        if (payload.classId) {
            const classExists = await this.prisma.class.findUnique({
                where: { id: payload.classId },
                select: { id: true, academicYear: { select: { schoolId: true } } },
            });
            if (!classExists) {
                throw new common_1.BadRequestException('Class not found');
            }
            resolvedSchoolId ??= classExists.academicYear.schoolId;
        }
        const user = await this.prisma.$transaction(async (tx) => {
            return tx.user.create({
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
                    schoolId: resolvedSchoolId,
                    passwordHash,
                    mustChangePassword: true,
                    tempPasswordExpiresAt: expiresAt,
                    role: client_1.Role.STUDENT,
                    ...(payload.classId && {
                        classesAttending: { connect: [{ id: payload.classId }] },
                    }),
                },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    name: true,
                    enrollmentNumber: true,
                },
            });
        });
        try {
            await this.emailService.sendTempPasswordEmail(normalizedEmail, tempPassword, expiresAt);
        }
        catch (err) {
            this.logger.warn(`Failed to send temp password email to ${normalizedEmail}: ${err instanceof Error ? err.message : String(err)}`);
        }
        return user;
    }
    async createTeacher(payload, schoolId) {
        const normalizedEmail = payload.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existing) {
            throw new common_1.BadRequestException('User already exists with this email');
        }
        const tempPassword = this.generateTempPassword();
        const passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
        const enrollmentNumber = await this.generateEnrollmentNumber();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const fullName = `${payload.firstName} ${payload.lastName}`.trim();
        let resolvedSchoolId = schoolId;
        if (!resolvedSchoolId && payload.classIds && payload.classIds.length > 0) {
            const firstClass = await this.prisma.class.findFirst({
                where: { id: { in: payload.classIds } },
                select: { academicYear: { select: { schoolId: true } } },
            });
            resolvedSchoolId = firstClass?.academicYear.schoolId;
        }
        if (!resolvedSchoolId && payload.newClasses && payload.newClasses.length > 0) {
            const firstAcademicYearId = payload.newClasses[0].academicYearId;
            if (firstAcademicYearId) {
                const academicYear = await this.prisma.academicYear.findUnique({
                    where: { id: firstAcademicYearId },
                    select: { schoolId: true },
                });
                resolvedSchoolId = academicYear?.schoolId;
            }
        }
        const user = await this.prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
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
                    schoolId: resolvedSchoolId,
                    passwordHash,
                    mustChangePassword: true,
                    tempPasswordExpiresAt: expiresAt,
                    role: client_1.Role.TEACHER,
                    subjects: payload.subjects ?? [],
                },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    name: true,
                    enrollmentNumber: true,
                },
            });
            if (payload.classIds && payload.classIds.length > 0) {
                await tx.class.updateMany({
                    where: { id: { in: payload.classIds } },
                    data: { teacherId: created.id },
                });
            }
            if (payload.newClasses && payload.newClasses.length > 0) {
                const defaultAcademicYear = await tx.academicYear.findFirst();
                const defaultSeries = await tx.series.findFirst();
                if (!defaultAcademicYear) {
                    throw new common_1.BadRequestException('No academic year found in database');
                }
                for (const newClass of payload.newClasses) {
                    const yearId = newClass.academicYearId ?? defaultAcademicYear.id;
                    let seriesId = newClass.seriesId ?? undefined;
                    if (!seriesId) {
                        const found = await tx.series.findFirst({ where: { academicYearId: yearId } });
                        if (found) {
                            seriesId = found.id;
                        }
                        else {
                            const seriesName = newClass.level ?? `${created.name ?? 'General'} Series`;
                            const createdSeries = await tx.series.create({
                                data: { name: seriesName, academicYearId: yearId },
                            });
                            seriesId = createdSeries.id;
                        }
                    }
                    await tx.class.create({
                        data: {
                            name: newClass.name,
                            level: newClass.level ?? '3eme',
                            teacherId: created.id,
                            academicYearId: yearId,
                            seriesId,
                        },
                    });
                }
            }
            return created;
        });
        try {
            await this.emailService.sendTempPasswordEmail(normalizedEmail, tempPassword, expiresAt);
        }
        catch (err) {
            this.logger.warn(`Failed to send temp password email to ${normalizedEmail}: ${err instanceof Error ? err.message : String(err)}`);
        }
        return user;
    }
    async resendTempPassword(email) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, email: true, role: true, isActive: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (!user.isActive) {
            throw new common_1.BadRequestException('User is inactive');
        }
        if (user.role !== client_1.Role.STUDENT && user.role !== client_1.Role.TEACHER) {
            throw new common_1.BadRequestException('Temporary password can only be resent to students or teachers');
        }
        const tempPassword = this.generateTempPassword();
        const passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: user.id },
                data: {
                    passwordHash,
                    mustChangePassword: true,
                    tempPasswordExpiresAt: expiresAt,
                },
            });
            await this.emailService.sendTempPasswordEmail(user.email, tempPassword, expiresAt);
        });
        return {
            success: true,
            email: user.email,
            expiresAt,
        };
    }
    async findAllStudents(schoolId) {
        return this.prisma.user.findMany({
            where: {
                role: client_1.Role.STUDENT,
                ...(schoolId
                    ? {
                        OR: [
                            { schoolId },
                            {
                                classesAttending: {
                                    some: { academicYear: { schoolId } },
                                },
                            },
                        ],
                    }
                    : {}),
            },
            select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
                fatherName: true,
                motherName: true,
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
            orderBy: { name: 'asc' },
        });
    }
    async findAllTeachers(schoolId) {
        return this.prisma.user.findMany({
            where: {
                role: client_1.Role.TEACHER,
                ...(schoolId
                    ? {
                        OR: [
                            { schoolId },
                            {
                                classesTeaching: {
                                    some: { academicYear: { schoolId } },
                                },
                            },
                        ],
                    }
                    : {}),
            },
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
            orderBy: { name: 'asc' },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService])
], UsersService);
//# sourceMappingURL=users.service.js.map