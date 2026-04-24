import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { EmailService } from "../common/services/email.service"
import { CreateStudentDto } from "./dto/create-student.dto"
import { CreateTeacherDto } from "./dto/create-teacher.dto"

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
  }

  private async generateEnrollmentNumber() {
    const year = new Date().getFullYear()
    const count = await this.prisma.user.count({
      where: { enrollmentNumber: { startsWith: `${year}-` } },
    })
    const next = count + 1
    return `${year}-${String(next).padStart(4, "0")}`
  }

  private generateTempPassword() {
    return randomBytes(6).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)
  }

  async createStudent(payload: CreateStudentDto) {
    const normalizedEmail = payload.email.trim().toLowerCase()
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      throw new BadRequestException("User already exists with this email")
    }

    if (!payload.fatherName?.trim() && !payload.motherName?.trim()) {
      throw new BadRequestException("At least one parent/guardian name is required")
    }

    const tempPassword = this.generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 10)
    const enrollmentNumber = await this.generateEnrollmentNumber()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const fullName = `${payload.firstName} ${payload.lastName}`.trim()

    // Validate class exists if classId is provided
    if (payload.classId) {
      const classExists = await this.prisma.class.findUnique({ where: { id: payload.classId } })
      if (!classExists) {
        throw new BadRequestException("Class not found")
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: fullName,
          firstName: payload.firstName,
          lastName: payload.lastName,
          dateOfBirth: new Date(payload.dateOfBirth),
          address: payload.address,
          gender: payload.gender,
          fatherName: payload.fatherName,
          motherName: payload.motherName,
          enrollmentNumber,
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
          role: Role.STUDENT,
          ...(payload.classId && { classesAttending: { connect: [{ id: payload.classId }] } }),
        },
        select: { id: true, email: true, role: true, name: true, enrollmentNumber: true },
      })

      await this.emailService.sendTempPasswordEmail(normalizedEmail, tempPassword, expiresAt)

      return user
    })
  }

  async createTeacher(payload: CreateTeacherDto) {
    const normalizedEmail = payload.email.trim().toLowerCase()
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      throw new BadRequestException("User already exists with this email")
    }

    const tempPassword = this.generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 10)
    const enrollmentNumber = await this.generateEnrollmentNumber()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const fullName = `${payload.firstName} ${payload.lastName}`.trim()

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: fullName,
          firstName: payload.firstName,
          lastName: payload.lastName,
          dateOfBirth: new Date(payload.dateOfBirth),
          address: payload.address,
          gender: payload.gender,
          fatherName: payload.fatherName,
          motherName: payload.motherName,
          enrollmentNumber,
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
          role: Role.TEACHER,
          subjects: payload.subjects ?? [],
        },
        select: { id: true, email: true, role: true, name: true, enrollmentNumber: true },
      })

      if (payload.classIds && payload.classIds.length > 0) {
        await tx.class.updateMany({
          where: { id: { in: payload.classIds } },
          data: { teacherId: user.id },
        })
      }

      if (payload.newClasses && payload.newClasses.length > 0) {
        // Fetch defaults if not provided
        const defaultAcademicYear = await tx.academicYear.findFirst()
        const defaultSeries = await tx.series.findFirst()

        if (!defaultAcademicYear || !defaultSeries) {
          throw new BadRequestException("No academic year or series found in database")
        }

        for (const newClass of payload.newClasses) {
          await tx.class.create({
            data: {
              name: newClass.name,
              level: newClass.level ?? "3eme",
              teacherId: user.id,
              academicYearId: newClass.academicYearId ?? defaultAcademicYear.id,
              seriesId: newClass.seriesId ?? defaultSeries.id,
            },
          })
        }
      }

      await this.emailService.sendTempPasswordEmail(normalizedEmail, tempPassword, expiresAt)

      return user
    })
  }

  async resendTempPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, role: true, isActive: true },
    })

    if (!user) {
      throw new NotFoundException("User not found")
    }

    if (!user.isActive) {
      throw new BadRequestException("User is inactive")
    }

    if (user.role !== Role.STUDENT && user.role !== Role.TEACHER) {
      throw new BadRequestException("Temporary password can only be resent to students or teachers")
    }

    const tempPassword = this.generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 10)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
        },
      })

      await this.emailService.sendTempPasswordEmail(user.email, tempPassword, expiresAt)
    })

    return {
      success: true,
      email: user.email,
      expiresAt,
    }
  }

  async findAllStudents() {
    return this.prisma.user.findMany({
      where: { role: Role.STUDENT },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        fatherName: true,
        motherName: true,
        enrollmentNumber: true,
        classesAttending: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    })
  }

  async findAllTeachers() {
    return this.prisma.user.findMany({
      where: { role: Role.TEACHER },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        enrollmentNumber: true,
        subjects: true,
        classesTeaching: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    })
  }
}
