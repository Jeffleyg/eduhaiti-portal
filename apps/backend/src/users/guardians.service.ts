import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type GuardianInput = {
  fullName: string;
  phoneNumber: string;
  relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN';
  documentId?: string | null;
};

type Db = Prisma.TransactionClient | PrismaService;

/** Keeps a leading "+" and the digits only, e.g. "+509 3712-3456" -> "+50937123456". */
export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/** Phone lengths accepted for Haitian (8 digits) and international numbers. */
const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;

/**
 * Guardians (Guardian + GuardianStudent). They are what SMS absence alerts, the
 * SMS/USSD/IVR gateway and the family portal OTP use to recognise a family.
 */
@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  /** Builds guardian inputs from the father/mother fields of the student form. */
  static fromStudentForm(form: {
    fatherName?: string | null;
    fatherPhone?: string | null;
    motherName?: string | null;
    motherPhone?: string | null;
    lastName?: string | null;
  }): GuardianInput[] {
    const guardians: GuardianInput[] = [];
    if (form.fatherPhone?.trim()) {
      guardians.push({
        fullName:
          form.fatherName?.trim() || `Pai ${form.lastName ?? ''}`.trim(),
        phoneNumber: form.fatherPhone,
        relationship: 'FATHER',
      });
    }
    if (form.motherPhone?.trim()) {
      guardians.push({
        fullName:
          form.motherName?.trim() || `Mãe ${form.lastName ?? ''}`.trim(),
        phoneNumber: form.motherPhone,
        relationship: 'MOTHER',
      });
    }
    return guardians;
  }

  private validate(guardians: GuardianInput[]) {
    for (const guardian of guardians) {
      const digits = guardian.phoneNumber.replace(/\D/g, '');
      if (
        digits.length < MIN_PHONE_DIGITS ||
        digits.length > MAX_PHONE_DIGITS
      ) {
        throw new BadRequestException(
          `Invalid phone number: ${guardian.phoneNumber}`,
        );
      }
      if (!guardian.fullName?.trim()) {
        throw new BadRequestException('Guardian name is required');
      }
    }
  }

  /**
   * Makes `guardians` the exact set linked to the student. A guardian already known by
   * the same phone (and document) is reused, so siblings share one record.
   */
  async replaceForStudent(
    studentId: string,
    guardians: GuardianInput[],
    db: Db = this.prisma,
  ) {
    this.validate(guardians);

    const linkedIds: string[] = [];
    for (const input of guardians) {
      const phoneNumber = normalizePhone(input.phoneNumber);
      const documentId = input.documentId?.trim() || null;
      const existing = await db.guardian.findFirst({
        where: { phoneNumber, documentId },
      });
      const guardian = existing
        ? await db.guardian.update({
            where: { id: existing.id },
            data: {
              fullName: input.fullName.trim(),
              relationship: input.relationship,
            },
          })
        : await db.guardian.create({
            data: {
              fullName: input.fullName.trim(),
              phoneNumber,
              documentId,
              relationship: input.relationship,
            },
          });

      await db.guardianStudent.upsert({
        where: { guardianId_studentId: { guardianId: guardian.id, studentId } },
        update: {},
        create: { guardianId: guardian.id, studentId },
      });
      linkedIds.push(guardian.id);
    }

    await db.guardianStudent.deleteMany({
      where: { studentId, guardianId: { notIn: linkedIds } },
    });

    return this.listForStudent(studentId, db);
  }

  async listForStudent(studentId: string, db: Db = this.prisma) {
    const links = await db.guardianStudent.findMany({
      where: { studentId },
      select: {
        guardian: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            documentId: true,
            relationship: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return links.map((link) => link.guardian);
  }

  /** Loads a student of the admin's school, or reports it as missing. */
  async assertStudentInSchool(studentId: string, schoolId?: string | null) {
    const student = schoolId
      ? await this.prisma.user.findFirst({
          where: { id: studentId, role: 'STUDENT', schoolId },
          select: { id: true },
        })
      : null;
    if (!student) {
      throw new NotFoundException('Student not found');
    }
  }
}
