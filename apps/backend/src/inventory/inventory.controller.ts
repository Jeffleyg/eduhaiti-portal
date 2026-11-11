import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { InventoryService } from './inventory.service';

type ItemType = 'TEXTBOOK' | 'UNIFORM' | 'MEAL_KIT' | 'DEVICE' | 'OTHER';
type AuthRequest = { user?: { sub?: string; schoolId?: string | null } };

/** The school always comes from the token, never from the request body or query. */
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('admin/items')
  listItems(@Req() req: AuthRequest) {
    return this.inventoryService.listItems(req.user?.schoolId);
  }

  @Post('admin/items')
  createItem(
    @Req() req: AuthRequest,
    @Body()
    payload: {
      name: string;
      itemType?: ItemType;
      quantity?: number;
      minThreshold?: number;
      unit?: string;
      notes?: string;
    },
  ) {
    return this.inventoryService.createItem({
      name: payload.name,
      itemType: payload.itemType,
      quantity: payload.quantity,
      minThreshold: payload.minThreshold,
      unit: payload.unit,
      notes: payload.notes,
      schoolId: req.user?.schoolId,
      actorUserId: req.user?.sub,
    });
  }

  @Patch('admin/items/:itemId')
  updateItem(
    @Req() req: AuthRequest,
    @Param('itemId') itemId: string,
    @Body()
    payload: {
      name?: string;
      itemType?: ItemType;
      minThreshold?: number;
      unit?: string;
      notes?: string;
    },
  ) {
    return this.inventoryService.updateItem(itemId, {
      name: payload.name,
      itemType: payload.itemType,
      minThreshold: payload.minThreshold,
      unit: payload.unit,
      notes: payload.notes,
      schoolId: req.user?.schoolId,
    });
  }

  @Post('admin/items/:itemId/adjust')
  adjustStock(
    @Req() req: AuthRequest,
    @Param('itemId') itemId: string,
    @Body() payload: { delta: number; reason: string },
  ) {
    return this.inventoryService.adjustItemStock(itemId, {
      delta: payload.delta,
      reason: payload.reason,
      schoolId: req.user?.schoolId,
      actorUserId: req.user?.sub,
    });
  }

  @Get('admin/items/:itemId/movements')
  listMovements(@Req() req: AuthRequest, @Param('itemId') itemId: string) {
    return this.inventoryService.listMovements(itemId, req.user?.schoolId);
  }

  @Delete('admin/items/:itemId')
  deleteItem(@Req() req: AuthRequest, @Param('itemId') itemId: string) {
    return this.inventoryService.deleteItem(itemId, req.user?.schoolId);
  }
}
