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
exports.GradesController = void 0;
const common_1 = require("@nestjs/common");
const grades_service_1 = require("./grades.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const roles_guard_1 = require("../common/guards/roles.guard");
let GradesController = class GradesController {
    gradesService;
    constructor(gradesService) {
        this.gradesService = gradesService;
    }
    async getMyGrades(req) {
        const userId = req.user?.sub;
        return this.gradesService.findByStudent(userId ?? "");
    }
    async getClassGrades(classId) {
        return this.gradesService.findByClass(classId);
    }
    async createGrade(body) {
        return this.gradesService.create(body.studentId, body.classId, body.subject, body.score, body.maxScore);
    }
};
exports.GradesController = GradesController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)("my-grades"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GradesController.prototype, "getMyGrades", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    (0, common_1.Get)("class/:classId"),
    __param(0, (0, common_1.Param)("classId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GradesController.prototype, "getClassGrades", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GradesController.prototype, "createGrade", null);
exports.GradesController = GradesController = __decorate([
    (0, common_1.Controller)("grades"),
    __metadata("design:paramtypes", [grades_service_1.GradesService])
], GradesController);
//# sourceMappingURL=grades.controller.js.map