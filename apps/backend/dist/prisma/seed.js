"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("🌱 Seeding database...");
    const adminEmail = "admin@eduhaiti.ht";
    const teacherEmail = "professeur@eduhaiti.ht";
    const studentEmail = "eleve@eduhaiti.ht";
    const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@123";
    const teacherPassword = process.env.TEACHER_PASSWORD ?? "Teacher@123";
    const studentPassword = process.env.STUDENT_PASSWORD ?? "Student@123";
    let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
        const passwordHash = await bcryptjs_1.default.hash(adminPassword, 10);
        admin = await prisma.user.create({
            data: {
                email: adminEmail,
                name: "Admin EduHaiti",
                role: "ADMIN",
                isActive: true,
                passwordHash,
            },
        });
        console.log("✅ Admin created:", admin.email);
    }
    else if (!admin.passwordHash) {
        const passwordHash = await bcryptjs_1.default.hash(adminPassword, 10);
        await prisma.user.update({
            where: { id: admin.id },
            data: { passwordHash },
        });
        console.log("✅ Admin password updated:", admin.email);
    }
    let teacher = await prisma.user.findUnique({ where: { email: teacherEmail } });
    if (!teacher) {
        const passwordHash = await bcryptjs_1.default.hash(teacherPassword, 10);
        teacher = await prisma.user.create({
            data: {
                email: teacherEmail,
                name: "Mme. Clair",
                role: "TEACHER",
                isActive: true,
                passwordHash,
            },
        });
        console.log("✅ Teacher created:", teacher.email);
    }
    else if (!teacher.passwordHash) {
        const passwordHash = await bcryptjs_1.default.hash(teacherPassword, 10);
        await prisma.user.update({
            where: { id: teacher.id },
            data: { passwordHash },
        });
        console.log("✅ Teacher password updated:", teacher.email);
    }
    let student = await prisma.user.findUnique({ where: { email: studentEmail } });
    if (!student) {
        const passwordHash = await bcryptjs_1.default.hash(studentPassword, 10);
        student = await prisma.user.create({
            data: {
                email: studentEmail,
                name: "Jean Pierre",
                role: "STUDENT",
                isActive: true,
                passwordHash,
            },
        });
        console.log("✅ Student created:", student.email);
    }
    else if (!student.passwordHash) {
        const passwordHash = await bcryptjs_1.default.hash(studentPassword, 10);
        await prisma.user.update({
            where: { id: student.id },
            data: { passwordHash },
        });
        console.log("✅ Student password updated:", student.email);
    }
    let classRoom = await prisma.class.findFirst({ where: { teacherId: teacher.id } });
    if (!classRoom) {
        classRoom = await prisma.class.create({
            data: {
                name: "Classe 3B",
                level: "3eme",
                teacherId: teacher.id,
                students: { connect: [{ id: student.id }] },
            },
        });
        console.log("✅ Class created:", classRoom.name);
    }
    const gradesExist = await prisma.grade.findFirst({ where: { studentId: student.id } });
    if (!gradesExist) {
        const subjects = ["Mathematiques", "Sciences", "Francais"];
        for (const subject of subjects) {
            await prisma.grade.create({
                data: {
                    studentId: student.id,
                    classId: classRoom.id,
                    subject,
                    score: Math.floor(Math.random() * 8) + 12,
                    maxScore: 20,
                    status: Math.random() > 0.3 ? "published" : "draft",
                },
            });
        }
        console.log("✅ Grades created for student");
    }
    const attendanceExist = await prisma.attendance.findFirst({ where: { studentId: student.id } });
    if (!attendanceExist) {
        for (let i = 0; i < 10; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            await prisma.attendance.create({
                data: {
                    studentId: student.id,
                    classId: classRoom.id,
                    date,
                    status: Math.random() > 0.1 ? "present" : "absent",
                },
            });
        }
        console.log("✅ Attendance records created");
    }
    const messageExists = await prisma.message.findFirst({ where: { fromId: teacher.id } });
    if (!messageExists) {
        await prisma.message.create({
            data: {
                fromId: teacher.id,
                toId: student.id,
                subject: "Bienvenue en ligne",
                body: "Bonjour! Vous pouvez maintenant suivre vos notes et votre presence en ligne.",
            },
        });
        console.log("✅ Message created");
    }
    console.log("✨ Seeding completed!");
}
main()
    .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map