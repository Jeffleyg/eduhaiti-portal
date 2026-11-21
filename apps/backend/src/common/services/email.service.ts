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
      this.logger.warn(
        `SMTP não configurado; e-mail de senha temporária não enviado para ${to}.`,
      );
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

      this.logger.log(
        `E-mail com senha temporária enviado com sucesso para: ${to}`,
      );
      return true;
    } catch (error: any) {
      // Captura a falha de autenticação ou rede sem propagar o erro 500 para a rota
      this.logger.error(
        `Falha ao enviar e-mail para ${to} (${error.message}). A operação continuará normalmente.`,
      );
      return false;
    }
  }

  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    expiresAt: Date,
  ): Promise<boolean> {
    if (!this.transporter) {
      // Never log the link: it grants access to the account until it expires.
      this.logger.warn(
        `SMTP não configurado; e-mail de redefinição de senha não enviado para ${to}.`,
      );
      return false;
    }

    const expiresAtText = expiresAt.toLocaleString('fr-FR');
    const text = [
      'Bonjour,',
      '',
      'Une demande de réinitialisation du mot de passe a été faite pour votre compte EduHaiti.',
      `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable jusqu'au ${expiresAtText}) :`,
      resetUrl,
      '',
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
      '',
      '---',
      '',
      'Bonjou,',
      'Yo mande chanje modpas kont EduHaiti ou a.',
      `Pou chwazi yon nouvo modpas, louvri lyen sa a (li bon jiska ${expiresAtText}) :`,
      resetUrl,
      '',
      'Si se pa ou ki fè demann sa a, pa okipe mesaj la: modpas ou pa chanje.',
    ].join('\n');

    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0f2a4a">
  <h2 style="margin:0 0 12px">EduHaiti</h2>
  <p>Une demande de réinitialisation du mot de passe a été faite pour votre compte.</p>
  <p style="margin:24px 0"><a href="${resetUrl}" style="background:#0f2a4a;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Choisir un nouveau mot de passe</a></p>
  <p style="font-size:13px;color:#555">Lien valable jusqu'au ${expiresAtText}. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
  <hr style="border:none;border-top:1px solid #ddd;margin:20px 0">
  <p>Yo mande chanje modpas kont ou a. <a href="${resetUrl}">Klike la a pou chwazi yon nouvo modpas</a>.</p>
  <p style="font-size:13px;color:#555">Lyen an bon jiska ${expiresAtText}. Si se pa ou ki fè demann lan, pa okipe mesaj la.</p>
</div>`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Réinitialisation du mot de passe / Chanje modpas - EduHaiti',
        text,
        html,
      });
      this.logger.log(`E-mail de redefinição de senha enviado para: ${to}`);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Falha ao enviar e-mail de redefinição para ${to} (${reason}).`,
      );
      return false;
    }
  }
}
