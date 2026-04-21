import { Body, Controller, Post } from "@nestjs/common"
import { PullSyncDto } from "./dto/pull-sync.dto"
import { PushSyncDto } from "./dto/push-sync.dto"
import { SyncService } from "./sync.service"

@Controller("sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post("push")
  async push(@Body() dto: PushSyncDto) {
    return this.syncService.push(dto)
  }

  @Post("pull")
  async pull(@Body() dto: PullSyncDto) {
    return this.syncService.pull(dto)
  }
}
