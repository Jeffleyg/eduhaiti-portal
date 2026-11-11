import { Injectable } from '@nestjs/common';
import { CommandParserService } from './services/command-parser.service';
import { HybridAuditService } from './services/hybrid-audit.service';
import { HybridOtpService } from './services/hybrid-otp.service';
import { OperatorAdapterRegistryService } from './services/operator-adapter-registry.service';
import { SqlServerReadService } from './services/sql-server-read.service';
import { UssdMenuService } from './services/ussd-menu.service';

/**
 * Echoing the OTP back defeats it, so it needs an explicit opt-in and is never
 * allowed in production (a missing NODE_ENV must not leak codes).
 */
function echoOtpForDebug() {
  return (
    process.env.HYBRID_DEBUG_OTP === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}

@Injectable()
export class HybridGatewayService {
  constructor(
    private readonly adapterRegistry: OperatorAdapterRegistryService,
    private readonly parser: CommandParserService,
    private readonly sqlServerRead: SqlServerReadService,
    private readonly ussdMenu: UssdMenuService,
    private readonly audit: HybridAuditService,
    private readonly otp: HybridOtpService,
  ) {}

  async handleSms(
    operatorHint: string | undefined,
    payload: Record<string, unknown>,
  ) {
    const adapter = this.adapterRegistry.resolve(operatorHint);
    const request = adapter.normalizeSms(payload);
    const command = this.parser.parse(request.text);

    if (!command.studentId && command.type !== 'AJUDA') {
      await this.audit.logMessageQuery({
        channel: 'sms',
        senderPhone: request.senderPhone,
        command: request.text,
        status: 'invalid',
        requestId: request.requestId,
      });

      return adapter.formatSmsResponse(
        'Fòma: NOT ID [TOKEN] [OTP] oswa PREZANS ID [TOKEN] [OTP]',
      );
    }

    if (command.type === 'AJUDA') {
      return adapter.formatSmsResponse(
        'Kòmand: NOT ID TOKEN OTP | PREZANS ID TOKEN OTP | AVI ID TOKEN OTP',
      );
    }

    const summary = await this.sqlServerRead.getCriticalSummary(
      command.studentId ?? '',
      request.senderPhone,
      command.responsibleDocumentId,
    );

    if (!summary) {
      await this.audit.logMessageQuery({
        channel: 'sms',
        senderPhone: request.senderPhone,
        command: request.text,
        studentId: command.studentId,
        status: 'denied',
        requestId: request.requestId,
      });

      return adapter.formatSmsResponse(
        'Pa otorize. Verifye ID/TOKEN ak telefòn ki anrejistre a.',
      );
    }

    const otpVerification = await this.otp.verifyOtp({
      phone: request.senderPhone,
      studentId: command.studentId ?? '',
      otpCode: command.otpCode,
      tokenHint: command.responsibleDocumentId,
    });

    if (!otpVerification.ok) {
      const issued = await this.otp.issueOtp({
        phone: request.senderPhone,
        studentId: command.studentId ?? '',
        tokenHint: command.responsibleDocumentId,
        operatorHint,
      });

      const debugSuffix = echoOtpForDebug() ? ` [DEV OTP:${issued.otpCode}]` : '';
      const challenge = `OTP enviado. Reenvie: ${command.type} ${command.studentId ?? ''} ${command.responsibleDocumentId ?? ''} CODIGO_OTP. Valido por 5 minutos.${debugSuffix}`;

      return adapter.formatSmsResponse(this.with160Chars(challenge));
    }

    const responseText = this.buildSmsResponse(
      command.type,
      summary,
    );

    await this.audit.logMessageQuery({
      channel: 'sms',
      senderPhone: request.senderPhone,
      command: request.text,
      studentId: command.studentId,
      status: 'ok',
      requestId: request.requestId,
    });

    return adapter.formatSmsResponse(responseText);
  }

  async handleUssd(
    operatorHint: string | undefined,
    payload: Record<string, unknown>,
  ) {
    const adapter = this.adapterRegistry.resolve(operatorHint);
    const request = adapter.normalizeUssd(payload);

    const path = request.text.trim() ? request.text.trim().split('*') : [];

    if (path[0] === '1') {
      if (path.length < 2) {
        return adapter.formatUssdResponse(
          'Tape: 1*ID_ELEV*TOKEN*OTP',
          false,
        );
      }

      const studentId = path[1] ?? '';
      const responsibleDocumentId = path[2];
      const otpCode = path[3];

      const summary = await this.sqlServerRead.getCriticalSummary(
        studentId,
        request.senderPhone,
        responsibleDocumentId,
      );

      if (!summary) {
        await this.audit.logMessageQuery({
          channel: 'ussd',
          senderPhone: request.senderPhone,
          command: request.text,
          studentId,
          status: 'denied',
          requestId: request.requestId ?? request.sessionId,
        });

        return adapter.formatUssdResponse(
          'Pa otorize. Verifye ID/TOKEN ak telefòn ki anrejistre a.',
          true,
        );
      }

      const otpVerification = await this.otp.verifyOtp({
        phone: request.senderPhone,
        studentId,
        otpCode,
        tokenHint: responsibleDocumentId,
      });

      if (!otpVerification.ok) {
        const issued = await this.otp.issueOtp({
          phone: request.senderPhone,
          studentId,
          tokenHint: responsibleDocumentId,
          operatorHint,
        });

        const devOtpHint = echoOtpForDebug() ? ` [DEV:${issued.otpCode}]` : '';

        return adapter.formatUssdResponse(
          this.with160Chars(
            `Nou voye OTP a. Tape: 1*${studentId}*${responsibleDocumentId ?? 'TOKEN'}*OTP${devOtpHint}`,
          ),
          false,
        );
      }

      await this.audit.logMessageQuery({
        channel: 'ussd',
        senderPhone: request.senderPhone,
        command: request.text,
        studentId,
        status: 'ok',
        requestId: request.requestId ?? request.sessionId,
      });

      return adapter.formatUssdResponse(
        this.with160Chars(
          `Mwayen:${summary.globalAverage.toFixed(1)} | Estati:${this.approvalLabel(summary.approvalStatus)} | Pou pase:${summary.passAverage.toFixed(1)}`,
        ),
        true,
      );
    }

    const menu = this.ussdMenu.handle(request.text);

    await this.audit.logMessageQuery({
      channel: 'ussd',
      senderPhone: request.senderPhone,
      command: request.text,
      status: 'ok',
      requestId: request.requestId ?? request.sessionId,
    });

    return adapter.formatUssdResponse(menu.text, menu.endSession);
  }

  async buildIvrSummary(params: {
    studentId: string;
    senderPhone: string;
    responsibleDocumentId?: string;
  }) {
    const summary = await this.sqlServerRead.getCriticalSummary(
      params.studentId,
      params.senderPhone,
      params.responsibleDocumentId,
    );

    if (!summary) {
      return {
        authorized: false,
        speechText:
          'Pa otorize. Verifye idantifyan elèv la, token an ak telefòn ki anrejistre a.',
      };
    }

    const speechText = [
      'Rezime lekòl la mete ajou.',
      `Mwayèn jeneral: ${summary.globalAverage.toFixed(1)}.`,
      `Kantite absans: ${summary.absences}.`,
      summary.latestAnnouncement
        ? `Dènye avi lekòl la: ${summary.latestAnnouncement}.`
        : 'Pa gen nouvo avi kounye a.',
    ].join(' ');

    return {
      authorized: true,
      speechText,
      ttsHints: {
        language: 'ht',
        voiceStyle: 'calm',
      },
    };
  }

  async buildIvrLessonSummary(params: {
    studentId: string;
    senderPhone: string;
    responsibleDocumentId?: string;
  }) {
    const summary = await this.sqlServerRead.getCriticalSummary(
      params.studentId,
      params.senderPhone,
      params.responsibleDocumentId,
    );

    if (!summary) {
      return {
        authorized: false,
        speechText:
          'Pa otorize. Verifye idantifyan elèv la, token an ak telefòn ki anrejistre a.',
      };
    }

    const lesson = await this.sqlServerRead.getLatestLessonAudioSummary(
      params.studentId,
    );

    if (!lesson) {
      return {
        authorized: true,
        speechText:
          'Pa gen rezime leson disponib kounye a. Eseye ankò pita.',
      };
    }

    const lessonDescription = lesson.description?.trim()
      ? lesson.description.trim()
      : 'Pa gen deskripsyon.';

    const speechText = [
      `Rezime leson klas ${lesson.className ?? ''}.`,
      `Tit: ${lesson.title}.`,
      `Rezime: ${lessonDescription}`,
    ].join(' ');

    return {
      authorized: true,
      speechText,
      audioAlternative: lesson.hasAudio
        ? {
            filePath: lesson.filePath,
            fileType: lesson.fileType,
          }
        : null,
      lessonMeta: {
        resourceId: lesson.resourceId,
        className: lesson.className,
        fileType: lesson.fileType,
      },
      ttsHints: {
        language: 'ht',
        voiceStyle: 'clear',
        pace: 'slow',
      },
    };
  }

  private buildSmsResponse(
    command: 'NOTA' | 'FREQ' | 'AVISO' | 'AJUDA',
    summary: {
      globalAverage: number;
      absences: number;
      latestAnnouncement?: string;
      passAverage: number;
      approvalStatus: 'APROVADO' | 'REPROVADO';
    },
  ): string {
    if (command === 'AVISO') {
      return this.with160Chars(
        `Avi: ${summary.latestAnnouncement ?? 'Pa gen nouvo avi.'}`,
      );
    }

    if (command === 'NOTA') {
      return this.with160Chars(
        `Mwayen:${summary.globalAverage.toFixed(1)} | Estati:${this.approvalLabel(summary.approvalStatus)} | Pou pase:${summary.passAverage.toFixed(1)}`,
      );
    }

    const base = `Absans:${summary.absences} | Mwayen:${summary.globalAverage.toFixed(1)} | Estati:${this.approvalLabel(summary.approvalStatus)}`;

    return this.with160Chars(base);
  }

  private approvalLabel(status: 'APROVADO' | 'REPROVADO'): string {
    return status === 'APROVADO' ? 'PASE' : 'PA PASE';
  }

  private with160Chars(text: string): string {
    if (text.length <= 160) {
      return text;
    }

    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 160) {
      return normalized;
    }

    const limit = 157;
    const slice = normalized.slice(0, limit);
    const lastWhitespace = slice.lastIndexOf(' ');
    const safeCut =
      lastWhitespace >= 120 ? slice.slice(0, lastWhitespace) : slice;

    return `${safeCut.trimEnd()}...`;
  }
}
