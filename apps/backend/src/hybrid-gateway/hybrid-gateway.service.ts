import { Injectable } from "@nestjs/common"
import { CommandParserService } from "./services/command-parser.service"
import { HybridAuditService } from "./services/hybrid-audit.service"
import { HybridOtpService } from "./services/hybrid-otp.service"
import { OperatorAdapterRegistryService } from "./services/operator-adapter-registry.service"
import { SqlServerReadService } from "./services/sql-server-read.service"
import { UssdMenuService } from "./services/ussd-menu.service"

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

  async handleSms(operatorHint: string | undefined, payload: Record<string, unknown>) {
    const adapter = this.adapterRegistry.resolve(operatorHint)
    const request = adapter.normalizeSms(payload)
    const command = this.parser.parse(request.text)

    if (!command.studentId && command.type !== "AJUDA") {
      await this.audit.logMessageQuery({
        channel: "sms",
        senderPhone: request.senderPhone,
        command: request.text,
        status: "invalid",
        requestId: request.requestId,
      })

      return adapter.formatSmsResponse("Formato: NOTA ID [TOKEN] [OTP] ou FREQ ID [TOKEN] [OTP]")
    }

    if (command.type === "AJUDA") {
      return adapter.formatSmsResponse("Comandos: NOTA ID TOKEN OTP | FREQ ID TOKEN OTP | AVISO ID TOKEN OTP")
    }

    const summary = await this.sqlServerRead.getCriticalSummary(
      command.studentId ?? "",
      request.senderPhone,
      command.responsibleDocumentId,
    )

    if (!summary) {
      await this.audit.logMessageQuery({
        channel: "sms",
        senderPhone: request.senderPhone,
        command: request.text,
        studentId: command.studentId,
        status: "denied",
        requestId: request.requestId,
      })

      return adapter.formatSmsResponse("Nao autorizado. Verifique ID/TOKEN e telefone cadastrado.")
    }

    const otpVerification = await this.otp.verifyOtp({
      phone: request.senderPhone,
      studentId: command.studentId ?? "",
      otpCode: command.otpCode,
      tokenHint: command.responsibleDocumentId,
    })

    if (!otpVerification.ok) {
      const issued = await this.otp.issueOtp({
        phone: request.senderPhone,
        studentId: command.studentId ?? "",
        tokenHint: command.responsibleDocumentId,
      })

      const debugSuffix = process.env.NODE_ENV === "production"
        ? ""
        : ` [DEV OTP:${issued.otpCode}]`
      const challenge = `OTP enviado. Reenvie: ${command.type} ${command.studentId ?? ""} ${command.responsibleDocumentId ?? ""} CODIGO_OTP. Valido por 5 minutos.${debugSuffix}`

      return adapter.formatSmsResponse(this.with160Chars(challenge))
    }

    const responseText = this.buildSmsResponse(command.type, summary.globalAverage, summary.absences, summary.latestAnnouncement)

    await this.audit.logMessageQuery({
      channel: "sms",
      senderPhone: request.senderPhone,
      command: request.text,
      studentId: command.studentId,
      status: "ok",
      requestId: request.requestId,
    })

    return adapter.formatSmsResponse(responseText)
  }

  async handleUssd(operatorHint: string | undefined, payload: Record<string, unknown>) {
    const adapter = this.adapterRegistry.resolve(operatorHint)
    const request = adapter.normalizeUssd(payload)

    const menu = this.ussdMenu.handle(request.text)

    await this.audit.logMessageQuery({
      channel: "ussd",
      senderPhone: request.senderPhone,
      command: request.text,
      status: "ok",
      requestId: request.requestId ?? request.sessionId,
    })

    return adapter.formatUssdResponse(menu.text, menu.endSession)
  }

  async buildIvrSummary(params: {
    studentId: string
    senderPhone: string
    responsibleDocumentId?: string
  }) {
    const summary = await this.sqlServerRead.getCriticalSummary(
      params.studentId,
      params.senderPhone,
      params.responsibleDocumentId,
    )

    if (!summary) {
      return {
        authorized: false,
        speechText:
          "Nao autorizado. Verifique o identificador do aluno, token e telefone cadastrado.",
      }
    }

    const speechText = [
      "Resumo escolar atualizado.",
      `Media geral: ${summary.globalAverage.toFixed(1)}.`,
      `Total de faltas registradas: ${summary.absences}.`,
      summary.latestAnnouncement
        ? `Ultimo aviso da escola: ${summary.latestAnnouncement}.`
        : "Sem novos avisos no momento.",
    ].join(" ")

    return {
      authorized: true,
      speechText,
      ttsHints: {
        language: "pt-HT",
        voiceStyle: "calm",
      },
    }
  }

  async buildIvrLessonSummary(params: {
    studentId: string
    senderPhone: string
    responsibleDocumentId?: string
  }) {
    const summary = await this.sqlServerRead.getCriticalSummary(
      params.studentId,
      params.senderPhone,
      params.responsibleDocumentId,
    )

    if (!summary) {
      return {
        authorized: false,
        speechText:
          "Nao autorizado. Verifique o identificador do aluno, token e telefone cadastrado.",
      }
    }

    const lesson = await this.sqlServerRead.getLatestLessonAudioSummary(
      params.studentId,
    )

    if (!lesson) {
      return {
        authorized: true,
        speechText:
          "Nao encontramos resumo de aula disponivel neste momento. Tente novamente mais tarde.",
      }
    }

    const lessonDescription = lesson.description?.trim()
      ? lesson.description.trim()
      : "Sem descricao resumida."

    const speechText = [
      `Resumo da aula de ${lesson.className ?? "turma"}.`,
      `Titulo: ${lesson.title}.`,
      `Resumo: ${lessonDescription}`,
    ].join(" ")

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
        language: "pt-HT",
        voiceStyle: "clear",
        pace: "slow",
      },
    }
  }

  private buildSmsResponse(
    command: "NOTA" | "FREQ" | "AVISO" | "AJUDA",
    globalAverage: number,
    absences: number,
    latestAnnouncement?: string,
  ): string {
    if (command === "AVISO") {
      return this.with160Chars(`Aviso: ${latestAnnouncement ?? "Sem novos avisos."}`)
    }

    const label = command === "NOTA" ? "Media" : "Faltas"
    const value = command === "NOTA" ? globalAverage.toFixed(1) : String(absences)
    const base = `${label}:${value} | Media:${globalAverage.toFixed(1)} | Faltas:${absences}`

    return this.with160Chars(base)
  }

  private with160Chars(text: string): string {
    if (text.length <= 160) {
      return text
    }

    const normalized = text.replace(/\s+/g, " ").trim()
    if (normalized.length <= 160) {
      return normalized
    }

    const limit = 157
    const slice = normalized.slice(0, limit)
    const lastWhitespace = slice.lastIndexOf(" ")
    const safeCut = lastWhitespace >= 120 ? slice.slice(0, lastWhitespace) : slice

    return `${safeCut.trimEnd()}...`
  }
}
