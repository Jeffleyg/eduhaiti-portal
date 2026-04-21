export interface NormalizedSmsRequest {
  channel: "sms"
  operator: "digicel" | "natcom" | "unknown"
  senderPhone: string
  text: string
  sessionId?: string
  requestId?: string
}

export interface NormalizedUssdRequest {
  channel: "ussd"
  operator: "digicel" | "natcom" | "unknown"
  senderPhone: string
  text: string
  sessionId: string
  requestId?: string
}

export interface OperatorAdapter {
  canHandle(operatorHint?: string): boolean
  normalizeSms(payload: Record<string, unknown>): NormalizedSmsRequest
  normalizeUssd(payload: Record<string, unknown>): NormalizedUssdRequest
  formatSmsResponse(text: string): Record<string, unknown>
  formatUssdResponse(text: string, endSession: boolean): Record<string, unknown>
}
