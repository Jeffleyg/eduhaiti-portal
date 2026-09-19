/* eslint-disable prettier/prettier */
import { PrismaClient, Role, Gender } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Iniciando sementeira da base de dados (Seed EduHaiti)...")

  // Senhas padronizadas para testes de homologação
  const defaultPassword = process.env.DEFAULT_SEED_PASSWORD ?? "Password@123"
  const passwordHash = await bcrypt.hash(defaultPassword, 10)

  // 1. Criar ou Atualizar Super Admin (Owner da Plataforma)
  const ownerEmail = "owner@eduhaiti.ht"
  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } })
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: "Super Admin EduHaiti",
        firstName: "Super",
        lastName: "Admin",
        role: Role.OWNER,
        isActive: true,
        passwordHash,
      },
    })
    console.log("✅ Super Admin (Owner) criado:", owner.email)
  } else {
    owner = await prisma.user.update({
      where: { id: owner.id },
      data: { role: Role.OWNER, passwordHash },
    })
    console.log("✅ Super Admin (Owner) atualizado:", owner.email)
  }

  // 2. Criar ou Atualizar Escola Piloto Modelo
  let school = await prisma.school.findUnique({
    where: { name: "EduHaiti Academy" },
  })
  if (!school) {
    school = await prisma.school.create({
      data: {
        name: "EduHaiti Academy",
        email: "contact@eduhaitiacademy.ht",
        phone: "+509 3700-0000",
        address: "Rue Capois, Champ de Mars",
        city: "Port-au-Prince",
        country: "Haiti",
        principal: "Jean-Pierre Dessalines",
        enableFamilyAccess: true,
        enablePayment: true,
        enableForums: true,
        enableLessons: true,
        enableFinance: true,
        enableSync: true,
      },
    })
    console.log("✅ Escola Piloto criada:", school.name)
  } else {
    console.log("✅ Escola Piloto encontrada:", school.name)
  }

  // 3. Criar ou Atualizar Configurações Acadêmicas (AcademicSetting)
  await prisma.academicSetting.upsert({
    where: { schoolId: school.id },
    update: {
      passAverage: 10.0,
      maxAbsencesPerCourse: 5,
      assignmentLateDaysLimit: 3,
      gradeReviewWindowDays: 7,
    },
    create: {
      schoolId: school.id,
      passAverage: 10.0,
      maxAbsencesPerCourse: 5,
      assignmentLateDaysLimit: 3,
      gradeReviewWindowDays: 7,
    },
  })
  console.log("✅ Configurações Acadêmicas configuradas (Média de aprovação: 10/20)")

  // 4. Criar ou Atualizar Períodos Letivos (Trimestres MENFP)
  const periods = [
    { name: "1er Trimestre", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-15"), isOpen: false },
    { name: "2ème Trimestre", startDate: new Date("2026-01-05"), endDate: new Date("2026-03-31"), isOpen: true },
    { name: "3ème Trimestre", startDate: new Date("2026-04-10"), endDate: new Date("2026-06-30"), isOpen: false },
  ]

  for (const p of periods) {
    await prisma.academicPeriod.upsert({
      where: {
        schoolId_name: {
          schoolId: school.id,
          name: p.name,
        },
      },
      update: {
        startDate: p.startDate,
        endDate: p.endDate,
        isOpen: p.isOpen,
      },
      create: {
        schoolId: school.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        isOpen: p.isOpen,
        description: `Période officielle MENFP - ${p.name}`,
      },
    })
  }
  console.log("✅ Períodos acadêmicos (Trimestres) sincronizados")

  // 5. Criar ou Atualizar Ano Letivo e Série Curricular
  let academicYear = await prisma.academicYear.findUnique({
    where: { year: "2025-2026" },
  })
  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: {
        year: "2025-2026",
        schoolId: school.id,
        startDate: new Date("2025-09-01"),
        endDate: new Date("2026-06-30"),
        isActive: true,
      },
    })
    console.log("✅ Ano Letivo criado:", academicYear.year)
  }

  let seriesTrois = await prisma.series.findFirst({
    where: { academicYearId: academicYear.id, name: "3eme" },
  })
  if (!seriesTrois) {
    seriesTrois = await prisma.series.create({
      data: {
        name: "3eme",
        academicYearId: academicYear.id,
        description: "3ème Année Fondamentale (MENFP)",
      },
    })
    console.log("✅ Série 3eme criada")
  }

  // 6. Criar Disciplinas Oficiais (Com coeficientes/créditos)
  const disciplinesData = [
    { name: "Mathématiques", code: "MATH", credits: 5 },
    { name: "Français", code: "FRA", credits: 5 },
    { name: "Kreyòl Ayisyen", code: "KRE", credits: 4 },
    { name: "Sciences Naturelles", code: "SN", credits: 3 },
    { name: "Histoire-Géographie", code: "HG", credits: 3 },
    { name: "Anglais", code: "ANG", credits: 2 },
  ]

  for (const d of disciplinesData) {
    const exists = await prisma.discipline.findFirst({
      where: { seriesId: seriesTrois.id, name: d.name },
    })
    if (!exists) {
      await prisma.discipline.create({
        data: {
          name: d.name,
          code: d.code,
          seriesId: seriesTrois.id,
          credits: d.credits,
        },
      })
    }
  }
  console.log("✅ Disciplinas do currículo MENFP sincronizadas")

  // 7. Criar ou Atualizar Diretor / Administrador Escolar (com schoolId)
  const adminEmail = "admin@eduhaiti.ht"
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Jean-Pierre Dessalines",
        firstName: "Jean-Pierre",
        lastName: "Dessalines",
        role: Role.ADMIN,
        schoolId: school.id,
        isActive: true,
        passwordHash,
      },
    })
    console.log("✅ Diretor (Admin Escolar) criado:", admin.email)
  } else {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        schoolId: school.id,
        role: Role.ADMIN,
        passwordHash,
      },
    })
    console.log("✅ Diretor (Admin Escolar) atualizado:", admin.email)
  }

  // 8. Criar ou Atualizar 2 Professores (com schoolId e disciplinas)
  const teachersData = [
    {
      email: "professeur@eduhaiti.ht",
      firstName: "Claire",
      lastName: "Heurtelou",
      name: "Mme. Claire Heurtelou",
      subjects: ["Mathématiques", "Sciences Naturelles"],
      gender: Gender.FEMALE,
      menfpId: "ENS-2026-001",
    },
    {
      email: "professeur2@eduhaiti.ht",
      firstName: "Jacques",
      lastName: "Jean-Baptiste",
      name: "M. Jacques Jean-Baptiste",
      subjects: ["Français", "Kreyòl Ayisyen"],
      gender: Gender.MALE,
      menfpId: "ENS-2026-002",
    },
  ]

  const seededTeachers: any[] = []
  for (const t of teachersData) {
    let teacher = await prisma.user.findFirst({
      where: {
        OR: [
          { email: t.email },
          ...(t.menfpId ? [{ menfpId: t.menfpId }] : []),
        ],
      },
    })

    if (!teacher) {
      teacher = await prisma.user.create({
        data: {
          email: t.email,
          firstName: t.firstName,
          lastName: t.lastName,
          name: t.name,
          role: Role.TEACHER,
          schoolId: school.id,
          isActive: true,
          passwordHash,
          subjects: t.subjects,
          gender: t.gender,
          menfpId: t.menfpId,
        },
      })
      console.log("✅ Professor criado:", teacher.email)
    } else {
      teacher = await prisma.user.update({
        where: { id: teacher.id },
        data: {
          email: t.email,
          schoolId: school.id,
          role: Role.TEACHER,
          subjects: t.subjects,
          menfpId: t.menfpId,
          passwordHash,
        },
      })
      console.log("✅ Professor atualizado:", teacher.email)
    }
    seededTeachers.push(teacher)
  }

  // 9. Criar ou Atualizar 2 Alunos (com schoolId e matrículas)
  const studentsData = [
    {
      email: "eleve@eduhaiti.ht",
      firstName: "Jean",
      lastName: "Dupont",
      name: "Jean Dupont",
      enrollmentNumber: "2026-0001",
      gender: Gender.MALE,
      dateOfBirth: new Date("2011-04-12"),
      address: "Delmas 33, Port-au-Prince",
    },
    {
      email: "eleve2@eduhaiti.ht",
      firstName: "Marie",
      lastName: "Flore",
      name: "Marie Flore",
      enrollmentNumber: "2026-0002",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("2011-08-23"),
      address: "Pétion-Ville, Port-au-Prince",
    },
  ]

  const seededStudents: any[] = []
  for (const s of studentsData) {
    let student = await prisma.user.findFirst({
      where: {
        OR: [
          { email: s.email },
          { enrollmentNumber: s.enrollmentNumber },
        ],
      },
    })

    if (!student) {
      student = await prisma.user.create({
        data: {
          email: s.email,
          firstName: s.firstName,
          lastName: s.lastName,
          name: s.name,
          role: Role.STUDENT,
          schoolId: school.id,
          enrollmentNumber: s.enrollmentNumber,
          gender: s.gender,
          dateOfBirth: s.dateOfBirth,
          address: s.address,
          isActive: true,
          passwordHash,
        },
      })
      console.log("✅ Aluno criado:", student.email)
    } else {
      student = await prisma.user.update({
        where: { id: student.id },
        data: {
          email: s.email,
          schoolId: school.id,
          role: Role.STUDENT,
          enrollmentNumber: s.enrollmentNumber,
          passwordHash,
        },
      })
      console.log("✅ Aluno atualizado:", student.email)
    }
    seededStudents.push(student)
  }

  // 10. Criar 2 Turmas (3eme-A e 3eme-B) e matricular alunos
  const classesData = [
    { name: "3eme-A", teacherId: seededTeachers[0]?.id, studentId: seededStudents[0]?.id },
    { name: "3eme-B", teacherId: seededTeachers[1]?.id, studentId: seededStudents[1]?.id },
  ]

  for (const c of classesData) {
    let klass = await prisma.class.findFirst({
      where: {
        academicYearId: academicYear.id,
        seriesId: seriesTrois.id,
        name: c.name,
      },
    })

    if (!klass) {
      klass = await prisma.class.create({
        data: {
          name: c.name,
          level: "3eme",
          academicYearId: academicYear.id,
          seriesId: seriesTrois.id,
          teacherId: c.teacherId,
          maxStudents: 30,
        },
      })
      console.log(`✅ Turma ${c.name} criada`)
    } else {
      klass = await prisma.class.update({
        where: { id: klass.id },
        data: { teacherId: c.teacherId },
      })
    }

    if (c.studentId) {
      const isEnrolled = await prisma.class.findFirst({
        where: {
          id: klass.id,
          students: { some: { id: c.studentId } },
        },
      })

      if (!isEnrolled) {
        await prisma.class.update({
          where: { id: klass.id },
          data: {
            students: {
              connect: { id: c.studentId },
            },
          },
        })
        console.log(`✅ Aluno enturmado na turma ${c.name}`)
      }
    }
  }

  console.log("\n🎉 Sementeira concluída com sucesso!")
  console.log("--------------------------------------------------")
  console.log("Credenciais de Teste (Senha padrão: Password@123):")
  console.log(" • Diretor (Admin): admin@eduhaiti.ht")
  console.log(" • Professor 1:     professeur@eduhaiti.ht (Turma: 3eme-A)")
  console.log(" • Professor 2:     professeur2@eduhaiti.ht (Turma: 3eme-B)")
  console.log(" • Aluno 1:         eleve@eduhaiti.ht (Turma: 3eme-A)")
  console.log(" • Aluno 2:         eleve2@eduhaiti.ht (Turma: 3eme-B)")
  console.log(" • Super Admin:     owner@eduhaiti.ht")
  console.log("--------------------------------------------------")
}

main()
  .catch((e) => {
    console.error("❌ Erro durante o seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

