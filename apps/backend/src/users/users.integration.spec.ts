import { ServiceUnavailableException } from "@nestjs/common"
import { describe, expect, it, jest } from "@jest/globals"
import { Role } from "@prisma/client"
import { EmailService } from "../common/services/email.service"
import { UsersService } from "./users.service"

interface StoredUser {
  id: string
  email: string
  role: Role
  isActive: boolean
  enrollmentNumber: string
}

class FakePrismaForUsers {
  private users: StoredUser[] = []

  user = {
    findUnique: async ({ where }: any) => {
      if (where?.email) {
        return this.users.find((item) => item.email === where.email) ?? null
      }

      if (where?.id) {
        return this.users.find((item) => item.id === where.id) ?? null
      }

      return null
    },
    count: async ({ where }: any) => {
      const prefix = where?.enrollmentNumber?.startsWith
      if (!prefix) {
        return this.users.length
      }

      return this.users.filter((item) => item.enrollmentNumber.startsWith(prefix)).length
    },
  }

  class = {
    findUnique: async () => null,
    updateMany: async () => ({ count: 0 }),
    create: async () => ({}),
  }

  academicYear = {
    findFirst: async () => ({ id: "year-1" }),
  }

  series = {
    findFirst: async () => ({ id: "series-1" }),
  }

  async $transaction<T>(callback: (tx: any) => Promise<T>) {
    const stagedUsers = [...this.users]

    const tx = {
      user: {
        create: async ({ data }: any) => {
          const created: StoredUser = {
            id: `user-${stagedUsers.length + 1}`,
            email: data.email,
            role: data.role,
            isActive: true,
            enrollmentNumber: data.enrollmentNumber,
          }
          stagedUsers.push(created)
          return created
        },
        update: async ({ where, data }: any) => {
          const index = stagedUsers.findIndex((item) => item.id === where.id)
          if (index < 0) {
            throw new Error("User not found")
          }
          stagedUsers[index] = {
            ...stagedUsers[index],
            ...data,
          }
          return stagedUsers[index]
        },
      },
      class: this.class,
      academicYear: this.academicYear,
      series: this.series,
    }

    try {
      const result = await callback(tx)
      this.users = stagedUsers
      return result
    } catch (error) {
      throw error
    }
  }

  findByEmail(email: string) {
    return this.users.find((item) => item.email === email) ?? null
  }
}

describe("UsersService transactional behavior", () => {
  it("rolls back student creation when temp password email fails", async () => {
    const prisma = new FakePrismaForUsers()
    const emailService = {
      sendTempPasswordEmail: jest
        .fn<() => Promise<void>>()
        .mockRejectedValue(new ServiceUnavailableException("SMTP configuration is missing")),
    }

    const service = new UsersService(
      prisma as any,
      emailService as unknown as EmailService,
    )

    await expect(
      service.createStudent({
        email: "student.rollback@example.com",
        firstName: "Student",
        lastName: "Rollback",
        dateOfBirth: "2012-03-01",
        address: "Port-au-Prince",
        gender: "FEMALE" as any,
        fatherName: "Parent A",
        motherName: "Parent B",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)

    expect(prisma.findByEmail("student.rollback@example.com")).toBeNull()
    expect(emailService.sendTempPasswordEmail).toHaveBeenCalledTimes(1)
  })
})
