import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'rizzofs@gmail.com' } });
  console.log('User:', u);
}
main().finally(() => prisma.$disconnect());
