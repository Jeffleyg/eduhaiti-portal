"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/guards/roles.guard");
const resources_service_1 = require("./resources.service");
const client_1 = require("@prisma/client");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
let ResourcesController = class ResourcesController {
    resourcesService;
    constructor(resourcesService) {
        this.resourcesService = resourcesService;
    }
    async getByClass(classId) {
        return this.resourcesService.findByClass(classId);
    }
    async uploadResource(classId, file, body, req) {
        if (!file) {
            throw new common_1.BadRequestException("No file uploaded");
        }
        const fileType = path.extname(file.originalname).toLowerCase().replace(".", "");
        const filePath = `uploads/${file.filename}`;
        return this.resourcesService.create(classId, body.title, body.description, filePath, fileType, req.user.sub);
    }
    async deleteResource(resourceId) {
        return this.resourcesService.delete(resourceId);
    }
};
exports.ResourcesController = ResourcesController;
__decorate([
    (0, common_1.Get)("class/:classId"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)("classId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "getByClass", null);
__decorate([
    (0, common_1.Post)("upload/:classId"),
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
    })),
    __param(0, (0, common_1.Param)("classId")),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "uploadResource", null);
__decorate([
    (0, common_1.Delete)(":resourceId"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.TEACHER, client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)("resourceId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ResourcesController.prototype, "deleteResource", null);
exports.ResourcesController = ResourcesController = __decorate([
    (0, common_1.Controller)("resources"),
    __metadata("design:paramtypes", [resources_service_1.ResourcesService])
], ResourcesController);
//# sourceMappingURL=resources.controller.js.map