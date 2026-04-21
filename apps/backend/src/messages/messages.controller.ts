import { Controller, Get, Param, Post, Body, Req, UseGuards } from "@nestjs/common"
import { MessagesService } from "./messages.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Role } from "@prisma/client"

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
  @Get("recipients")
  async getRecipients(@Req() req: { user?: { sub?: string; role?: string } }) {
    const userId = req.user?.sub
    const role = (req.user?.role as Role | undefined) ?? Role.STUDENT
    return this.messagesService.listRecipients(userId ?? "", role)
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async sendMessage(@Body() body: any, @Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub
    return this.messagesService.send(userId ?? "", body.toId, body.subject, body.body)
  }
}
