import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { AcademicRequestStatus, Role } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { CreateAcademicRequestDto } from "./dto/create-academic-request.dto"
import { ListAcademicRequestsDto } from "./dto/list-academic-requests.dto"
import { ReviewAcademicRequestDto } from "./dto/review-academic-request.dto"

type Reviewer = {
  id: string
  role: Role
}

@Injectable()
export class AcademicRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(studentId: string, dto: CreateAcademicRequestDto) {
    const normalizedTitle = dto.title.trim()
    const normalizedDetails = dto.details.trim()

    if (!normalizedTitle || !normalizedDetails) {
      throw new BadRequestException("title and details must not be blank")
    }

    if (dto.classId) {
      const selectedClass = await this.prisma.class.findUnique({
        where: { id: dto.classId },
        select: {
          id: true,
          students: {
            where: { id: studentId },
            select: { id: true },
          },
        },
      })

      if (!selectedClass) {
        throw new BadRequestException("Selected class was not found")
      }

      if (selectedClass.students.length === 0) {
        throw new ForbiddenException("Student is not enrolled in the selected class")
      }
    }

    const request = await this.prisma.academicRequest.create({
      data: {
        studentId,
        classId: dto.classId,
        type: dto.type,
        title: normalizedTitle,
        details: normalizedDetails,
      },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        class: {
          select: { id: true, name: true, level: true, teacherId: true },
        },
      },
    })

    await this.prisma.auditLog.create({
      data: {
        entityType: "AcademicRequest",
        entityId: request.id,
        action: "CREATE",
        userId: studentId,
        changes: JSON.stringify({ type: dto.type, classId: dto.classId ?? null }),
      },
    })

    return request
  }

  async listMine(studentId: string) {
    return this.prisma.academicRequest.findMany({
      where: { studentId },
      include: {
        class: {
          select: { id: true, name: true, level: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async listForReview(reviewer: Reviewer, filters: ListAcademicRequestsDto) {
    if (reviewer.role === Role.ADMIN) {
      return this.prisma.academicRequest.findMany({
        where: {
          classId: filters.classId,
          status: filters.status,
        },
        include: {
          student: {
            select: { id: true, name: true, email: true },
          },
          class: {
            select: { id: true, name: true, level: true, teacherId: true },
          },
          reviewedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    }

    if (reviewer.role !== Role.TEACHER) {
      throw new ForbiddenException("Only teachers or admins can review requests")
    }

    if (filters.classId) {
      const teacherClass = await this.prisma.class.findFirst({
        where: {
          id: filters.classId,
          teacherId: reviewer.id,
        },
        select: { id: true },
      })

      if (!teacherClass) {
        throw new ForbiddenException("Teacher does not manage this class")
      }
    }

    return this.prisma.academicRequest.findMany({
      where: {
        classId: filters.classId,
        status: filters.status,
        class: {
          teacherId: reviewer.id,
        },
      },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        class: {
          select: { id: true, name: true, level: true, teacherId: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async reviewRequest(requestId: string, reviewer: Reviewer, dto: ReviewAcademicRequestDto) {
    const request = await this.prisma.academicRequest.findUnique({
      where: { id: requestId },
      include: {
        class: {
          select: { id: true, teacherId: true },
        },
      },
    })

    if (!request) {
      throw new NotFoundException("Academic request not found")
    }

    if (request.status !== AcademicRequestStatus.PENDING) {
      throw new BadRequestException("Request has already been reviewed")
    }

    if (reviewer.role === Role.TEACHER) {
      if (!request.class || request.class.teacherId !== reviewer.id) {
        throw new ForbiddenException("Teacher cannot review this request")
      }
    } else if (reviewer.role !== Role.ADMIN) {
      throw new ForbiddenException("Only teachers or admins can review requests")
    }

    if (dto.status === AcademicRequestStatus.PENDING) {
      throw new BadRequestException("Cannot move a reviewed request back to PENDING")
    }

    const normalizedResolutionComment = dto.resolutionComment?.trim() || null

    if (dto.status === AcademicRequestStatus.REJECTED && !normalizedResolutionComment) {
      throw new BadRequestException("resolutionComment is required when rejecting a request")
    }

    const updated = await this.prisma.academicRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        reviewedById: reviewer.id,
        resolutionComment: normalizedResolutionComment,
        resolvedAt:
          dto.status === AcademicRequestStatus.APPROVED || dto.status === AcademicRequestStatus.REJECTED
            ? new Date()
            : null,
      },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        class: {
          select: { id: true, name: true, level: true, teacherId: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    await this.prisma.auditLog.create({
      data: {
        entityType: "AcademicRequest",
        entityId: updated.id,
        action: "REVIEW",
        userId: reviewer.id,
        changes: JSON.stringify({ status: dto.status, resolutionComment: normalizedResolutionComment }),
      },
    })

    return updated
  }
}
