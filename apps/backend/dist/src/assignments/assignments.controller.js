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
exports.AssignmentsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/guards/roles.guard");
const assignments_service_1 = require("./assignments.service");
const client_1 = require("@prisma/client");
const uploadDir = "uploads";
let AssignmentsController = class AssignmentsController {
    assignmentsService;
    constructor(assignmentsService) {
        this.assignmentsService = assignmentsService;
    }
    async getByClass(classId) {
        return this.assignmentsService.findByClass(classId);
    }
    async getMyAssignments(req) {
        return this.assignmentsService.findForStudent(req.user.sub);
    }
    async createAssignment(classId, file, body, req) {
        const filePath = file ? `uploads/${file.filename}` : undefined;
        const dueDate = new Date(body.dueDate);
        return this.assignmentsService.create(classId, body.title, body.description, dueDate, filePath, req.user.sub);
    }
    async submitAssignment(assignmentId, file, req) {
        if (!file) {
            throw new common_1.BadRequestException("No file uploaded");
        }
        const filePath = `uploads/${file.filename}`;
        return this.assignmentsService.submitAssignment(assignmentId, req.user.sub, filePath);
    }
    async gradeSubmission(submissionId, body) {
        return this.assignmentsService.gradeSubmission(submissionId, body.grade, body.feedback);
    }
    async deleteAssignment(assignmentId) {
        return this.assignmentsService.delete(assignmentId);
    }
};
exports.AssignmentsController = AssignmentsController;
__decorate([
    (0, common_1.Get)("class/:classId"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)("classId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AssignmentsController.prototype, "getByClass", null);
__decorate([
    (0, common_1.Get)("my-assignments"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AssignmentsController.prototype, "getMyAssignments", null);
__decorate([
    (0, common_1.Post)("create/:classId"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file", {
        storage: (0, multer_1.diskStorage)({
            destination: uploadDir,
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
                cb(null, `${uniqueSuffix}-${file.originalname}`);
            },
        }),
        fileFilter: (req, file, cb) => {
            if (file) {
                cb(null, true);
            }
            else {
                cb(null, true);
            }
        },
    })),
    __param(0, (0, common_1.Param)("classId")),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AssignmentsController.prototype, "createAssignment", null);
__decorate([
    (0, common_1.Post)(":assignmentId/submit"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file", {
        storage: (0, multer_1.diskStorage)({
            destination: uploadDir,
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
                cb(null, `submission-${uniqueSuffix}-${file.originalname}`);
            },
        }),
    })),
    __param(0, (0, common_1.Param)("assignmentId")),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AssignmentsController.prototype, "submitAssignment", null);
__decorate([
    (0, common_1.Put)(":assignmentId/grade/:submissionId"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)("submissionId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AssignmentsController.prototype, "gradeSubmission", null);
__decorate([
    (0, common_1.Delete)(":assignmentId"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)("assignmentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AssignmentsController.prototype, "deleteAssignment", null);
exports.AssignmentsController = AssignmentsController = __decorate([
    (0, common_1.Controller)("assignments"),
    __metadata("design:paramtypes", [assignments_service_1.AssignmentsService])
], AssignmentsController);
//# sourceMappingURL=assignments.controller.js.map