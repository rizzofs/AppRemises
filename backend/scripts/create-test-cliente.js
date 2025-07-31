const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestCliente() {
  try {
    console.log('🔍 Verificando cliente de prueba...');
    
    // Verificar si ya existe un cliente de prueba
    const existingCliente = await prisma.cliente.findFirst({
      where: {
        email: 'cliente@test.com'
      },
      include: {
        user: true
      }
    });

    if (existingCliente) {
      console.log('✅ Cliente de prueba ya existe:', existingCliente.email);
      console.log('📋 Credenciales de prueba:');
      console.log('👤 Cliente: cliente@test.com / cliente123');
      return;
    }

    console.log('👤 Creando cliente de prueba...');
    
    // Hash de la contraseña
    const passwordHash = await bcrypt.hash('cliente123', 10);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email: 'cliente@test.com',
        passwordHash,
        rol: 'CLIENTE',
        activo: true
      }
    });

    // Crear cliente
    const cliente = await prisma.cliente.create({
      data: {
        nombre: 'Juan',
        apellido: 'Pérez',
        dni: '12345678',
        telefono: '11-1234-5678',
        email: 'cliente@test.com',
        direccion: 'Av. Corrientes 1234, CABA',
        fechaNacimiento: new Date('1990-01-15'),
        genero: 'M',
        activo: true,
        userId: user.id
      }
    });

    console.log('✅ Cliente creado exitosamente!');
    console.log('📋 Credenciales de prueba:');
    console.log('👤 Cliente: cliente@test.com / cliente123');
    console.log('📝 Datos del cliente:');
    console.log(`   - Nombre: ${cliente.nombre} ${cliente.apellido}`);
    console.log(`   - DNI: ${cliente.dni}`);
    console.log(`   - Teléfono: ${cliente.telefono}`);
    console.log(`   - Dirección: ${cliente.direccion}`);

  } catch (error) {
    console.error('❌ Error creando cliente de prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestCliente(); 