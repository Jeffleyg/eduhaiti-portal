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
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let MessagesService = class MessagesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findReceivedBy(userId) {
        return this.prisma.message.findMany({
            where: { toId: userId },
            include: { from: { select: { id: true, email: true, name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
    }
    async findSentBy(userId) {
        return this.prisma.message.findMany({
            where: { fromId: userId },
            include: { to: { select: { id: true, email: true, name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
    }
    async send(fromId, toId, subject, body) {
        return this.prisma.message.create({
            data: { fromId, toId, subject, body },
            include: { from: { select: { name: true } }, to: { select: { name: true } } },
        });
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MessagesService);
//# sourceMappingURL=messages.service.js.map