import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Buscar admins existentes
  const admins = await prisma.user.findMany({
    where: { rol: 'ADMIN' },
    select: { id: true, email: true, rol: true, activo: true }
  });

  console.log('📋 Admins en BD:', JSON.stringify(admins, null, 2));

  // Si no es el email correcto, actualizar
  const correctAdmin = admins.find(a => a.email === 'rizzofs@gmail.com');

  if (!correctAdmin) {
    console.log('🔄 Actualizando email del admin...');
    
    // Eliminar todos los admins anteriores
    await prisma.user.deleteMany({ where: { rol: 'ADMIN' } });

    // Crear el superadmin correcto
    const hash = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.create({
      data: {
        email: 'rizzofs@gmail.com',
        passwordHash: hash,
        rol: 'ADMIN',
        activo: true
      }
    });
    console.log('✅ Superadmin creado:', admin.email, '| ID:', admin.id);
  } else {
    console.log('✅ El superadmin ya tiene el email correcto:', correctAdmin.email);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
