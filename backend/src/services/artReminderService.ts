import { prisma } from '../lib/prisma';
import { getIO } from '../lib/socket';

// Registro en memoria para controlar la frecuencia de notificaciones por viaje
const ultimosRecordatoriosEmitidos = new Map<string, number>();

/**
 * Servicio periódico que monitorea viajes programados de ART.
 * Cuando llega el horario de salida (horaSalidaChofer), emite una alerta en tiempo real
 * por WebSocket para que el chofer no se olvide de salir a buscar al pasajero.
 */
export function iniciarServicioRecordatorioART() {
  console.log('⏰ Servicio de recordatorio de salida de viajes ART iniciado.');

  // Ejecutar verificación cada 20 segundos
  setInterval(async () => {
    try {
      let io: any;
      try {
        io = getIO();
      } catch {
        return; // Sockets aún no listos
      }
      if (!io) return;

      const ahora = new Date();
      // Rango del día de hoy
      const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
      const finHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);

      // Buscar viajes de ART que estén asignados/aceptados y pendientes de salida
      const viajesArtHoy = await prisma.viaje.findMany({
        where: {
          artEmpresaId: { not: null },
          estado: 'ACEPTADO',
          choferId: { not: null },
          fecha: {
            gte: inicioHoy,
            lte: finHoy
          }
        },
        include: {
          artEmpresa: true,
          chofer: true,
          vehiculo: true
        }
      });

      if (!viajesArtHoy || viajesArtHoy.length === 0) return;

      const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

      for (const viaje of viajesArtHoy) {
        if (!viaje.horaSalidaChofer || !viaje.choferId) continue;

        const [hStr, mStr] = viaje.horaSalidaChofer.split(':');
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        if (isNaN(h) || isNaN(m)) continue;

        const minutosSalida = h * 60 + m;

        // Si ya llegó el horario de salida (o dentro de una ventana de 45 min posteriores sin iniciar)
        if (minutosAhora >= minutosSalida && minutosAhora <= minutosSalida + 45) {
          const ahoraMs = Date.now();
          const ultimoAviso = ultimosRecordatoriosEmitidos.get(viaje.id) || 0;

          // Re-notificar cada 4 minutos si aún no marcó que está saliendo
          if (ahoraMs - ultimoAviso >= 4 * 60 * 1000) {
            ultimosRecordatoriosEmitidos.set(viaje.id, ahoraMs);

            console.log(
              `⏰ [Recordatorio ART] Emitiendo alerta de salida para chofer ${viaje.chofer?.nombre || ''} (Móvil #${viaje.chofer?.numeroChofer || ''}) - Viaje ID: ${viaje.id} (Salida: ${viaje.horaSalidaChofer} hs)`
            );

            io.to(viaje.remiseriaId).emit('alerta_hora_salida_art', {
              viajeId: viaje.id,
              choferId: viaje.choferId,
              horaSalidaChofer: viaje.horaSalidaChofer,
              horaTurno: viaje.horaTurno,
              artNombre: viaje.artEmpresa?.nombre || 'ART / Empresa',
              numeroSiniestro: viaje.numeroSiniestro,
              clienteNombre: viaje.clienteNombre,
              clienteTelefono: viaje.clienteTelefono,
              origen: viaje.origen,
              destino: viaje.destino,
              precio: viaje.precio,
              observaciones: viaje.observaciones,
              viaje
            });
          }
        }
      }

      // Limpieza periódica de mapa de avisos viejos (> 24 horas)
      if (ultimosRecordatoriosEmitidos.size > 200) {
        const hace24hs = Date.now() - 24 * 60 * 60 * 1000;
        for (const [id, ts] of ultimosRecordatoriosEmitidos.entries()) {
          if (ts < hace24hs) ultimosRecordatoriosEmitidos.delete(id);
        }
      }
    } catch (err) {
      console.error('Error en el servicio de recordatorio de viajes ART:', err);
    }
  }, 20000);
}
