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
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer_1 = __importDefault(require("nodemailer"));
let EmailService = class EmailService {
    configService;
    transporter;
    fromAddress;
    constructor(configService) {
        this.configService = configService;
        const host = this.configService.get("SMTP_HOST");
        const port = Number(this.configService.get("SMTP_PORT") ?? 587);
        const secure = (this.configService.get("SMTP_SECURE") ?? "false").toLowerCase() === "true";
        const user = this.configService.get("SMTP_USER");
        const pass = this.configService.get("SMTP_PASS");
        if (!host || !user || !pass) {
            this.fromAddress = this.configService.get("MAIL_FROM") ?? "";
            this.transporter = null;
            return;
        }
        this.fromAddress = this.configService.get("MAIL_FROM") ?? user;
        this.transporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure,
            auth: { user, pass },
        });
    }
    async sendTempPasswordEmail(to, tempPassword, expiresAt) {
        if (!this.transporter) {
            throw new common_1.ServiceUnavailableException("SMTP configuration is missing");
        }
        const expiresAtText = expiresAt.toLocaleString("pt-BR");
        await this.transporter.sendMail({
            from: this.fromAddress,
            to,
            subject: "Sua senha temporaria - EduHaiti",
            text: `Sua senha temporaria e: ${tempPassword}\n\nEla expira em: ${expiresAtText}\n\nNo primeiro acesso, voce devera alterar a senha.`,
        });
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map