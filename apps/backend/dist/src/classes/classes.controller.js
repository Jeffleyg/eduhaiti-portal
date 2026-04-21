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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassesController = void 0;
const common_1 = require("@nestjs/common");
const classes_service_1 = require("./classes.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
let ClassesController = class ClassesController {
    classesService;
    constructor(classesService) {
        this.classesService = classesService;
    }
    async createClass(payload) {
        return this.classesService.create(payload);
    }
    async updateClass(classId, payload) {
        return this.classesService.update(classId, payload);
    }
    async deleteClass(classId) {
        return this.classesService.delete(classId);
    }
    async enrollStudent(classId, payload) {
        return this.classesService.enrollStudent(classId, payload.studentId);
    }
    async removeStudent(classId, studentId) {
        return this.classesService.removeStudent(classId, studentId);
    }
    async getAllClasses(academicYearId, seriesId) {
        return this.classesService.findAll(academicYearId, seriesId);
    }
    async getAcademicYears() {
        return this.classesService.listAcademicYears();
    }
    async getSeries(academicYearId) {
        return this.classesService.listSeries(academicYearId);
    }
    async getMyClasses(req) {
        const userId = req.user?.sub;
        const role = req.user?.role;
        if (role === "TEACHER") {
            return this.classesService.findByTeacher(userId ?? "");
        }
        else if (role === "STUDENT") {
            return this.classesService.findByStudent(userId ?? "");
        }
        return [];
    }
    async getClass(classId) {
        return this.classesService.findById(classId);
    }
};
exports.ClassesController = ClassesController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "createClass", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Put)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "updateClass", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Delete)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "deleteClass", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Post)(":id/enroll"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "enrollStudent", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Delete)(":id/students/:studentId"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "removeStudent", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)("academicYearId")),
    __param(1, (0, common_1.Query)("seriesId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "getAllClasses", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Get)("meta/academic-years"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "getAcademicYears", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Get)("meta/series"),
    __param(0, (0, common_1.Query)("academicYearId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "getSeries", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)("my-classes"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "getMyClasses", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "getClass", null);
exports.ClassesController = ClassesController = __decorate([
    (0, common_1.Controller)("admin/classes"),
    __metadata("design:paramtypes", [classes_service_1.ClassesService])
], ClassesController);
//# sourceMappingURL=classes.controller.js.map