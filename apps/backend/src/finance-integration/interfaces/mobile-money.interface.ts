export type MobileMoneyProviderName = "moncash" | "natcash"

export interface MobileMoneyChargeRequest {
  externalReference: string
  accountNumber: string
  amountHtg: number
  narration: string
}

export interface MobileMoneyChargeResult {
  approved: boolean
  providerTransactionId: string
  providerName: MobileMoneyProviderName
  netAmountHtg: number
  feeAmountHtg: number
}

export interface MobileMoneyProvider {
  name: MobileMoneyProviderName
  processCharge(request: MobileMoneyChargeRequest): Promise<MobileMoneyChargeResult>
}
