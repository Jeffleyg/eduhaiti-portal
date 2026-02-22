import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  const adminEmail = "admin@eduhaiti.ht"
  const teacherEmail = "professeur@eduhaiti.ht"
  const studentEmail = "eleve@eduhaiti.ht"
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@123"
  const teacherPassword = process.env.TEACHER_PASSWORD ?? "Teacher@123"
  const studentPassword = process.env.STUDENT_PASSWORD ?? "Student@123"

  // Create or update Admin
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Admin EduHaiti",
        role: "ADMIN",
        isActive: true,
        passwordHash,
      },
    })
    console.log("✅ Admin created:", admin.email)
  }

  // Create or update Teacher
  let teacher = await prisma.user.findUnique({ where: { email: teacherEmail } })
  if (!teacher) {
    const passwordHash = await bcrypt.hash(teacherPassword, 10)
    teacher = await prisma.user.create({
      data: {
        email: teacherEmail,
        firstName: "Mme",
        lastName: "Clair",
        name: "Mme. Clair",
        role: "TEACHER",
        isActive: true,
        passwordHash,
        subjects: ["Mathématiques", "Français"],
      },
    })
    console.log("✅ Teacher created:", teacher.email)
  }

  // Create or update Student
  let student = await prisma.user.findUnique({ where: { email: studentEmail } })
  if (!student) {
    const passwordHash = await bcrypt.hash(studentPassword, 10)
    student = await prisma.user.create({
      data: {
        email: studentEmail,
        firstName: "Jean",
        lastName: "Dupont",
        name: "Jean Dupont",
        enrollmentNumber: "2026-0001",
        role: "STUDENT",
        isActive: true,
        passwordHash,
      },
    })
    console.log("✅ Student created:", student.email)
  }

  // Create School
  let school = await prisma.school.findUnique({ 
    where: { name: "EduHaiti Academy" } 
  })
  if (!school) {
    school = await prisma.school.create({
      data: {
        name: "EduHaiti Academy",
        email: "info@eduhaiti.ht",
        address: "Port-au-Prince, Haiti",
        city: "Port-au-Prince",
        country: "Haiti",
        principal: "Jean-Pierre Dessalines",
      },
    })
    console.log("✅ School created:", school.name)
  }

  // Create Academic Year
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
    console.log("✅ Academic year created:", academicYear.year)
  }

  // Create Series
  let seriesTrois = await prisma.series.findFirst({
    where: {
      academicYearId: academicYear.id,
      name: "3eme",
    },
  })

  if (!seriesTrois) {
    seriesTrois = await prisma.series.create({
      data: {
        name: "3eme",
        academicYearId: academicYear.id,
        description: "Third Year",
      },
    })
    console.log("✅ Series 3eme created")
  }

  // Create Disciplines
  const disciplineNames = [
    "Mathématiques",
    "Français",
    "Sciences Naturelles",
    "Histoire-Géographie",
    "Anglais",
  ]

  for (const name of disciplineNames) {
    const exists = await prisma.discipline.findFirst({
      where: { seriesId: seriesTrois.id, name },
    })
    if (!exists) {
      await prisma.discipline.create({
        data: {
          name,
          code: name.substring(0, 3).toUpperCase(),
          seriesId: seriesTrois.id,
          credits: 3,
        },
      })
    }
  }
  console.log(`✅ Disciplines created`)

  // Create Class
  let classA = await prisma.class.findFirst({
    where: {
      academicYearId: academicYear.id,
      seriesId: seriesTrois.id,
      name: "3eme-A",
    },
  })

  if (!classA) {
    classA = await prisma.class.create({
      data: {
        name: "3eme-A",
        level: "3eme",
        academicYearId: academicYear.id,
        seriesId: seriesTrois.id,
        teacherId: teacher.id,
        maxStudents: 30,
      },
    })
    console.log("✅ Class 3eme-A created")
  }

  // Enroll student if not already enrolled
  const enrollment = await prisma.class.findFirst({
    where: {
      id: classA.id,
      students: { some: { id: student.id } },
    },
  })

  if (!enrollment) {
    await prisma.class.update({
      where: { id: classA.id },
      data: {
        students: {
          connect: { id: student.id },
        },
      },
    })
    console.log("✅ Student enrolled in class")
  }

  console.log("\n🎉 Database seed completed!")
}  } else if (!teacher.passwordHash) {
    const passwordHash = await bcrypt.hash(teacherPassword, 10)
    await prisma.user.update({
      where: { id: teacher.id },
      data: { passwordHash },
    })
  console.log("\n🎉 Database seed completed!")
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
