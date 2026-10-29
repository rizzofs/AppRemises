import { prisma } from '../lib/prisma';
import { getIO } from '../lib/socket';

export interface BatchMatch {
  viajeId: string;
  viaje: {
    id: string;
    origen: string;
    destino: string;
    clienteNombre?: string | null;
    clienteTelefono?: string | null;
    fecha: Date;
    precio: number;
    tiempoEsperaMinutos: number;
  };
  choferId: string;
  chofer: {
    id: string;
    nombre: string;
    apellido: string;
    telefono: string;
    numeroChofer?: string;
    recaudadoHoy?: number;
    viajesHoy?: number;
    minutosEsperandoTurno?: number;
  };
  vehiculoId: string | null;
  vehiculo: {
    id: string;
    patente: string;
    marca: string;
    modelo: string;
  } | null;
  distanciaKm: number;
  etaMinutos: number;
}

export interface BatchOptimizationResult {
  success: boolean;
  totalViajesPendientes: number;
  totalChoferesDisponibles: number;
  matches: BatchMatch[];
  tiempoTotalOptimoMinutos: number;
  tiempoTotalGreedyMinutos: number;
  ahorroTotalMinutos: number;
  porcentajeMejora: number;
  mensaje: string;
}

/**
 * Fórmula de Haversine para calcular distancia esférica en km
 */
function calcularDistanciaHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Extrae lat/lng de un string como "-34.6037,-58.3816" o JSON
 */
function parsearCoordenadas(origenDetallado?: string | null): { lat: number; lng: number } | null {
  if (!origenDetallado) return null;
  try {
    if (origenDetallado.startsWith('{')) {
      const obj = JSON.parse(origenDetallado);
      if (obj.lat && obj.lng) return { lat: parseFloat(obj.lat), lng: parseFloat(obj.lng) };
    }
    const parts = origenDetallado.split(',');
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  } catch (e) {
    // ignorar error de parseo
  }
  return null;
}

/**
 * Algoritmo Húngaro (Kuhn-Munkres) O(n^3)
 * Encuentra el emparejamiento bipartito de costo mínimo global
 */
function algoritmoHungaro(costMatrix: number[][]): number[] {
  const n = costMatrix.length;
  if (n === 0) return [];
  const m = costMatrix[0].length;
  if (m === 0) return Array(n).fill(-1);

  const dim = Math.max(n, m);
  const cost = Array.from({ length: dim + 1 }, () => Array(dim + 1).fill(0));

  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      if (i < n && j < m) {
        cost[i + 1][j + 1] = costMatrix[i][j];
      } else {
        cost[i + 1][j + 1] = 1e9;
      }
    }
  }

  const u = Array(dim + 1).fill(0);
  const v = Array(dim + 1).fill(0);
  const p = Array(dim + 1).fill(0);
  const way = Array(dim + 1).fill(0);

  for (let i = 1; i <= dim; ++i) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(dim + 1).fill(Infinity);
    const used = Array(dim + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= dim; ++j) {
        if (!used[j]) {
          const cur = cost[i0][j] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= dim; ++j) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const assignment = Array(n).fill(-1);
  for (let j = 1; j <= m; ++j) {
    const row = p[j] - 1;
    if (row >= 0 && row < n && cost[row + 1][j] < 1e8) {
      assignment[row] = j - 1;
    }
  }
  return assignment;
}

export const batchDispatchService = {
  /**
   * Calcula la optimización por lotes entre viajes pendientes y choferes libres
   */
  async calcularLoteOptimo(remiseriaId: string): Promise<BatchOptimizationResult> {
    const ahora = new Date();

    // 1. Obtener viajes pendientes de la remisería ordenados por fecha de creación (antigüedad)
    const viajesPendientes = await prisma.viaje.findMany({
      where: {
        remiseriaId,
        estado: 'PENDIENTE',
        choferId: null
      },
      include: {
        cliente: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // 2. Obtener choferes activos y online
    const choferesActivos = await prisma.chofer.findMany({
      where: {
        remiseriaId,
        estado: 'ACTIVO',
        isOnline: true
      },
      include: {
        vehiculo: true
      }
    });

    // 3. Filtrar choferes que ya tienen un viaje activo en curso (ACEPTADO, EN_CAMINO, EN_CURSO)
    const viajesActivosChoferes = await prisma.viaje.findMany({
      where: {
        remiseriaId,
        choferId: { not: null },
        estado: { in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] }
      },
      select: { choferId: true }
    });

    const choferesOcupadosIds = new Set(viajesActivosChoferes.map((v) => v.choferId));
    
    // Filtrar choferes disponibles: deben estar online, sin viaje en curso y NO estar en pausa (almuerzo/baño)
    const choferesDisponibles = choferesActivos.filter((c) => {
      if (choferesOcupadosIds.has(c.id)) return false;
      if (c.observaciones && c.observaciones.startsWith('{')) {
        try {
          const obs = JSON.parse(c.observaciones);
          if (obs.enPausa === true) return false;
        } catch {
          // ignore
        }
      }
      return true;
    });

    // Si no hay viajes o choferes libres, retornar resultado vacío
    if (viajesPendientes.length === 0 || choferesDisponibles.length === 0) {
      return {
        success: true,
        totalViajesPendientes: viajesPendientes.length,
        totalChoferesDisponibles: choferesDisponibles.length,
        matches: [],
        tiempoTotalOptimoMinutos: 0,
        tiempoTotalGreedyMinutos: 0,
        ahorroTotalMinutos: 0,
        porcentajeMejora: 0,
        mensaje:
          viajesPendientes.length === 0
            ? 'No hay viajes pendientes por asignar'
            : 'No hay choferes disponibles u online en este momento (algunos pueden estar en pausa/almuerzo)'
      };
    }

    // 3.1 Métricas basadas en la CONEXIÓN / TURNO ACTIVO del Chofer (Criterios A y B)
    // Buscamos el turno abierto de cada chofer disponible
    const turnosActivos = await prisma.turnoChofer.findMany({
      where: {
        choferId: { in: choferesDisponibles.map((c) => c.id) },
        activo: true
      },
      orderBy: { fechaInicio: 'desc' }
    });

    const mapaTurnos = new Map<string, { fechaInicio: Date; id: string }>();
    for (const t of turnosActivos) {
      if (!mapaTurnos.has(t.choferId)) {
        mapaTurnos.set(t.choferId, { fechaInicio: t.fechaInicio, id: t.id });
      }
    }

    const minFechaInicio = turnosActivos.length > 0
      ? new Date(Math.min(...turnosActivos.map((t) => t.fechaInicio.getTime())))
      : new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

    // Obtener viajes completados desde que se inició el turno más antiguo conectado
    const viajesTurnoChoferes = await prisma.viaje.findMany({
      where: {
        remiseriaId,
        estado: 'COMPLETADO',
        fecha: { gte: minFechaInicio },
        choferId: { in: choferesDisponibles.map((c) => c.id) }
      },
      select: {
        choferId: true,
        precio: true,
        fecha: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const statsChoferTurno = new Map<
      string,
      { recaudadoTurno: number; viajesTurno: number; ultimoViajeFin: Date | null; minutosConectado: number }
    >();

    for (const c of choferesDisponibles) {
      const infoTurno = mapaTurnos.get(c.id);
      const fechaInicio = infoTurno ? infoTurno.fechaInicio : new Date(ahora.getTime() - 60 * 60 * 1000);
      const minutosConectado = Math.max(1, Math.floor((ahora.getTime() - fechaInicio.getTime()) / (1000 * 60)));

      statsChoferTurno.set(c.id, {
        recaudadoTurno: 0,
        viajesTurno: 0,
        ultimoViajeFin: null,
        minutosConectado
      });
    }

    for (const v of viajesTurnoChoferes) {
      if (!v.choferId) continue;
      const infoTurno = mapaTurnos.get(v.choferId);
      const fechaInicioTurno = infoTurno ? infoTurno.fechaInicio : null;

      // Solo contar si el viaje fue completado dentro del turno activo actual del chofer
      if (fechaInicioTurno && v.fecha >= fechaInicioTurno) {
        const stat = statsChoferTurno.get(v.choferId);
        if (stat) {
          stat.recaudadoTurno += Number(v.precio) || 0;
          stat.viajesTurno += 1;
          if (!stat.ultimoViajeFin) {
            stat.ultimoViajeFin = v.updatedAt;
          }
        }
      }
    }

    let maxRecaudacionTurno = 0;
    for (const s of statsChoferTurno.values()) {
      if (s.recaudadoTurno > maxRecaudacionTurno) {
        maxRecaudacionTurno = s.recaudadoTurno;
      }
    }

    // Coordenadas de referencia por defecto (Remisería Chivilcoy centro)
    const fallbackLat = -34.8957;
    const fallbackLng = -60.0189;

    // 4. Construir la Matriz de Costos (ETA en minutos con factor de tráfico y equidad de espera por turno)
    const numChoferes = choferesDisponibles.length;
    const numViajes = viajesPendientes.length;

    // costMatrix[i][j]: costo de asignar Chofer i a Viaje j
    const costMatrix: number[][] = [];
    const etaMatrix: number[][] = [];
    const distanceMatrix: number[][] = [];

    for (let i = 0; i < numChoferes; i++) {
      costMatrix[i] = [];
      etaMatrix[i] = [];
      distanceMatrix[i] = [];
      const chofer = choferesDisponibles[i];

      const choferLat = chofer.vehiculo?.latitud || fallbackLat;
      const choferLng = chofer.vehiculo?.longitud || fallbackLng;

      const statChofer = statsChoferTurno.get(chofer.id) || {
        recaudadoTurno: 0,
        viajesTurno: 0,
        ultimoViajeFin: null,
        minutosConectado: 30
      };

      // Criterio A: Tiempo en turno esperando viaje
      // Si ya completó un viaje en este turno: minutos desde que terminó el último viaje.
      // Si todavía NO completó ningún viaje en este turno: minutos que lleva conectado esperando su primer viaje.
      const minutosEsperandoTurno = statChofer.ultimoViajeFin
        ? Math.max(0, Math.floor((ahora.getTime() - new Date(statChofer.ultimoViajeFin).getTime()) / (1000 * 60)))
        : statChofer.minutosConectado;

      // Bonus por tiempo en espera de turno (hasta 1.5 min de descuento en el costo)
      const bonusEsperaTurno = Math.min(1.5, (minutosEsperandoTurno / 45) * 1.5);

      // Criterio B: Equidad de recaudación de este turno (prioriza a quien recaudó menos en esta conexión)
      const ratioRecaudacion =
        maxRecaudacionTurno > 0 ? (maxRecaudacionTurno - statChofer.recaudadoTurno) / maxRecaudacionTurno : 0.5;
      const bonusEquidadRecaudacion = ratioRecaudacion * 1.5;

      // Bonus combinado de desempate por conexión (máximo ~3.0 minutos)
      const bonusDesempateChofer = bonusEsperaTurno + bonusEquidadRecaudacion;

      for (let j = 0; j < numViajes; j++) {
        const viaje = viajesPendientes[j];
        const viajeCoords = parsearCoordenadas(viaje.origenDetallado) || {
          lat: fallbackLat,
          lng: fallbackLng
        };

        // Distancia en km
        let distanciaKm = calcularDistanciaHaversine(
          choferLat,
          choferLng,
          viajeCoords.lat,
          viajeCoords.lng
        );

        if (distanciaKm < 0.2) distanciaKm = 0.5; // Mínimo urbano

        // Estimación ETA en minutos (velocidad promedio 28 km/h en ciudad + factor desvíos 1.3)
        const etaMinutos = Math.max(2, Math.round(((distanciaKm * 1.3) / 28) * 60));

        // Factor de equidad del cliente: tiempo que lleva esperando el viaje
        const minutosEsperandoCliente = Math.max(
          0,
          Math.floor((ahora.getTime() - new Date(viaje.createdAt).getTime()) / (1000 * 60))
        );

        // Costo = ETA - (bonus espera pasajero) - (bonus desempate chofer: Criterio A fila + Criterio B recaudación)
        const costo = Math.max(0.1, etaMinutos - minutosEsperandoCliente * 0.4 - bonusDesempateChofer);

        costMatrix[i][j] = costo;
        etaMatrix[i][j] = etaMinutos;
        distanceMatrix[i][j] = distanciaKm;
      }
    }

    // 5. Ejecutar Algoritmo Húngaro (Kuhn-Munkres)
    const asignacionOptima = algoritmoHungaro(costMatrix);

    // 6. Simular asignación "Greedy" (primero que llegó, asigna al auto más cercano disponible)
    const choferesUsadosGreedy = new Set<number>();
    let tiempoTotalGreedy = 0;

    for (let j = 0; j < numViajes; j++) {
      let mejorChoferIdx = -1;
      let menorEta = Infinity;

      for (let i = 0; i < numChoferes; i++) {
        if (!choferesUsadosGreedy.has(i) && etaMatrix[i][j] < menorEta) {
          menorEta = etaMatrix[i][j];
          mejorChoferIdx = i;
        }
      }

      if (mejorChoferIdx !== -1) {
        choferesUsadosGreedy.add(mejorChoferIdx);
        tiempoTotalGreedy += menorEta;
      }
    }

    // 7. Armar la lista de Matches óptimos
    const matches: BatchMatch[] = [];
    let tiempoTotalOptimo = 0;

    for (let i = 0; i < numChoferes; i++) {
      const j = asignacionOptima[i];
      if (j !== undefined && j >= 0 && j < numViajes) {
        const viaje = viajesPendientes[j];
        const chofer = choferesDisponibles[i];
        const distKm = distanceMatrix[i][j];
        const etaMin = etaMatrix[i][j];

        tiempoTotalOptimo += etaMin;

        const minutosEspera = Math.max(
          0,
          Math.floor((ahora.getTime() - new Date(viaje.createdAt).getTime()) / (1000 * 60))
        );

        const statChofer = statsChoferTurno.get(chofer.id) || {
          recaudadoTurno: 0,
          viajesTurno: 0,
          ultimoViajeFin: null,
          minutosConectado: 30
        };

        const minutosEsperandoTurno = statChofer.ultimoViajeFin
          ? Math.max(0, Math.floor((ahora.getTime() - new Date(statChofer.ultimoViajeFin).getTime()) / (1000 * 60)))
          : statChofer.minutosConectado;

        matches.push({
          viajeId: viaje.id,
          viaje: {
            id: viaje.id,
            origen: viaje.origen,
            destino: viaje.destino,
            clienteNombre: viaje.clienteNombre || (viaje.cliente ? `${viaje.cliente.nombre} ${viaje.cliente.apellido}` : 'Cliente'),
            clienteTelefono: viaje.clienteTelefono || viaje.cliente?.telefono || null,
            fecha: viaje.fecha,
            precio: Number(viaje.precio),
            tiempoEsperaMinutos: minutosEspera
          },
          choferId: chofer.id,
          chofer: {
            id: chofer.id,
            nombre: chofer.nombre,
            apellido: chofer.apellido,
            telefono: chofer.telefono,
            numeroChofer: chofer.numeroChofer,
            recaudadoHoy: statChofer.recaudadoTurno,
            viajesHoy: statChofer.viajesTurno,
            minutosEsperandoTurno
          },
          vehiculoId: chofer.vehiculo?.id || chofer.vehiculoId || null,
          vehiculo: chofer.vehiculo
            ? {
                id: chofer.vehiculo.id,
                patente: chofer.vehiculo.patente,
                marca: chofer.vehiculo.marca,
                modelo: chofer.vehiculo.modelo
              }
            : null,
          distanciaKm: distKm,
          etaMinutos: etaMin
        });
      }
    }

    // 8. Calcular ahorro y métricas de mejora
    const ahorroTotal = Math.max(0, tiempoTotalGreedy - tiempoTotalOptimo);
    const porcentajeMejora =
      tiempoTotalGreedy > 0 ? Math.round((ahorroTotal / tiempoTotalGreedy) * 100) : 0;

    return {
      success: true,
      totalViajesPendientes: numViajes,
      totalChoferesDisponibles: numChoferes,
      matches,
      tiempoTotalOptimoMinutos: tiempoTotalOptimo,
      tiempoTotalGreedyMinutos: tiempoTotalGreedy,
      ahorroTotalMinutos: ahorroTotal,
      porcentajeMejora,
      mensaje:
        matches.length > 0
          ? `Lote óptimo calculado: ${matches.length} asignaciones listas.${
              ahorroTotal > 0
                ? ` Ahorro estimado de espera global: ${ahorroTotal} min (${porcentajeMejora}% más rápido).`
                : ''
            }`
          : 'No se encontraron combinaciones viables en este momento'
    };
  },

  /**
   * Aplica en firme las asignaciones de un lote en la Base de Datos
   */
  async aplicarLote(
    remiseriaId: string,
    matches: Array<{ viajeId: string; choferId: string; vehiculoId?: string | null }>,
    coordinadorUserId?: string
  ) {
    if (!matches || matches.length === 0) {
      throw new Error('No se enviaron asignaciones para aplicar');
    }

    const io = getIO();
    const resultados = [];

    // Ejecutar transacciones por cada viaje
    for (const match of matches) {
      const { viajeId, choferId, vehiculoId } = match;

      // Obtener chofer para resolver vehículo si no fue enviado
      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
        include: { vehiculo: true }
      });

      if (!chofer) continue;

      const finalVehiculoId = vehiculoId || chofer.vehiculoId || null;

      const viajeActualizado = await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          choferId: chofer.id,
          vehiculoId: finalVehiculoId,
          estado: 'ACEPTADO'
        },
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              email: true
            }
          },
          chofer: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              fotoUrl: true,
              numeroChofer: true,
              vehiculo: {
                select: {
                  id: true,
                  patente: true,
                  marca: true,
                  modelo: true,
                  color: true
                }
              }
            }
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
              color: true
            }
          }
        }
      });

      // Registrar auditoría de uso si fue hecho por un coordinador
      if (coordinadorUserId) {
        try {
          await prisma.appUsage.create({
            data: {
              userId: coordinadorUserId,
              userEmail: 'coordinador@remisesbruno.com',
              action: 'BATCH_DISPATCH_ASSIGN',
              details: JSON.stringify({
                viajeId,
                choferId,
                vehiculoId: finalVehiculoId,
                metodo: 'HUNGARIAN_OPTIMAL'
              })
            }
          });
        } catch (e) {
          // No detener si falla el log
        }
      }

      // Notificar al Chofer y a la Central en tiempo real vía WebSockets
      if (io) {
        // Sala de la remisería (central y mapa)
        io.to(remiseriaId).emit('viaje_estado_actualizado', {
          viajeId,
          estado: 'ACEPTADO',
          mensaje: `Viaje asignado óptimamente a ${chofer.nombre} ${chofer.apellido}`
        });

        io.to(remiseriaId).emit('nuevo_viaje_recibido', viajeActualizado);
      }

      resultados.push(viajeActualizado);
    }

    // Notificación especial de lote completado a toda la central
    if (io && resultados.length > 0) {
      io.to(remiseriaId).emit('lote_asignado_completado', {
        totalAsignados: resultados.length,
        viajes: resultados.map((v) => ({ id: v.id, chofer: `${v.chofer?.nombre} ${v.chofer?.apellido}` }))
      });
    }

    return {
      success: true,
      totalAsignados: resultados.length,
      data: resultados,
      message: `¡Lote aplicado con éxito! Se asignaron ${resultados.length} viajes simultáneamente.`
    };
  }
};
