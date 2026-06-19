const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('chofer123', 10);
  const passwordHashCliente = await bcrypt.hash('cliente123', 10);

  // Verificamos si hay un dueño/remiseria
  const remiseria = await prisma.remiseria.findFirst();
  if (!remiseria) {
    console.log('No hay remiseria, no se puede crear chofer');
    return;
  }

  // CHOFER
  let choferUser = await prisma.user.findUnique({ where: { email: 'chofer@test.com' } });
  if (!choferUser) {
    choferUser = await prisma.user.create({
      data: {
        email: 'chofer@test.com',
        passwordHash,
        rol: 'CHOFER',
        activo: true
      }
    });
    await prisma.chofer.create({
      data: {
        numeroChofer: 'CH-TEST',
        nombre: 'Chofer',
        apellido: 'Test',
        dni: 'chofer123',
        telefono: '12345678',
        email: 'chofer@test.com',
        categoriaLicencia: 'D1',
        vtoLicencia: new Date('2030-01-01'),
        remiseriaId: remiseria.id,
        userId: choferUser.id
      }
    });
    console.log('Chofer creado');
  } else {
    // update password
    await prisma.user.update({ where: { email: 'chofer@test.com' }, data: { passwordHash } });
    console.log('Chofer actualizado');
  }

  // CLIENTE
  let clienteUser = await prisma.user.findUnique({ where: { email: 'cliente@test.com' } });
  if (!clienteUser) {
    clienteUser = await prisma.user.create({
      data: {
        email: 'cliente@test.com',
        passwordHash: passwordHashCliente,
        rol: 'CLIENTE',
        activo: true
      }
    });
    await prisma.cliente.create({
      data: {
        nombre: 'Cliente',
        apellido: 'Test',
        dni: '87654321',
        telefono: '11223344',
        email: 'cliente@test.com',
        direccion: 'Calle Falsa 123',
        fechaNacimiento: new Date('1990-01-01'),
        userId: clienteUser.id
      }
    });
    console.log('Cliente creado');
  } else {
    await prisma.user.update({ where: { email: 'cliente@test.com' }, data: { passwordHash: passwordHashCliente } });
    console.log('Cliente actualizado');
  }

}
main().catch(console.error).finally(() => prisma.$disconnect());
