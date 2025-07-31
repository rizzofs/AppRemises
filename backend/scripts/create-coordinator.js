const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createCoordinator() {
  try {
    // First, let's get a remiseria to assign the coordinator to
    const remiseria = await prisma.remiseria.findFirst();
    
    if (!remiseria) {
      console.log('No hay remiserías disponibles. Creando una remisería de prueba...');
      
      const newRemiseria = await prisma.remiseria.create({
        data: {
          nombreFantasia: 'Remisería de Prueba',
          razonSocial: 'Remisería de Prueba S.A.',
          cuit: '20-12345678-9',
          direccion: 'Av. Principal 123',
          telefono: '123-456-7890'
        }
      });
      
      console.log('Remisería creada:', newRemiseria.nombreFantasia);
    }

    const remiseriaToUse = remiseria || await prisma.remiseria.findFirst();
    
    // Create a user for the coordinator
    const passwordHash = await bcrypt.hash('coordinator123', 10);
    
    const user = await prisma.user.create({
      data: {
        email: 'coordinator@test.com',
        passwordHash,
        rol: 'COORDINADOR',
        activo: true
      }
    });

    console.log('Usuario creado:', user.email);

    // Create the coordinator
    const coordinator = await prisma.coordinador.create({
      data: {
        nombre: 'Coordinador de Prueba',
        email: 'coordinator@test.com',
        passwordHash,
        activo: true,
        remiseriaId: remiseriaToUse.id,
        userId: user.id
      }
    });

    console.log('Coordinador creado exitosamente!');
    console.log('Email:', coordinator.email);
    console.log('Contraseña: coordinator123');
    console.log('Remisería asignada:', remiseriaToUse.nombreFantasia);

  } catch (error) {
    console.error('Error creating coordinator:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createCoordinator(); 