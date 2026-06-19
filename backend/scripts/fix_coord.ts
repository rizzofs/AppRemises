import { prisma } from '../src/lib/prisma';
async function main() {
  const coordinadores = await prisma.coordinador.findMany();
  console.log('Coordinadores encontrados:', coordinadores.length);
  for (const c of coordinadores) {
    console.log(c.email, c.userId);
    if (!c.userId) {
      console.log('Falta user para', c.email);
      let user = await prisma.user.findUnique({ where: { email: c.email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: c.email,
            passwordHash: c.passwordHash,
            rol: 'COORDINADOR',
            activo: c.activo
          }
        });
        console.log('User created:', user.id);
      } else {
        await prisma.user.update({
          where: { email: c.email },
          data: { rol: 'COORDINADOR' }
        });
      }
      await prisma.coordinador.update({
        where: { id: c.id },
        data: { userId: user.id }
      });
      console.log('Linked coordinator to user');
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
