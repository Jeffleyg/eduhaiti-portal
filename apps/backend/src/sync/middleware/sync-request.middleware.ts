import { Injectable, NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"

@Injectable()
export class SyncRequestMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const nowIso = new Date().toISOString()
    req.headers["x-sync-received-at"] = nowIso
    next()
  }
}
