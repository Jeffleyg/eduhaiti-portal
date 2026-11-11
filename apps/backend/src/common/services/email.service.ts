import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const secure =
      (
        this.configService.get<string>('SMTP_SECURE') ?? 'false'
      ).toLowerCase() === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.fromAddress =
      this.configService.get<string>('MAIL_FROM') ??
      (user ? `"EduHaiti" <${user}>` : '"EduHaiti" <noreply@eduhaiti.ht>');

    if (!host || !user || !pass) {
      this.logger.warn(
        'Configurações SMTP incompletas no .env. Envio de e-mails em modo silencioso/desativado.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      // Timeout curto para evitar travar a API se o servidor SMTP demorar a responder
      connectionTimeout: 5000,
      greetingTimeout: 5000,
    });
  }

  async sendTempPasswordEmail(
    to: string,
    tempPassword: string,
    expiresAt: Date,
  ): Promise<boolean> {
    if (!this.transporter) {
      // Never log the password: callers hand it to the admin once when this returns false.
      this.logger.warn(`SMTP não configurado; e-mail de senha temporária não enviado para ${to}.`);
      return false;
    }

    const expiresAtText = expiresAt.toLocaleString('fr-FR');

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Votre mot de passe temporaire / Modpas tanporè ou - EduHaiti',
        text: `Votre mot de passe temporaire est : ${tempPassword}\nIl expire le : ${expiresAtText}\nLors de votre première connexion, vous devrez changer ce mot de passe.\n\n---\n\nModpas tanporè ou se: ${tempPassword}\nLi ekspire: ${expiresAtText}\nLè w konekte premye fwa a, w ap oblije chanje modpas la.`,
      });

      this.logger.log(`E-mail com senha temporária enviado com sucesso para: ${to}`);
      return true;
    } catch (error: any) {
      // Captura a falha de autenticação ou rede sem propagar o erro 500 para a rota
      this.logger.error(
        `Falha ao enviar e-mail para ${to} (${error.message}). A operação continuará normalmente.`,
      );
      return false;
    }
  }
}