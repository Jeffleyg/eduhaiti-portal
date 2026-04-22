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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
let AuthService = class AuthService {
    prisma;
    jwtService;
    configService;
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async requestCode(email) {
        const normalizedEmail = email.trim().toLowerCase();
        let user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    email: normalizedEmail,
                    role: client_1.Role.STUDENT,
                },
            });
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeHash = await bcryptjs_1.default.hash(code, 10);
        const ttlMinutes = Number(this.configService.get("AUTH_CODE_TTL_MINUTES") ?? 10);
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
        await this.prisma.loginCode.deleteMany({
            where: {
                email: normalizedEmail,
                consumedAt: null,
            },
        });
        await this.prisma.loginCode.create({
            data: {
                email: normalizedEmail,
                codeHash,
                expiresAt,
                userId: user.id,
            },
        });
        const response = { delivered: true };
        if ((this.configService.get("NODE_ENV") ?? "development") !== "production") {
            response.devCode = code;
        }
        return response;
    }
    async verifyCode(email, code) {
        const normalizedEmail = email.trim().toLowerCase();
        const loginCode = await this.prisma.loginCode.findFirst({
            where: {
                email: normalizedEmail,
                consumedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });
        if (!loginCode) {
            throw new common_1.UnauthorizedException("Invalid or expired code");
        }
        const isValid = await bcryptjs_1.default.compare(code, loginCode.codeHash);
        if (!isValid) {
            throw new common_1.UnauthorizedException("Invalid or expired code");
        }
        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: {
                id: true,
                email: true,
                role: true,
                name: true,
                isActive: true,
                mustChangePassword: true,
                enrollmentNumber: true,
            },
        });
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException("Account not available");
        }
        await this.prisma.loginCode.update({
            where: { id: loginCode.id },
            data: { consumedAt: new Date() },
        });
        const payload = { sub: user.id, email: user.email, role: user.role };
        const token = await this.jwtService.signAsync(payload);
        return {
            token,
            user,
        };
    }
    async getProfile(userId) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                role: true,
                name: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                address: true,
                gender: true,
                fatherName: true,
                motherName: true,
                isActive: true,
                mustChangePassword: true,
                enrollmentNumber: true,
                classesAttending: {
                    select: { id: true, name: true, level: true },
                },
                classesTeaching: {
                    select: { id: true, name: true, level: true },
                },
            },
        });
    }
    async updateProfile(userId, payload) {
        const existing = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, firstName: true, lastName: true },
        });
        if (!existing) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        const firstName = payload.firstName ?? existing.firstName ?? "";
        const lastName = payload.lastName ?? existing.lastName ?? "";
        const fullName = `${firstName} ${lastName}`.trim() || null;
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                firstName: payload.firstName,
                lastName: payload.lastName,
                name: fullName,
                dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : undefined,
                address: payload.address,
                gender: payload.gender,
                fatherName: payload.fatherName,
                motherName: payload.motherName,
            },
        });
        return this.getProfile(userId);
    }
    async login(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: {
                id: true,
                email: true,
                role: true,
                name: true,
                isActive: true,
                passwordHash: true,
                mustChangePassword: true,
                tempPasswordExpiresAt: true,
                enrollmentNumber: true,
            },
        });
        if (!user || !user.isActive || !user.passwordHash) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        if (user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date()) {
            throw new common_1.UnauthorizedException("Temporary password expired");
        }
        const isValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        const payload = { sub: user.id, email: user.email, role: user.role };
        const token = await this.jwtService.signAsync(payload);
        const responseUser = {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            isActive: user.isActive,
            mustChangePassword: user.mustChangePassword,
            enrollmentNumber: user.enrollmentNumber,
        };
        return { token, user: responseUser };
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, passwordHash: true },
        });
        if (!user || !user.passwordHash) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        const isValid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
                mustChangePassword: false,
                tempPasswordExpiresAt: null,
            },
        });
        return { success: true };
    }
    async signup(email, name, role) {
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existingUser) {
            throw new common_1.ConflictException("User already exists with this email");
        }
        const user = await this.prisma.user.create({
            data: {
                email: normalizedEmail,
                name,
                role,
            },
            select: { id: true, email: true, role: true, name: true, isActive: true },
        });
        return user;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map