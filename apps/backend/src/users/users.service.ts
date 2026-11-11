import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { EmailService } from '../common/services/email.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { GuardiansService } from './guardians.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly guardians: GuardiansService,
  ) {}

  findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
  }

  /**
   * Next "YYYY-NNNN" after the highest number issued this year. Using the highest
   * number (not a count) keeps numbers unique after students are deleted.
   */
  private async generateEnrollmentNumber() {
    const year = new Date().getFullYear();
    const latest = await this.prisma.user.findFirst({
      where: { enrollmentNumber: { startsWith: `${year}-` } },
      orderBy: { enrollmentNumber: 'desc' },
      select: { enrollmentNumber: true },
    });
    const lastSequence = Number(latest?.enrollmentNumber?.split('-')[1]);
    const next = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
    return `${year}-${String(next).padStart(4, '0')}`;
  }

  /** 10 random alphanumeric characters. */
  private generateTempPassword() {
    return randomBytes(16)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 10);
  }

  /**
   * Emails the temporary password. When email is unavailable the password is returned
   * once to the authenticated admin, who passes it on; it is never written to logs.
   */
  private async deliverTempPassword(
    email: string,
    tempPassword: string,
    expiresAt: Date,
  ) {
    const emailSent = await this.emailService
      .sendTempPasswordEmail(email, tempPassword, expiresAt)
      .catch(() => false);
    return emailSent ? { emailSent } : { emailSent, tempPassword };
  }

  async createStudent(payload: CreateStudentDto, schoolId?: string) {
    const normalizedEmail = payload.email.trim().toLowerCase();

    // 1. Validar e-mail duplicado
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new BadRequestException(
        'Já existe um utilizador registado com este e-mail',
      );
    }

    // 2. Garantir filiação com valores padrão se não preenchidos
    const fatherName = payload.fatherName?.trim() || null;
    const motherName = payload.motherName?.trim() || null;

    // 3. Validar ou atribuir data de nascimento válida
    let dateOfBirth: Date;
    if (payload.dateOfBirth) {
      const parsedDate = new Date(payload.dateOfBirth);
      dateOfBirth = isNaN(parsedDate.getTime())
        ? new Date('2010-01-01')
        : parsedDate;
    } else {
      dateOfBirth = new Date('2010-01-01');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const enrollmentNumber = await this.generateEnrollmentNumber();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const fullName =
      `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || 'Élève';

    // 4. Resolver a escola da turma ou utilizar a do utilizador autenticado
    let resolvedSchoolId = schoolId;
    if (payload.classId) {
      const classExists = await this.prisma.class.findUnique({
        where: { id: payload.classId },
        select: { id: true, academicYear: { select: { schoolId: true } } },
      });
      if (!classExists) {
        throw new BadRequestException('Turma selecionada não encontrada');
      }
      if (schoolId && classExists.academicYear.schoolId !== schoolId) {
        throw new BadRequestException('Class belongs to another school');
      }
      resolvedSchoolId ??= classExists.academicYear.schoolId;
    }

    // 5. Aluno e responsáveis (telefones) são criados juntos
    const guardianInputs = GuardiansService.fromStudentForm(payload);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: fullName,
          firstName: payload.firstName,
          lastName: payload.lastName,
          dateOfBirth,
          address: payload.address || null,
          gender: payload.gender || null,
          fatherName,
          motherName,
          enrollmentNumber,
          schoolId: resolvedSchoolId,
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
          role: Role.STUDENT,
          isActive: true,
          ...(payload.classId && {
            classesAttending: { connect: [{ id: payload.classId }] },
          }),
        },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          enrollmentNumber: true,
        },
      });
      if (guardianInputs.length > 0) {
        await this.guardians.replaceForStudent(created.id, guardianInputs, tx);
      }
      return created;
    });

    // 6. E-mail depois da criação; a senha só volta na resposta se o envio falhar.
    return {
      ...user,
      ...(await this.deliverTempPassword(
        normalizedEmail,
        tempPassword,
        expiresAt,
      )),
    };
  }

  async createTeacher(payload: CreateTeacherDto, schoolId?: string) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new BadRequestException('User already exists with this email');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const enrollmentNumber = await this.generateEnrollmentNumber();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const fullName = `${payload.firstName} ${payload.lastName}`.trim();
    let resolvedSchoolId = schoolId;

    if (schoolId && payload.classIds && payload.classIds.length > 0) {
      const foreignClass = await this.prisma.class.findFirst({
        where: {
          id: { in: payload.classIds },
          academicYear: { schoolId: { not: schoolId } },
        },
        select: { id: true },
      });
      if (foreignClass) {
        throw new BadRequestException('Class belongs to another school');
      }
    }

    const requestedYearIds = (payload.newClasses ?? [])
      .map((item) => item.academicYearId)
      .filter((id): id is string => Boolean(id));
    if (schoolId && requestedYearIds.length > 0) {
      const foreignYear = await this.prisma.academicYear.findFirst({
        where: { id: { in: requestedYearIds }, schoolId: { not: schoolId } },
        select: { id: true },
      });
      if (foreignYear) {
        throw new BadRequestException(
          'Academic year belongs to another school',
        );
      }
    }

    if (!resolvedSchoolId && payload.classIds && payload.classIds.length > 0) {
      const firstClass = await this.prisma.class.findFirst({
        where: { id: { in: payload.classIds } },
        select: { academicYear: { select: { schoolId: true } } },
      });

      resolvedSchoolId = firstClass?.academicYear.schoolId;
    }

    if (
      !resolvedSchoolId &&
      payload.newClasses &&
      payload.newClasses.length > 0
    ) {
      const firstAcademicYearId = payload.newClasses[0].academicYearId;
      if (firstAcademicYearId) {
        const academicYear = await this.prisma.academicYear.findUnique({
          where: { id: firstAcademicYearId },
          select: { schoolId: true },
        });

        resolvedSchoolId = academicYear?.schoolId;
      }
    }

    const createdTeacher = await this.prisma.$transaction(async (tx) => {
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
          schoolId: resolvedSchoolId,
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
          role: Role.TEACHER,
          subjects: payload.subjects ?? [],
        },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          enrollmentNumber: true,
        },
      });

      if (payload.classIds && payload.classIds.length > 0) {
        await tx.class.updateMany({
          where: { id: { in: payload.classIds } },
          data: { teacherId: user.id },
        });
      }

      if (payload.newClasses && payload.newClasses.length > 0) {
        // Fetch defaults if not provided, scoped to the teacher's school
        const yearScope = resolvedSchoolId
          ? { schoolId: resolvedSchoolId }
          : {};
        const defaultAcademicYear = await tx.academicYear.findFirst({
          where: yearScope,
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        });
        const defaultSeries = await tx.series.findFirst({
          where: resolvedSchoolId
            ? { academicYear: { schoolId: resolvedSchoolId } }
            : {},
        });

        if (!defaultAcademicYear || !defaultSeries) {
          throw new BadRequestException(
            'No academic year or series found in database',
          );
        }

        for (const newClass of payload.newClasses) {
          await tx.class.create({
            data: {
              name: newClass.name,
              level: newClass.level ?? '3eme',
              teacherId: user.id,
              academicYearId: newClass.academicYearId ?? defaultAcademicYear.id,
              seriesId: newClass.seriesId ?? defaultSeries.id,
            },
          });
        }
      }

      return user;
    });

    // Sent only after the commit, so nobody gets a password for a rolled-back account.
    return {
      ...createdTeacher,
      ...(await this.deliverTempPassword(
        normalizedEmail,
        tempPassword,
        expiresAt,
      )),
    };
  }

  async resendTempPassword(email: string, schoolId?: string | null) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        schoolId: true,
      },
    });

    if (!user || (schoolId && user.schoolId !== schoolId)) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      throw new BadRequestException('User is inactive');
    }

    if (user.role !== Role.STUDENT && user.role !== Role.TEACHER) {
      throw new BadRequestException(
        'Temporary password can only be resent to students or teachers',
      );
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
        },
      });
    });

    return {
      success: true,
      email: user.email,
      expiresAt,
      ...(await this.deliverTempPassword(user.email, tempPassword, expiresAt)),
    };
  }

  async findAllStudents(schoolId?: string) {
    return this.prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        ...(schoolId
          ? {
              OR: [
                { schoolId },
                {
                  classesAttending: {
                    some: { academicYear: { schoolId } },
                  },
                },
              ],
            }
          : {}),
      },
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
      orderBy: { name: 'asc' },
    });
  }

  async findAllTeachers(schoolId?: string) {
    return this.prisma.user.findMany({
      where: {
        role: Role.TEACHER,
        ...(schoolId
          ? {
              OR: [
                { schoolId },
                {
                  classesTeaching: {
                    some: { academicYear: { schoolId } },
                  },
                },
              ],
            }
          : {}),
      },
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
      orderBy: { name: 'asc' },
    });
  }
}
