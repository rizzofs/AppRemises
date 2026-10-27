const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando configuración para Remises Bruno...');

  // 1. Buscar la remisería principal (anteriormente Remises Express)
  const principal = await prisma.remiseria.findFirst({
    where: {
      OR: [
        { id: 'cmpnjogr6000290drlautep7z' },
        { nombreFantasia: { contains: 'Express', mode: 'insensitive' } },
        { nombreFantasia: { contains: 'Bruno', mode: 'insensitive' } }
      ]
    }
  });

  if (!principal) {
    throw new Error('No se encontró la remisería principal');
  }

  console.log(`Encontrada remisería principal: ${principal.id} (${principal.nombreFantasia})`);

  // 2. Renombrar a "Remises Bruno"
  const updatedRemiseria = await prisma.remiseria.update({
    where: { id: principal.id },
    data: {
      nombreFantasia: 'Remises Bruno',
      razonSocial: 'Remises Bruno S.R.L.',
      estado: true
    }
  });
  console.log(`✅ Remisería actualizada a: ${updatedRemiseria.nombreFantasia} (${updatedRemiseria.razonSocial})`);

  // 3. Eliminar remiserías de prueba que no tienen choferes ni viajes
  const otherRemiserias = await prisma.remiseria.findMany({
    where: {
      id: { not: principal.id }
    },
    include: {
      _count: {
        select: {
          choferes: true,
          vehiculos: true,
          viajes: true,
          coordinadores: true
        }
      }
    }
  });

  for (const rem of otherRemiserias) {
    if (rem._count.choferes === 0 && rem._count.viajes === 0 && rem._count.vehiculos === 0) {
      console.log(`Eliminando remisería de prueba vacía: ${rem.nombreFantasia} (${rem.id})...`);
      await prisma.remiseriaDuenio.deleteMany({
        where: { remiseriaId: rem.id }
      });
      await prisma.remiseria.delete({
        where: { id: rem.id }
      });
      console.log(`✅ Remisería ${rem.nombreFantasia} eliminada.`);
    } else {
      console.log(`⚠️ Remisería ${rem.nombreFantasia} tiene datos (${rem._count.choferes} choferes, ${rem._count.viajes} viajes). Reasignando a Remises Bruno.`);
      // Reasignar choferes, vehículos y viajes si hubiera
      await prisma.chofer.updateMany({
        where: { remiseriaId: rem.id },
        data: { remiseriaId: principal.id }
      });
      await prisma.vehiculo.updateMany({
        where: { remiseriaId: rem.id },
        data: { remiseriaId: principal.id }
      });
      await prisma.coordinador.updateMany({
        where: { remiseriaId: rem.id },
        data: { remiseriaId: principal.id }
      });
      await prisma.viaje.updateMany({
        where: { remiseriaId: rem.id },
        data: { remiseriaId: principal.id }
      });
      await prisma.remiseriaDuenio.deleteMany({
        where: { remiseriaId: rem.id }
      });
      await prisma.remiseria.delete({
        where: { id: rem.id }
      });
    }
  }

  // 4. Asegurar que cada dueño tenga solo UNA remisería en remiseria_duenio
  const duenios = await prisma.duenio.findMany({
    include: {
      remiserias: true
    }
  });

  for (const duenio of duenios) {
    console.log(`Verificando dueño ${duenio.nombre} (${duenio.id}), tiene ${duenio.remiserias.length} remiserías asociadas.`);
    // Dejar únicamente la asociación con Remises Bruno
    await prisma.remiseriaDuenio.deleteMany({
      where: {
        duenioId: duenio.id,
        remiseriaId: { not: principal.id }
      }
    });

    const hasBruno = await prisma.remiseriaDuenio.findFirst({
      where: {
        duenioId: duenio.id,
        remiseriaId: principal.id
      }
    });

    if (!hasBruno) {
      await prisma.remiseriaDuenio.create({
        data: {
          duenioId: duenio.id,
          remiseriaId: principal.id
        }
      });
      console.log(`✅ Dueño ${duenio.nombre} asociado a Remises Bruno.`);
    }
  }

  console.log('🎉 Migración de base de datos a Remises Bruno completada con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en script:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
