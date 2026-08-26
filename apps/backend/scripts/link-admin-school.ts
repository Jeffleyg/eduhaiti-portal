import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    const school = await prisma.school.findUnique({ where: { name: 'EduHaiti Academy' } })
    const admin = await prisma.user.findUnique({ where: { email: 'admin@eduhaiti.ht' } })
    if (!school || !admin) {
      console.log('⚠️ School or admin not found', !!school, !!admin)
      return
    }
    await prisma.user.update({ where: { id: admin.id }, data: { schoolId: school.id } })
    console.log('✅ Admin linked to school', school.id)
  } catch (e) {
    console.error('❌ Error:', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
