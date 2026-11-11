import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryItemType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ItemType = 'TEXTBOOK' | 'UNIFORM' | 'MEAL_KIT' | 'DEVICE' | 'OTHER';

/**
 * School inventory stored in SchoolInventoryItem / SchoolInventoryMovement.
 * Every operation is limited to the caller's school.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private requireSchool(schoolId?: string | null): string {
    if (!schoolId) {
      throw new ForbiddenException('User is not linked to a school');
    }
    return schoolId;
  }

  /** Loads an item of the caller's school; other schools' items look missing. */
  private async findOwnItem(itemId: string, schoolId: string) {
    const item = await this.prisma.schoolInventoryItem.findFirst({
      where: { id: itemId, schoolId },
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    return item;
  }

  private assertCount(value: number | undefined, field: string) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new BadRequestException(`${field} must be a non-negative integer`);
    }
  }

  async listItems(schoolId?: string | null) {
    return this.prisma.schoolInventoryItem.findMany({
      where: { schoolId: this.requireSchool(schoolId) },
      orderBy: [{ itemType: 'asc' }, { name: 'asc' }],
    });
  }

  async createItem(payload: {
    schoolId?: string | null;
    name: string;
    itemType?: ItemType;
    quantity?: number;
    minThreshold?: number;
    unit?: string;
    notes?: string;
    actorUserId?: string;
  }) {
    const schoolId = this.requireSchool(payload.schoolId);
    const name = payload.name?.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    this.assertCount(payload.quantity, 'quantity');
    this.assertCount(payload.minThreshold, 'minThreshold');

    const quantity = payload.quantity ?? 0;
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.schoolInventoryItem.create({
        data: {
          schoolId,
          name,
          itemType: (payload.itemType ?? 'OTHER') as InventoryItemType,
          quantity,
          minThreshold: payload.minThreshold ?? 0,
          unit: payload.unit?.trim() || null,
          notes: payload.notes?.trim() || null,
        },
      });
      if (quantity > 0) {
        await tx.schoolInventoryMovement.create({
          data: { itemId: item.id, delta: quantity, reason: 'INITIAL_STOCK', actorUserId: payload.actorUserId },
        });
      }
      return item;
    });
  }

  /** Edits the description of an item. Quantity changes go through adjustItemStock. */
  async updateItem(
    itemId: string,
    payload: {
      schoolId?: string | null;
      name?: string;
      itemType?: ItemType;
      minThreshold?: number;
      unit?: string;
      notes?: string;
    },
  ) {
    const schoolId = this.requireSchool(payload.schoolId);
    await this.findOwnItem(itemId, schoolId);
    this.assertCount(payload.minThreshold, 'minThreshold');

    return this.prisma.schoolInventoryItem.update({
      where: { id: itemId },
      data: {
        ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
        ...(payload.itemType ? { itemType: payload.itemType as InventoryItemType } : {}),
        ...(payload.minThreshold !== undefined ? { minThreshold: payload.minThreshold } : {}),
        ...(payload.unit !== undefined ? { unit: payload.unit?.trim() || null } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes?.trim() || null } : {}),
      },
    });
  }

  /**
   * Moves stock up or down and records why. The decrement only applies when enough
   * stock is left, checked in the same UPDATE, so concurrent requests cannot go negative.
   */
  async adjustItemStock(
    itemId: string,
    payload: {
      schoolId?: string | null;
      delta: number;
      reason: string;
      actorUserId?: string;
    },
  ) {
    const schoolId = this.requireSchool(payload.schoolId);
    if (!Number.isInteger(payload.delta) || payload.delta === 0) {
      throw new BadRequestException('delta must be a non-zero integer');
    }
    const reason = payload.reason?.trim();
    if (!reason) {
      throw new BadRequestException('reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.schoolInventoryItem.updateMany({
        where: {
          id: itemId,
          schoolId,
          ...(payload.delta < 0 ? { quantity: { gte: -payload.delta } } : {}),
        },
        data: { quantity: { increment: payload.delta } },
      });

      if (updated.count === 0) {
        const exists = await tx.schoolInventoryItem.findFirst({
          where: { id: itemId, schoolId },
          select: { id: true },
        });
        throw exists
          ? new BadRequestException('stock cannot be negative')
          : new NotFoundException('Inventory item not found');
      }

      await tx.schoolInventoryMovement.create({
        data: { itemId, delta: payload.delta, reason, actorUserId: payload.actorUserId },
      });

      return tx.schoolInventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    });
  }

  async listMovements(itemId: string, schoolId?: string | null) {
    await this.findOwnItem(itemId, this.requireSchool(schoolId));
    return this.prisma.schoolInventoryMovement.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async deleteItem(itemId: string, schoolId?: string | null) {
    await this.findOwnItem(itemId, this.requireSchool(schoolId));
    await this.prisma.schoolInventoryItem.delete({ where: { id: itemId } });
    return { success: true };
  }
}
