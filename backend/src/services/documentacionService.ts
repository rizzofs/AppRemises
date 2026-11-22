import { prisma } from '../lib/prisma';
import { getIO } from '../lib/socket';

export type EstadoVencimiento = 'VENCIDO' | 'VENCE_HOY' | 'PROXIMO_A_VENCER' | 'AL_DIA' | 'NO_REGISTRADO';
export type UrgenciaVencimiento = 'CRITICA' | 'ADVERTENCIA' | 'OK';

export interface DocumentoEvaluado {
  tipo: 'LICENCIA' | 'SEGURO' | 'VTV' | 'MATAFUEGO';
  nombre: string;
  fecha: string | null;
  estado: EstadoVencimiento;
  diasRestantes: number | null;
  urgencia: UrgenciaVencimiento;
  mensaje: string;
  label: string;
}

export interface ResumenDocumentacion {
  tieneAlertas: boolean;
  tieneCriticas: boolean;
  cantidadAlertas: number;
  alertas: DocumentoEvaluado[];
  items: {
    licencia: DocumentoEvaluado;
    seguro: DocumentoEvaluado;
    vtv: DocumentoEvaluado;
    matafuego: DocumentoEvaluado;
  };
}

function parseFechaParts(fecha: Date | string): { year: number; month: number; day: number; fechaStr: string } | null {
  if (!fecha) return null;
  if (typeof fecha === 'string') {
    const clean = fecha.split('T')[0];
    const parts = clean.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return { year: parts[0], month: parts[1] - 1, day: parts[2], fechaStr: clean };
    }
  }
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { year, month, day, fechaStr: `${year}-${pad(month + 1)}-${pad(day)}` };
}

/**
 * Calcula el estado de un documento a partir de su fecha de vencimiento.
 * Normaliza las zonas horarias para comparar días calendario exactos.
 * Ventana de aviso previo: 30 días para "PROXIMO_A_VENCER", <= 7 días o ya vencido es "CRITICA".
 */
export function evaluarFechaVencimiento(
  fecha: Date | string | null | undefined,
  tipo: 'LICENCIA' | 'SEGURO' | 'VTV' | 'MATAFUEGO',
  nombre: string
): DocumentoEvaluado {
  if (!fecha) {
    return {
      tipo,
      nombre,
      fecha: null,
      estado: 'NO_REGISTRADO',
      diasRestantes: null,
      urgencia: tipo === 'SEGURO' || tipo === 'LICENCIA' ? 'ADVERTENCIA' : 'OK',
      mensaje: `${nombre} no registrada en el sistema.`,
      label: 'Sin cargar'
    };
  }

  const parsed = parseFechaParts(fecha);
  if (!parsed) {
    return {
      tipo,
      nombre,
      fecha: null,
      estado: 'NO_REGISTRADO',
      diasRestantes: null,
      urgencia: 'ADVERTENCIA',
      mensaje: `Fecha inválida para ${nombre}.`,
      label: 'Inválida'
    };
  }

  // Comparar por días calendario exactos
  const ahora = new Date();
  const hoyUTC = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const vtoUTC = Date.UTC(parsed.year, parsed.month, parsed.day);

  const diffMs = vtoUTC - hoyUTC;
  const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const fechaStr = parsed.fechaStr;

  if (diasRestantes < -1) {
    const diasVencido = Math.abs(diasRestantes);
    return {
      tipo,
      nombre,
      fecha: fechaStr,
      estado: 'VENCIDO',
      diasRestantes,
      urgencia: 'CRITICA',
      mensaje: `${nombre} se encuentra vencida hace ${diasVencido} días.`,
      label: `Vencido hace ${diasVencido}d`
    };
  }

  if (diasRestantes === -1) {
    return {
      tipo,
      nombre,
      fecha: fechaStr,
      estado: 'VENCIDO',
      diasRestantes: -1,
      urgencia: 'CRITICA',
      mensaje: `${nombre} venció ayer (${fechaStr}).`,
      label: 'Venció ayer'
    };
  }

  if (diasRestantes === 0) {
    return {
      tipo,
      nombre,
      fecha: fechaStr,
      estado: 'VENCE_HOY',
      diasRestantes: 0,
      urgencia: 'CRITICA',
      mensaje: `${nombre} vence hoy.`,
      label: 'Vence hoy'
    };
  }

  if (diasRestantes === 1) {
    return {
      tipo,
      nombre,
      fecha: fechaStr,
      estado: 'PROXIMO_A_VENCER',
      diasRestantes: 1,
      urgencia: 'CRITICA',
      mensaje: `${nombre} vence mañana (${fechaStr}).`,
      label: 'Vence mañana'
    };
  }

  if (diasRestantes <= 30) {
    const urgencia: UrgenciaVencimiento = diasRestantes <= 7 ? 'CRITICA' : 'ADVERTENCIA';
    return {
      tipo,
      nombre,
      fecha: fechaStr,
      estado: 'PROXIMO_A_VENCER',
      diasRestantes,
      urgencia,
      mensaje: `${nombre} vence en ${diasRestantes} días (${fechaStr}).`,
      label: `Vence en ${diasRestantes}d`
    };
  }

  return {
    tipo,
    nombre,
    fecha: fechaStr,
    estado: 'AL_DIA',
    diasRestantes,
    urgencia: 'OK',
    mensaje: `${nombre} vigente (${diasRestantes} días restantes).`,
    label: `Al día (${diasRestantes}d)`
  };
}

/**
 * Evalúa los 4 documentos críticos: Licencia de conducir (chofer), Seguro, VTV y Matafuego (vehículo).
 */
export function evaluarDocumentacionChoferYVehiculo(
  chofer?: { vtoLicencia?: Date | string | null } | null,
  vehiculo?: {
    vtoSeguro?: Date | string | null;
    vtoVtv?: Date | string | null;
    vtoMatafuego?: Date | string | null;
  } | null
): ResumenDocumentacion {
  const licencia = evaluarFechaVencimiento(chofer?.vtoLicencia, 'LICENCIA', 'Licencia de Conducir (Carnet)');
  const seguro = evaluarFechaVencimiento(vehiculo?.vtoSeguro, 'SEGURO', 'Seguro del Vehículo');
  const vtv = evaluarFechaVencimiento(vehiculo?.vtoVtv, 'VTV', 'VTV / Revisión Técnica');
  const matafuego = evaluarFechaVencimiento(vehiculo?.vtoMatafuego, 'MATAFUEGO', 'Carga de Matafuego');

  const items = { licencia, seguro, vtv, matafuego };
  const allList = [licencia, seguro, vtv, matafuego];

  // Las alertas son aquellos que están vencidos, vencen hoy o vencen en <= 30 días
  const alertas = allList.filter(
    (item) => item.estado === 'VENCIDO' || item.estado === 'VENCE_HOY' || item.estado === 'PROXIMO_A_VENCER'
  );

  const tieneCriticas = alertas.some((a) => a.urgencia === 'CRITICA');

  return {
    tieneAlertas: alertas.length > 0,
    tieneCriticas,
    cantidadAlertas: alertas.length,
    alertas,
    items
  };
}

/**
 * Emite por WebSockets en tiempo real una notificación al chofer y a la sala de la remisería
 * informando sobre la documentación próxima a vencer o vencida.
 */
export async function emitirAlertaDocumentacionSiCorresponde(
  choferId: string,
  remiseriaId?: string
): Promise<ResumenDocumentacion | null> {
  try {
    const chofer = await prisma.chofer.findUnique({
      where: { id: choferId },
      include: {
        vehiculo: true
      }
    });

    if (!chofer) return null;

    const targetRemiseriaId = remiseriaId || chofer.remiseriaId;
    const resumen = evaluarDocumentacionChoferYVehiculo(chofer, chofer.vehiculo);

    // Intentar emitir por sockets
    let io: any;
    try {
      io = getIO();
    } catch {
      io = null;
    }

    if (io && targetRemiseriaId) {
      console.log(
        `📢 [Documentación] Notificando chofer ${chofer.nombre} ${chofer.apellido} (#${chofer.numeroChofer}). Alertas: ${resumen.cantidadAlertas}`
      );

      io.to(targetRemiseriaId).emit('alerta_vencimiento_documentacion', {
        choferId: chofer.id,
        choferNombre: `${chofer.nombre} ${chofer.apellido}`,
        vehiculoId: chofer.vehiculo?.id || null,
        vehiculoPatente: chofer.vehiculo?.patente || null,
        resumen,
        timestamp: Date.now()
      });
    }

    return resumen;
  } catch (error) {
    console.error('Error al emitir alerta de documentación:', error);
    return null;
  }
}
