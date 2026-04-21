import { apiFetch } from "../../lib/api"
import { PullResponse, PushPayload, PushResponse, SyncEntity, SyncRemoteApi } from "./types"

export class HttpSyncApi implements SyncRemoteApi {
  async push(payload: PushPayload): Promise<PushResponse> {
    return apiFetch("/sync/push", {
      method: "POST",
      body: payload,
    })
  }

  async pull(sinceIso: string, entities?: SyncEntity[]): Promise<PullResponse> {
    return apiFetch("/sync/pull", {
      method: "POST",
      body: {
        since: sinceIso,
        entities,
      },
    })
  }
}
