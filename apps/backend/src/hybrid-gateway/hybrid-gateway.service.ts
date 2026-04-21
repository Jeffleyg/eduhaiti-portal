import { Injectable } from "@nestjs/common"
import { CommandParserService } from "./services/command-parser.service"
import { HybridAuditService } from "./services/hybrid-audit.service"
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

      return adapter.formatSmsResponse("Formato: NOTA ID [TOKEN] ou FREQ ID [TOKEN]")
    }

    if (command.type === "AJUDA") {
      return adapter.formatSmsResponse("Comandos: NOTA ID TOKEN | FREQ ID TOKEN | AVISO ID TOKEN")
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

    return `${text.slice(0, 157)}...`
  }
}
