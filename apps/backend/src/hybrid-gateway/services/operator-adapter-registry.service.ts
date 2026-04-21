import { Injectable } from "@nestjs/common"
import { DigicelAdapter } from "../adapters/digicel.adapter"
import { NatcomAdapter } from "../adapters/natcom.adapter"
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

class FallbackAdapter implements OperatorAdapter {
  canHandle(): boolean {
    return true
  }

  normalizeSms(payload: Record<string, unknown>): NormalizedSmsRequest {
    return {
      channel: "sms",
      operator: "unknown",
      senderPhone: toScalarString(payload.msisdn ?? payload.from ?? payload.phone),
      text: toScalarString(payload.text ?? payload.message ?? payload.body),
      sessionId: payload.sessionId ? toScalarString(payload.sessionId) : undefined,
      requestId: payload.requestId ? toScalarString(payload.requestId) : undefined,
    }
  }

  normalizeUssd(payload: Record<string, unknown>): NormalizedUssdRequest {
    const sessionId = toScalarString(payload.sessionId ?? payload.session)

    return {
      channel: "ussd",
      operator: "unknown",
      senderPhone: toScalarString(payload.msisdn ?? payload.from ?? payload.phone),
      text: toScalarString(payload.text ?? payload.input),
      sessionId: sessionId || crypto.randomUUID(),
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

@Injectable()
export class OperatorAdapterRegistryService {
  private readonly fallback = new FallbackAdapter()

  constructor(
    private readonly digicelAdapter: DigicelAdapter,
    private readonly natcomAdapter: NatcomAdapter,
  ) {}

  resolve(operatorHint?: string): OperatorAdapter {
    const adapters = [this.digicelAdapter, this.natcomAdapter]
    return adapters.find((adapter) => adapter.canHandle(operatorHint)) ?? this.fallback
  }
}
