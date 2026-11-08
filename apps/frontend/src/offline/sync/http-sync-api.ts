import { apiFetch } from "../../lib/api"
import { PullResponse, PushPayload, PushResponse, SyncEntity, SyncRemoteApi } from "./types"

// Same key used by AuthContext; /sync/* endpoints require a JWT.
const TOKEN_KEY = "eduhaiti_token"

function getToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export class HttpSyncApi implements SyncRemoteApi {
  async push(payload: PushPayload): Promise<PushResponse> {
    return apiFetch("/sync/push", {
      method: "POST",
      body: payload,
      token: getToken(),
    })
  }

  async pull(sinceIso: string, entities?: SyncEntity[]): Promise<PullResponse> {
    return apiFetch("/sync/pull", {
      method: "POST",
      body: {
        since: sinceIso,
        entities,
      },
      token: getToken(),
    })
  }
}
