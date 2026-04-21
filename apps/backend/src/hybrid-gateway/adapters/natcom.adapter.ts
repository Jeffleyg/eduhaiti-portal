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
export class NatcomAdapter implements OperatorAdapter {
  canHandle(operatorHint?: string): boolean {
    return (operatorHint ?? "").toLowerCase() === "natcom"
  }

  normalizeSms(payload: Record<string, unknown>): NormalizedSmsRequest {
    return {
      channel: "sms",
      operator: "natcom",
      senderPhone: toScalarString(payload.sender ?? payload.msisdn),
      text: toScalarString(payload.body ?? payload.text),
      sessionId: payload.session ? toScalarString(payload.session) : undefined,
      requestId: payload.id ? toScalarString(payload.id) : undefined,
    }
  }

  normalizeUssd(payload: Record<string, unknown>): NormalizedUssdRequest {
    const sessionId = toScalarString(payload.session ?? payload.sessionId)

    return {
      channel: "ussd",
      operator: "natcom",
      senderPhone: toScalarString(payload.sender ?? payload.msisdn),
      text: toScalarString(payload.input ?? payload.text),
      sessionId,
      requestId: payload.id ? toScalarString(payload.id) : undefined,
    }
  }

  formatSmsResponse(text: string): Record<string, unknown> {
    return { sms: text }
  }

  formatUssdResponse(text: string, endSession: boolean): Record<string, unknown> {
    return {
      ussdString: text,
      shouldClose: endSession,
    }
  }
}
