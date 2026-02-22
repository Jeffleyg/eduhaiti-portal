import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import nodemailer from "nodemailer"

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter
  private fromAddress: string

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("SMTP_HOST")
    const port = Number(this.configService.get<string>("SMTP_PORT") ?? 587)
    const secure = (this.configService.get<string>("SMTP_SECURE") ?? "false").toLowerCase() === "true"
    const user = this.configService.get<string>("SMTP_USER")
    const pass = this.configService.get<string>("SMTP_PASS")

    if (!host || !user || !pass) {
      this.fromAddress = this.configService.get<string>("MAIL_FROM") ?? ""
      this.transporter = null as unknown as nodemailer.Transporter
      return
    }

    this.fromAddress = this.configService.get<string>("MAIL_FROM") ?? user

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    })
  }

  async sendTempPasswordEmail(to: string, tempPassword: string, expiresAt: Date) {
    if (!this.transporter) {
      throw new Error("SMTP configuration is missing")
    }
    const expiresAtText = expiresAt.toLocaleString("pt-BR")

    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: "Sua senha temporaria - EduHaiti",
      text: `Sua senha temporaria e: ${tempPassword}\n\nEla expira em: ${expiresAtText}\n\nNo primeiro acesso, voce devera alterar a senha.`,
    })
  }
}
