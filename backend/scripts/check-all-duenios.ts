import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const duenios = await prisma.duenio.findMany();
  console.log('Todos los duenios:', JSON.stringify(duenios, null, 2));
}
main().finally(() => prisma.$disconnect());
