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
exports.ResourcesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ResourcesService = class ResourcesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(classId, title, description, filePath, fileType, uploadedById) {
        return this.prisma.resource.create({
            data: {
                classId,
                title,
                description,
                filePath,
                fileType,
                uploadedById,
            },
            include: {
                uploadedBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
    }
    async findByClass(classId) {
        return this.prisma.resource.findMany({
            where: { classId },
            include: {
                uploadedBy: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async findById(resourceId) {
        return this.prisma.resource.findUnique({
            where: { id: resourceId },
            include: {
                uploadedBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
    }
    async delete(resourceId) {
        return this.prisma.resource.delete({
            where: { id: resourceId },
        });
    }
};
exports.ResourcesService = ResourcesService;
exports.ResourcesService = ResourcesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ResourcesService);
//# sourceMappingURL=resources.service.js.map