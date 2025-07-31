import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('🔧 Creando usuario administrador...');

    // Verificar si ya existe un admin
    const existingAdmin = await prisma.user.findFirst({
      where: {
        rol: 'ADMIN'
      }
    });

    if (existingAdmin) {
      console.log('⚠️  Ya existe un usuario administrador');
      return;
    }

    // Encriptar contraseña
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash('admin123', saltRounds);

    // Crear usuario administrador
    const admin = await prisma.user.create({
      data: {
        email: 'admin@appremises.com',
        passwordHash,
        rol: 'ADMIN',
        activo: true
      }
    });

    console.log('✅ Usuario administrador creado exitosamente');
    console.log('📧 Email: admin@appremises.com');
    console.log('🔑 Contraseña: admin123');
    console.log('🆔 ID:', admin.id);

  } catch (error) {
    console.error('❌ Error creando usuario administrador:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin(); 