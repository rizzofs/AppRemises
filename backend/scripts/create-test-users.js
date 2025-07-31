const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('🔍 Verificando usuarios existentes...');

    // Check existing users
    const existingUsers = await prisma.user.findMany({
      include: {
        duenio: true,
        coordinador: true
      }
    });

    console.log(`📊 Usuarios encontrados: ${existingUsers.length}`);
    existingUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.rol})`);
    });

    // Create test admin if not exists
    const adminExists = existingUsers.find(u => u.rol === 'ADMIN');
    if (!adminExists) {
      console.log('\n👑 Creando usuario ADMIN de prueba...');
      const passwordHash = await bcrypt.hash('admin123', 10);
      
      const admin = await prisma.user.create({
        data: {
          email: 'admin@test.com',
          passwordHash,
          rol: 'ADMIN',
          activo: true
        }
      });
      console.log('✅ Admin creado:', admin.email);
    } else {
      console.log('✅ Admin ya existe:', adminExists.email);
    }

    // Create test duenio if not exists
    const duenioExists = existingUsers.find(u => u.rol === 'DUENIO');
    if (!duenioExists) {
      console.log('\n👤 Creando usuario DUENIO de prueba...');
      const passwordHash = await bcrypt.hash('duenio123', 10);
      
      const user = await prisma.user.create({
        data: {
          email: 'duenio@test.com',
          passwordHash,
          rol: 'DUENIO',
          activo: true
        }
      });

      const duenio = await prisma.duenio.create({
        data: {
          nombre: 'Dueño de Prueba',
          telefono: '123-456-7890',
          dni: '12345678',
          userId: user.id
        }
      });

      console.log('✅ Dueño creado:', duenio.nombre, `(${user.email})`);
    } else {
      console.log('✅ Dueño ya existe:', duenioExists.email);
    }

    // Create test coordinador if not exists
    const coordinadorExists = existingUsers.find(u => u.rol === 'COORDINADOR');
    if (!coordinadorExists) {
      console.log('\n🚗 Creando usuario COORDINADOR de prueba...');
      
      // First, get or create a remiseria
      let remiseria = await prisma.remiseria.findFirst();
      if (!remiseria) {
        console.log('📋 Creando remisería de prueba...');
        remiseria = await prisma.remiseria.create({
          data: {
            nombreFantasia: 'Remisería de Prueba',
            razonSocial: 'Remisería de Prueba S.A.',
            cuit: '20-12345678-9',
            direccion: 'Av. Principal 123',
            telefono: '123-456-7890'
          }
        });
        console.log('✅ Remisería creada:', remiseria.nombreFantasia);
      }

      const passwordHash = await bcrypt.hash('coordinator123', 10);
      
      const user = await prisma.user.create({
        data: {
          email: 'coordinator@test.com',
          passwordHash,
          rol: 'COORDINADOR',
          activo: true
        }
      });

      const coordinador = await prisma.coordinador.create({
        data: {
          nombre: 'Coordinador de Prueba',
          email: 'coordinator@test.com',
          passwordHash,
          activo: true,
          remiseriaId: remiseria.id,
          userId: user.id
        }
      });

      console.log('✅ Coordinador creado:', coordinador.nombre, `(${user.email})`);
    } else {
      console.log('✅ Coordinador ya existe:', coordinadorExists.email);
    }

    console.log('\n📋 Resumen de credenciales de prueba:');
    console.log('👑 Admin: admin@test.com / admin123');
    console.log('👤 Dueño: duenio@test.com / duenio123');
    console.log('🚗 Coordinador: coordinator@test.com / coordinator123');

  } catch (error) {
    console.error('❌ Error creando usuarios de prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers(); 