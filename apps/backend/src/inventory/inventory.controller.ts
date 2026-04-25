import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { Role } from "@prisma/client"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { RolesGuard } from "../common/guards/roles.guard"
import { InventoryService } from "./inventory.service"

@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get("admin/items")
  listItems(@Query("schoolId") schoolId?: string) {
    return this.inventoryService.listItems(schoolId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post("admin/items")
  createItem(
    @Req() req: { user?: { sub?: string } },
    @Body()
    payload: {
      schoolId: string
      name: string
      itemType?: "TEXTBOOK" | "UNIFORM" | "MEAL_KIT" | "DEVICE" | "OTHER"
      quantity?: number
      minThreshold?: number
      unit?: string
      notes?: string
    },
  ) {
    return this.inventoryService.createItem({
      ...payload,
      actorUserId: req.user?.sub,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch("admin/items/:itemId")
  updateItem(
    @Req() req: { user?: { sub?: string } },
    @Param("itemId") itemId: string,
    @Body()
    payload: {
      name?: string
      itemType?: "TEXTBOOK" | "UNIFORM" | "MEAL_KIT" | "DEVICE" | "OTHER"
      quantity?: number
      minThreshold?: number
      unit?: string
      notes?: string
    },
  ) {
    return this.inventoryService.updateItem(itemId, {
      ...payload,
      actorUserId: req.user?.sub,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post("admin/items/:itemId/adjust")
  adjustStock(
    @Req() req: { user?: { sub?: string } },
    @Param("itemId") itemId: string,
    @Body() payload: { delta: number; reason: string },
  ) {
    return this.inventoryService.adjustItemStock(itemId, {
      ...payload,
      actorUserId: req.user?.sub,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete("admin/items/:itemId")
  deleteItem(
    @Req() req: { user?: { sub?: string } },
    @Param("itemId") itemId: string,
  ) {
    return this.inventoryService.deleteItem(itemId, req.user?.sub)
  }
}
