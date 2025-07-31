import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('🔧 Creando datos de prueba...');

    // Verificar si el usuario dueño ya existe
    let duenio = await prisma.user.findUnique({
      where: { email: 'duenio@appremises.com' },
      include: { duenio: true }
    });

    if (!duenio) {
      // Crear usuario dueño
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash('duenio123', saltRounds);

      duenio = await prisma.user.create({
        data: {
          email: 'duenio@appremises.com',
          passwordHash,
          rol: 'DUENIO',
          activo: true,
          duenio: {
            create: {
              nombre: 'Juan Pérez',
              telefono: '1234567890'
            }
          }
        },
        include: {
          duenio: true
        }
      });

      console.log('✅ Usuario dueño creado:', duenio.email);
    } else {
      console.log('✅ Usuario dueño ya existe:', duenio.email);
    }

    // Verificar si ya existen remiserías para este dueño
    const existingRemiserias = await prisma.remiseria.findMany({
      where: {
        duenios: {
          some: {
            duenioId: duenio.duenio!.id
          }
        }
      }
    });

    if (existingRemiserias.length > 0) {
      console.log('✅ Ya existen remiserías para este dueño');
      return;
    }

    // Crear remiserías de prueba
    const remiserias = [
      {
        nombreFantasia: 'Remises Express',
        razonSocial: 'Remises Express S.A.',
        direccion: 'Av. San Martín 123',
        telefono: '011-1234-5678'
      },
      {
        nombreFantasia: 'Taxi Seguro',
        razonSocial: 'Taxi Seguro S.R.L.',
        direccion: 'Belgrano 456',
        telefono: '011-8765-4321'
      },
      {
        nombreFantasia: 'Remises 24/7',
        razonSocial: 'Remises 24/7 S.A.',
        direccion: 'Rivadavia 789',
        telefono: '011-1122-3344'
      }
    ];

    for (const remiseriaData of remiserias) {
      const remiseria = await prisma.remiseria.create({
        data: {
          ...remiseriaData,
          duenios: {
            create: {
              duenioId: duenio.duenio!.id
            }
          }
        }
      });
      console.log('✅ Remisería creada:', remiseria.nombreFantasia);
    }

    console.log('\n🎉 Datos de prueba creados exitosamente!');
    console.log('\n📋 Credenciales de prueba:');
    console.log('👤 Dueño:');
    console.log('   Email: duenio@appremises.com');
    console.log('   Contraseña: duenio123');
    console.log('\n👨‍💼 Admin:');
    console.log('   Email: admin@appremises.com');
    console.log('   Contraseña: admin123');

  } catch (error) {
    console.error('❌ Error creando datos de prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData(); 