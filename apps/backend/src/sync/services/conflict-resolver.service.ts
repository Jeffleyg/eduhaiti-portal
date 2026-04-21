import { Injectable } from "@nestjs/common"

export type ConflictResolution = "apply-client" | "keep-server"

@Injectable()
export class ConflictResolverService {
  resolveLastWriteWins(serverUpdatedAt: Date | null, clientTimestampIso: string): ConflictResolution {
    const clientTime = Date.parse(clientTimestampIso)

    if (Number.isNaN(clientTime)) {
      return "keep-server"
    }

    if (!serverUpdatedAt) {
      return "apply-client"
    }

    return clientTime >= serverUpdatedAt.getTime() ? "apply-client" : "keep-server"
  }
}
