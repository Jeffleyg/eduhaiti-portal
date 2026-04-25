import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

type InventoryItem = {
  id: string
  schoolId: string
  name: string
  itemType: "TEXTBOOK" | "UNIFORM" | "MEAL_KIT" | "DEVICE" | "OTHER"
  quantity: number
  minThreshold: number
  unit?: string
  notes?: string
  deleted?: boolean
  updatedAt: string
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private parseItem(changes: string): InventoryItem | null {
    try {
      return JSON.parse(changes) as InventoryItem
    } catch {
      return null
    }
  }

  private async buildCurrentMap(schoolId?: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType: "SCHOOL_INVENTORY",
      },
      orderBy: { createdAt: "asc" },
      take: 10000,
    })

    const map = new Map<string, InventoryItem>()

    for (const log of logs) {
      const item = this.parseItem(log.changes)
      if (!item) {
        continue
      }

      if (schoolId && item.schoolId !== schoolId) {
        continue
      }

      map.set(log.entityId, { ...item, id: log.entityId })
    }

    return map
  }

  async listItems(schoolId?: string) {
    const map = await this.buildCurrentMap(schoolId)
    return [...map.values()].filter((item) => !item.deleted)
  }

  async createItem(payload: {
    schoolId: string
    name: string
    itemType?: "TEXTBOOK" | "UNIFORM" | "MEAL_KIT" | "DEVICE" | "OTHER"
    quantity?: number
    minThreshold?: number
    unit?: string
    notes?: string
    actorUserId?: string
  }) {
    if (!payload.schoolId?.trim() || !payload.name?.trim()) {
      throw new BadRequestException("schoolId and name are required")
    }

    const itemId = crypto.randomUUID()
    const item: InventoryItem = {
      id: itemId,
      schoolId: payload.schoolId.trim(),
      name: payload.name.trim(),
      itemType: payload.itemType ?? "OTHER",
      quantity: payload.quantity ?? 0,
      minThreshold: payload.minThreshold ?? 0,
      unit: payload.unit?.trim() || undefined,
      notes: payload.notes?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    }

    await this.prisma.auditLog.create({
      data: {
        entityType: "SCHOOL_INVENTORY",
        entityId: itemId,
        action: "CREATE",
        userId: payload.actorUserId,
        changes: JSON.stringify(item),
      },
    })

    return item
  }

  async updateItem(
    itemId: string,
    payload: {
      name?: string
      itemType?: "TEXTBOOK" | "UNIFORM" | "MEAL_KIT" | "DEVICE" | "OTHER"
      quantity?: number
      minThreshold?: number
      unit?: string
      notes?: string
      actorUserId?: string
    },
  ) {
    const map = await this.buildCurrentMap()
    const current = map.get(itemId)

    if (!current || current.deleted) {
      throw new NotFoundException("Inventory item not found")
    }

    const next: InventoryItem = {
      ...current,
      name: payload.name?.trim() || current.name,
      itemType: payload.itemType || current.itemType,
      quantity: payload.quantity ?? current.quantity,
      minThreshold: payload.minThreshold ?? current.minThreshold,
      unit: payload.unit !== undefined ? payload.unit?.trim() || undefined : current.unit,
      notes: payload.notes !== undefined ? payload.notes?.trim() || undefined : current.notes,
      updatedAt: new Date().toISOString(),
    }

    await this.prisma.auditLog.create({
      data: {
        entityType: "SCHOOL_INVENTORY",
        entityId: itemId,
        action: "UPDATE",
        userId: payload.actorUserId,
        changes: JSON.stringify(next),
      },
    })

    return next
  }

  async adjustItemStock(
    itemId: string,
    payload: {
      delta: number
      reason: string
      actorUserId?: string
    },
  ) {
    if (!Number.isFinite(payload.delta) || payload.delta === 0) {
      throw new BadRequestException("delta must be a non-zero number")
    }

    if (!payload.reason?.trim()) {
      throw new BadRequestException("reason is required")
    }

    const map = await this.buildCurrentMap()
    const current = map.get(itemId)

    if (!current || current.deleted) {
      throw new NotFoundException("Inventory item not found")
    }

    const nextQuantity = current.quantity + payload.delta
    if (nextQuantity < 0) {
      throw new BadRequestException("stock cannot be negative")
    }

    const next: InventoryItem = {
      ...current,
      quantity: nextQuantity,
      notes: [current.notes, `MOV:${payload.reason.trim()} (${payload.delta > 0 ? "+" : ""}${payload.delta})`]
        .filter(Boolean)
        .join(" | "),
      updatedAt: new Date().toISOString(),
    }

    await this.prisma.auditLog.create({
      data: {
        entityType: "SCHOOL_INVENTORY",
        entityId: itemId,
        action: "ADJUST",
        userId: payload.actorUserId,
        changes: JSON.stringify(next),
      },
    })

    return next
  }

  async deleteItem(itemId: string, actorUserId?: string) {
    const map = await this.buildCurrentMap()
    const current = map.get(itemId)

    if (!current || current.deleted) {
      throw new NotFoundException("Inventory item not found")
    }

    const next: InventoryItem = {
      ...current,
      deleted: true,
      updatedAt: new Date().toISOString(),
    }

    await this.prisma.auditLog.create({
      data: {
        entityType: "SCHOOL_INVENTORY",
        entityId: itemId,
        action: "DELETE",
        userId: actorUserId,
        changes: JSON.stringify(next),
      },
    })

    return { success: true }
  }
}
