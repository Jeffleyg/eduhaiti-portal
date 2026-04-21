import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { mkdir, readFile, appendFile } from "node:fs/promises"
import { dirname, join } from "node:path"

interface AuditLogEntry {
  actionId: string
  deviceId: string
  entityType: string
  entityId: string
  status: "applied" | "ignored" | "conflict" | "failed"
  timestamp: string
  message?: string
}

@Injectable()
export class AuditLogService implements OnModuleInit {
  private readonly logger = new Logger(AuditLogService.name)
  private readonly processedActionIds = new Set<string>()
  private readonly logPath = join(process.cwd(), "uploads", "sync", "audit.log")

  async onModuleInit(): Promise<void> {
    await mkdir(dirname(this.logPath), { recursive: true })
    await this.hydrateProcessedSet()
  }

  isProcessed(actionId: string): boolean {
    return this.processedActionIds.has(actionId)
  }

  async write(entry: AuditLogEntry): Promise<void> {
    await appendFile(this.logPath, `${JSON.stringify(entry)}\n`, "utf8")

    if (entry.status === "applied" || entry.status === "ignored" || entry.status === "conflict") {
      this.processedActionIds.add(entry.actionId)
    }
  }

  private async hydrateProcessedSet(): Promise<void> {
    try {
      const raw = await readFile(this.logPath, "utf8")
      const lines = raw.split("\n")

      for (const line of lines) {
        if (!line.trim()) {
          continue
        }

        const parsed = JSON.parse(line) as Partial<AuditLogEntry>
        if (!parsed.actionId || !parsed.status) {
          continue
        }

        if (parsed.status === "applied" || parsed.status === "ignored" || parsed.status === "conflict") {
          this.processedActionIds.add(parsed.actionId)
        }
      }
    } catch (error: unknown) {
      // First boot has no log file; this keeps startup resilient in edge environments.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.warn("Could not preload audit log for idempotency checks")
      }
    }
  }
}
