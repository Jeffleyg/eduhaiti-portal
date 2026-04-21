import { Injectable } from "@nestjs/common"
import {
  NormalizedSmsRequest,
  NormalizedUssdRequest,
  OperatorAdapter,
} from "../interfaces/operator-adapter.interface"

function toScalarString(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return ""
}

@Injectable()
export class DigicelAdapter implements OperatorAdapter {
  canHandle(operatorHint?: string): boolean {
    return (operatorHint ?? "").toLowerCase() === "digicel"
  }

  normalizeSms(payload: Record<string, unknown>): NormalizedSmsRequest {
    return {
      channel: "sms",
      operator: "digicel",
      senderPhone: toScalarString(payload.msisdn ?? payload.from),
      text: toScalarString(payload.text ?? payload.message),
      sessionId: payload.sessionId ? toScalarString(payload.sessionId) : undefined,
      requestId: payload.requestId ? toScalarString(payload.requestId) : undefined,
    }
  }

  normalizeUssd(payload: Record<string, unknown>): NormalizedUssdRequest {
    const sessionId = toScalarString(payload.sessionId ?? payload.session_id)

    return {
      channel: "ussd",
      operator: "digicel",
      senderPhone: toScalarString(payload.msisdn ?? payload.phoneNumber),
      text: toScalarString(payload.text),
      sessionId,
      requestId: payload.requestId ? toScalarString(payload.requestId) : undefined,
    }
  }

  formatSmsResponse(text: string): Record<string, unknown> {
    return { message: text }
  }

  formatUssdResponse(text: string, endSession: boolean): Record<string, unknown> {
    return {
      response: text,
      action: endSession ? "end" : "continue",
    }
  }
}
