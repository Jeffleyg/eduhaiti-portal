import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import { Role } from "@prisma/client"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { ForumsService } from "./forums.service"

@Controller("forums")
@UseGuards(JwtAuthGuard)
export class ForumsController {
  constructor(private readonly forumsService: ForumsService) {}

  @Get("class/:classId/threads")
  listThreads(
    @Param("classId") classId: string,
    @Req() req: { user?: { sub?: string; role?: Role } },
  ) {
    return this.forumsService.listThreads(classId, {
      id: req.user?.sub ?? "",
      role: (req.user?.role as Role) ?? Role.STUDENT,
    })
  }

  @Post("class/:classId/threads")
  createThread(
    @Param("classId") classId: string,
    @Body() body: { title: string; body: string },
    @Req() req: { user?: { sub?: string; role?: Role } },
  ) {
    return this.forumsService.createThread(classId, body, {
      id: req.user?.sub ?? "",
      role: (req.user?.role as Role) ?? Role.STUDENT,
    })
  }

  @Get("threads/:threadId/posts")
  listPosts(
    @Param("threadId") threadId: string,
    @Req() req: { user?: { sub?: string; role?: Role } },
  ) {
    return this.forumsService.listPosts(threadId, {
      id: req.user?.sub ?? "",
      role: (req.user?.role as Role) ?? Role.STUDENT,
    })
  }

  @Post("threads/:threadId/posts")
  createPost(
    @Param("threadId") threadId: string,
    @Body() body: { body: string },
    @Req() req: { user?: { sub?: string; role?: Role } },
  ) {
    return this.forumsService.createPost(threadId, body, {
      id: req.user?.sub ?? "",
      role: (req.user?.role as Role) ?? Role.STUDENT,
    })
  }
}
