import { Controller, Get, Param, Post, Body, Req, UseGuards } from "@nestjs/common"
import { MessagesService } from "./messages.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"

@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @UseGuards(JwtAuthGuard)
  @Get("inbox")
  async getInbox(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub
    return this.messagesService.findReceivedBy(userId ?? "")
  }

  @UseGuards(JwtAuthGuard)
  @Get("sent")
  async getSent(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub
    return this.messagesService.findSentBy(userId ?? "")
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async sendMessage(@Body() body: any, @Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub
    return this.messagesService.send(userId ?? "", body.toId, body.subject, body.body)
  }
}
