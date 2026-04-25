import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { createHash } from "crypto"

@Injectable()
export class ScorecardsService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyPublicScorecard(scorecardId: string) {
    const scorecard = await this.prisma.scorecard.findUnique({
      where: { id: scorecardId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            enrollmentNumber: true,
          },
        },
        academicYear: {
          select: {
            id: true,
            year: true,
          },
        },
        series: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!scorecard) {
      throw new NotFoundException("Scorecard not found")
    }

    const verificationSource = [
      scorecard.id,
      scorecard.studentId,
      scorecard.academicYearId,
      scorecard.semester,
      scorecard.averageScore ?? "-",
      scorecard.generatedAt?.toISOString() ?? "-",
    ].join("|")

    const digest = createHash("sha256").update(verificationSource).digest("hex")

    return {
      valid: Boolean(scorecard.generatedAt),
      verificationHash: digest,
      scorecard: {
        id: scorecard.id,
        semester: scorecard.semester,
        averageScore: scorecard.averageScore,
        passStatus: scorecard.passStatus,
        ranking: scorecard.ranking,
        observations: scorecard.observations,
        generatedAt: scorecard.generatedAt,
        pdfPath: scorecard.pdfPath,
      },
      student: scorecard.student,
      academicYear: scorecard.academicYear,
      series: scorecard.series,
    }
  }
}
