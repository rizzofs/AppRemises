import { DocumentoEvaluado, ResumenDocumentacion, EstadoVencimiento, UrgenciaVencimiento } from '@/types';

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
 * Evalúa el vencimiento de una fecha dada en el frontend.
 * Normaliza las zonas horarias para comparar días calendario exactos.
 */
export function evaluarFechaVencimientoClient(
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
      mensaje: `${nombre} no cargada.`,
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
      mensaje: `${nombre} venció hace ${diasVencido} días.`,
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
 * Evalúa los 4 documentos críticos en el frontend: Licencia de conducir (chofer), Seguro, VTV y Matafuego (vehículo).
 */
export function evaluarDocumentacionClient(
  chofer?: { vtoLicencia?: Date | string | null } | null,
  vehiculo?: {
    vtoSeguro?: Date | string | null;
    vtoVtv?: Date | string | null;
    vtoMatafuego?: Date | string | null;
  } | null
): ResumenDocumentacion {
  const licencia = evaluarFechaVencimientoClient(chofer?.vtoLicencia, 'LICENCIA', 'Licencia de Conducir (Carnet)');
  const seguro = evaluarFechaVencimientoClient(vehiculo?.vtoSeguro, 'SEGURO', 'Seguro Automotor');
  const vtv = evaluarFechaVencimientoClient(vehiculo?.vtoVtv, 'VTV', 'VTV / Revisión Técnica');
  const matafuego = evaluarFechaVencimientoClient(vehiculo?.vtoMatafuego, 'MATAFUEGO', 'Carga de Matafuego');

  const items = { licencia, seguro, vtv, matafuego };
  const allList = [licencia, seguro, vtv, matafuego];

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
 * Retorna las clases Tailwind para badges y tarjetas según el estado
 */
export function getDocumentoBadgeClasses(estado: EstadoVencimiento): {
  badge: string;
  dot: string;
  texto: string;
  border: string;
  bgLight: string;
} {
  switch (estado) {
    case 'VENCIDO':
    case 'VENCE_HOY':
      return {
        badge: 'bg-red-500/10 text-red-500 border-red-500/20 font-bold',
        dot: 'bg-red-500 animate-pulse',
        texto: 'text-red-500',
        border: 'border-red-500/30',
        bgLight: 'bg-red-500/5'
      };
    case 'PROXIMO_A_VENCER':
      return {
        badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20 font-semibold',
        dot: 'bg-amber-500',
        texto: 'text-amber-500',
        border: 'border-amber-500/30',
        bgLight: 'bg-amber-500/5'
      };
    case 'AL_DIA':
      return {
        badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-semibold',
        dot: 'bg-emerald-500',
        texto: 'text-emerald-500',
        border: 'border-emerald-500/30',
        bgLight: 'bg-emerald-500/5'
      };
    case 'NO_REGISTRADO':
    default:
      return {
        badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        dot: 'bg-slate-400',
        texto: 'text-slate-400',
        border: 'border-slate-500/20',
        bgLight: 'bg-slate-500/5'
      };
  }
}
