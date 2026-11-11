import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { autoMock } from '../test-utils/auto-mock';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let prisma: PrismaMock;
  let svc: InventoryService;
  const item = { id: 'i', schoolId: 'sc', name: 'Livre', quantity: 5 };

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new InventoryService(prisma as any);
    prisma.schoolInventoryItem.findFirst.mockResolvedValue(item);
  });

  it('refuses callers without a school on every operation', async () => {
    await expect(svc.listItems(null)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.createItem({ name: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.updateItem('i', {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.adjustItemStock('i', { delta: 1, reason: 'r' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.listMovements('i')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.deleteItem('i')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lists only the caller's school", async () => {
    await svc.listItems('sc');
    expect(prisma.schoolInventoryItem.findMany.mock.calls[0][0].where).toEqual({ schoolId: 'sc' });
  });

  describe('createItem', () => {
    it('validates name and counts', async () => {
      await expect(svc.createItem({ schoolId: 'sc', name: ' ' })).rejects.toThrow('name is required');
      await expect(svc.createItem({ schoolId: 'sc', name: 'x', quantity: -1 })).rejects.toThrow('quantity');
      await expect(svc.createItem({ schoolId: 'sc', name: 'x', minThreshold: 1.5 })).rejects.toThrow('minThreshold');
    });

    it('creates the item with an initial movement', async () => {
      prisma.schoolInventoryItem.create.mockResolvedValue({ id: 'new' });
      await expect(
        svc.createItem({ schoolId: 'sc', name: ' Livre ', itemType: 'TEXTBOOK', quantity: 3, minThreshold: 1, unit: ' cx ', notes: ' n ', actorUserId: 'a' }),
      ).resolves.toEqual({ id: 'new' });
      expect(prisma.schoolInventoryItem.create.mock.calls[0][0].data).toEqual({
        schoolId: 'sc',
        name: 'Livre',
        itemType: 'TEXTBOOK',
        quantity: 3,
        minThreshold: 1,
        unit: 'cx',
        notes: 'n',
      });
      expect(prisma.schoolInventoryMovement.create.mock.calls[0][0].data).toEqual({
        itemId: 'new',
        delta: 3,
        reason: 'INITIAL_STOCK',
        actorUserId: 'a',
      });
    });

    it('uses defaults and skips the movement for an empty stock', async () => {
      prisma.schoolInventoryItem.create.mockResolvedValue({ id: 'new' });
      await svc.createItem({ schoolId: 'sc', name: 'x' });
      expect(prisma.schoolInventoryItem.create.mock.calls[0][0].data).toMatchObject({
        itemType: 'OTHER',
        quantity: 0,
        minThreshold: 0,
        unit: null,
        notes: null,
      });
      expect(prisma.schoolInventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    it("hides other schools' items", async () => {
      prisma.schoolInventoryItem.findFirst.mockResolvedValue(null);
      await expect(svc.updateItem('i', { schoolId: 'sc', name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.schoolInventoryItem.findFirst.mock.calls[0][0].where).toEqual({ id: 'i', schoolId: 'sc' });
      expect(prisma.schoolInventoryItem.update).not.toHaveBeenCalled();
    });

    it('updates only the provided fields', async () => {
      await svc.updateItem('i', { schoolId: 'sc', name: ' New ', itemType: 'DEVICE', minThreshold: 2, unit: ' ', notes: 'x' });
      expect(prisma.schoolInventoryItem.update.mock.calls[0][0]).toEqual({
        where: { id: 'i' },
        data: { name: 'New', itemType: 'DEVICE', minThreshold: 2, unit: null, notes: 'x' },
      });
      await svc.updateItem('i', { schoolId: 'sc', name: ' ', notes: '' });
      expect(prisma.schoolInventoryItem.update.mock.calls[1][0].data).toEqual({ notes: null });
      await expect(svc.updateItem('i', { schoolId: 'sc', minThreshold: -2 })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('adjustItemStock', () => {
    it('validates delta and reason', async () => {
      for (const delta of [0, 1.5, Number.NaN]) {
        await expect(svc.adjustItemStock('i', { schoolId: 'sc', delta, reason: 'r' })).rejects.toThrow('non-zero integer');
      }
      await expect(svc.adjustItemStock('i', { schoolId: 'sc', delta: 1, reason: ' ' })).rejects.toThrow('reason');
    });

    it('increments atomically and records the movement', async () => {
      prisma.schoolInventoryItem.updateMany.mockResolvedValue({ count: 1 });
      prisma.schoolInventoryItem.findUniqueOrThrow.mockResolvedValue({ ...item, quantity: 7 });
      const r = await svc.adjustItemStock('i', { schoolId: 'sc', delta: 2, reason: ' doação ', actorUserId: 'a' });
      expect(r.quantity).toBe(7);
      expect(prisma.schoolInventoryItem.updateMany.mock.calls[0][0]).toEqual({
        where: { id: 'i', schoolId: 'sc' },
        data: { quantity: { increment: 2 } },
      });
      expect(prisma.schoolInventoryMovement.create.mock.calls[0][0].data).toEqual({
        itemId: 'i',
        delta: 2,
        reason: 'doação',
        actorUserId: 'a',
      });
    });

    it('only decrements when enough stock is left', async () => {
      prisma.schoolInventoryItem.updateMany.mockResolvedValue({ count: 1 });
      await svc.adjustItemStock('i', { schoolId: 'sc', delta: -3, reason: 'r' });
      expect(prisma.schoolInventoryItem.updateMany.mock.calls[0][0].where).toEqual({
        id: 'i',
        schoolId: 'sc',
        quantity: { gte: 3 },
      });
    });

    it('distinguishes insufficient stock from a missing item', async () => {
      prisma.schoolInventoryItem.updateMany.mockResolvedValue({ count: 0 });
      await expect(svc.adjustItemStock('i', { schoolId: 'sc', delta: -9, reason: 'r' })).rejects.toThrow(
        'stock cannot be negative',
      );
      prisma.schoolInventoryItem.findFirst.mockResolvedValue(null);
      await expect(svc.adjustItemStock('i', { schoolId: 'sc', delta: -9, reason: 'r' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.schoolInventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  it('lists movements of own items', async () => {
    await svc.listMovements('i', 'sc');
    expect(prisma.schoolInventoryMovement.findMany.mock.calls[0][0]).toMatchObject({ where: { itemId: 'i' }, take: 200 });
  });

  it('deletes own items only', async () => {
    await expect(svc.deleteItem('i', 'sc')).resolves.toEqual({ success: true });
    expect(prisma.schoolInventoryItem.delete).toHaveBeenCalledWith({ where: { id: 'i' } });
    prisma.schoolInventoryItem.findFirst.mockResolvedValue(null);
    await expect(svc.deleteItem('i', 'sc')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('InventoryController', () => {
  it('requires an authenticated admin', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, InventoryController)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, InventoryController)).toEqual([Role.ADMIN]);
  });

  it("always uses the token's school and ignores a school in the body", async () => {
    const svc = autoMock();
    const ctrl = new InventoryController(svc as any);
    const req = { user: { sub: 'a', schoolId: 'sc' } };

    await ctrl.listItems(req);
    await ctrl.createItem(req, { name: 'n', schoolId: 'other' } as any);
    await ctrl.updateItem(req, 'i', { name: 'm' });
    await ctrl.adjustStock(req, 'i', { delta: 2, reason: 'r' });
    await ctrl.listMovements(req, 'i');
    await ctrl.deleteItem(req, 'i');

    expect(svc.listItems).toHaveBeenCalledWith('sc');
    expect(svc.createItem.mock.calls[0][0]).toMatchObject({ schoolId: 'sc', name: 'n', actorUserId: 'a' });
    expect(svc.updateItem).toHaveBeenCalledWith('i', expect.objectContaining({ name: 'm', schoolId: 'sc' }));
    expect(svc.adjustItemStock).toHaveBeenCalledWith('i', { delta: 2, reason: 'r', schoolId: 'sc', actorUserId: 'a' });
    expect(svc.listMovements).toHaveBeenCalledWith('i', 'sc');
    expect(svc.deleteItem).toHaveBeenCalledWith('i', 'sc');

    await ctrl.listItems({});
    expect(svc.listItems).toHaveBeenLastCalledWith(undefined);
  });
});
