import { Injectable } from "@nestjs/common"

export type SmsCommandType = "NOTA" | "FREQ" | "AVISO" | "AJUDA"

export interface ParsedSmsCommand {
  type: SmsCommandType
  studentId?: string
  responsibleDocumentId?: string
}

@Injectable()
export class CommandParserService {
  parse(rawText: string): ParsedSmsCommand {
    const sanitized = rawText.trim().replace(/\s+/g, " ").toUpperCase()

    if (!sanitized) {
      return { type: "AJUDA" }
    }

    const parts = sanitized.split(" ")
    const command = parts[0]

    if (command === "NOTA" || command === "FREQ") {
      return {
        type: command,
        studentId: parts[1],
        responsibleDocumentId: parts[2],
      }
    }

    if (command === "AVISO") {
      return {
        type: "AVISO",
        studentId: parts[1],
        responsibleDocumentId: parts[2],
      }
    }

    return { type: "AJUDA" }
  }
}
