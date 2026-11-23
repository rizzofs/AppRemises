import { prisma } from '../lib/prisma';
import { whatsappService } from './whatsappService';
import { pushNotificationService } from './pushNotificationService';
import { transcriptionService } from './transcriptionService';
import crypto from 'crypto';

// ==============================================================================
// MÁQUINA DE ESTADOS Y CONTROLADOR CONVERSACIONAL DEL BOT DE WHATSAPP
// ==============================================================================

type EstadoConversacion =
  | 'IDLE'
  | 'ESPERANDO_FECHA_HORA_RESERVA'
  | 'ESPERANDO_ORIGEN'
  | 'CONFIRMANDO_AUDIO_ORIGEN'
  | 'ESPERANDO_DESTINO'
  | 'CONFIRMANDO_AUDIO_DESTINO'
  | 'CONFIRMANDO_COTIZACION';

interface SesionClienteWhatsApp {
  telefono: string;
  estado: EstadoConversacion;
  esReserva?: boolean;
  fechaHoraReserva?: Date;
  fechaHoraTexto?: string;
  horaInicioStr?: string;
  nombre?: string;
  origen?: string;
  origenLat?: number;
  origenLon?: number;
  destino?: string;
  destinoLat?: number;
  destinoLon?: number;
  distanciaKm?: number;
  precioEstimado?: number;
  audioDireccionPendiente?: string;
  audioTextoOriginal?: string;
  updatedAt: number;
}

// Almacenamiento en memoria de sesiones activas (expiran a los 30 minutos de inactividad)
const sesionesMap = new Map<string, SesionClienteWhatsApp>();

function getSesion(telefono: string): SesionClienteWhatsApp {
  const cleanTel = whatsappService.formatearNumero(telefono);
  const ahora = Date.now();
  let sesion = sesionesMap.get(cleanTel);

  // Si la sesión expiró tras 30 minutos de inactividad, reiniciarla
  if (sesion && ahora - sesion.updatedAt > 30 * 60 * 1000) {
    sesionesMap.delete(cleanTel);
    sesion = undefined;
  }

  if (!sesion) {
    sesion = {
      telefono: cleanTel,
      estado: 'IDLE',
      updatedAt: ahora,
    };
    sesionesMap.set(cleanTel, sesion);
  } else {
    sesion.updatedAt = ahora;
  }

  return sesion;
}

function resetSesion(telefono: string) {
  const cleanTel = whatsappService.formatearNumero(telefono);
  sesionesMap.delete(cleanTel);
}

// ==============================================================================
// MOTOR DE GEOCODIFICACIÓN Y RUTEADOR REAL (OPENSTREETMAP NOMINATIM + OSRM)
// ==============================================================================

const geocodeCache = new Map<string, { lat: number; lon: number; nombreOficial?: string; display?: string }>();
const osrmDistanceCache = new Map<string, number>();

interface PuntoInteres {
  alias: RegExp[];
  nombre: string;
  direccion: string;
  lat: number;
  lon: number;
}

// Puntos de referencia emblemáticos y frecuencias urbanas en Chivilcoy
const PUNTOS_INTERES_CHIVILCOY: PuntoInteres[] = [
  // --- Boliches, Discotecas y Bares Nocturnos ---
  {
    alias: [/ozono/i, /ozono\s*planet/i, /ozono\s*megadisco/i],
    nombre: 'Ozono Megadisco (Av. José León Suárez 1103)',
    direccion: 'Av. José León Suárez 1103, Chivilcoy',
    lat: -34.8814513,
    lon: -60.0011988,
  },
  {
    alias: [/babako/i, /babakos/i, /babaco/i],
    nombre: "Babako's Disco (Av. Antonio de Tomaso 851)",
    direccion: 'Av. Antonio de Tomaso 851, Chivilcoy',
    lat: -34.8797418,
    lon: -60.0408011,
  },
  {
    alias: [/ruta\s*30\s*bar/i, /bar\s*ruta\s*30/i],
    nombre: 'Ruta 30 Bar (Lavalle 100)',
    direccion: 'Lavalle 100, Chivilcoy',
    lat: -34.8994017,
    lon: -60.0189655,
  },
  {
    alias: [/sam\s*cervecer[ií]a/i, /cervecer[ií]a\s*sam/i, /\bsam\s*bar\b/i],
    nombre: 'SAM Cervecería (Olavarría 60)',
    direccion: 'Olavarría 60, Chivilcoy',
    lat: -34.8907786,
    lon: -60.0247803,
  },
  {
    alias: [/grey\s*bar/i, /bar\s*grey/i],
    nombre: 'Grey Bar (Pellegrini 424)',
    direccion: 'Carlos Pellegrini 424, Chivilcoy',
    lat: -34.8903598,
    lon: -60.0133635,
  },
  {
    alias: [/ambros[ií]a/i],
    nombre: 'Ambrosía Resto Bar (Rivadavia 25)',
    direccion: 'Rivadavia 25, Chivilcoy',
    lat: -34.8957329,
    lon: -60.0185349,
  },

  // --- Salud y Centros Médicos ---
  {
    alias: [/hospital/i, /guardia del hospital/i, /hospital municipal/i, /santiago fornos/i],
    nombre: 'Hospital Municipal (Av. Hijas de San José 31)',
    direccion: 'Av. Hijas de San José 31, Chivilcoy',
    lat: -34.9119734,
    lon: -60.0372253,
  },
  {
    alias: [/policl[ií]nica/i, /cl[ií]nica del trabajo/i],
    nombre: 'Policlínica (Brandsen 360)',
    direccion: 'Brandsen 360, Chivilcoy',
    lat: -34.9051772,
    lon: -60.0205314,
  },
  {
    alias: [/sanatorio\s*chivilcoy/i, /\bsanatorio\b/i],
    nombre: 'Sanatorio Chivilcoy (Av. Soárez 321)',
    direccion: 'Av. Soárez 321, Chivilcoy',
    lat: -34.891907,
    lon: -60.0129891,
  },

  // --- Clubes Deportivos y Sociales ---
  {
    alias: [/22 de octubre/i, /club 22/i],
    nombre: 'Club 22 de Octubre (Av. 22 de Octubre 179)',
    direccion: 'Av. 22 de Octubre 179, Chivilcoy',
    lat: -34.9054481,
    lon: -60.0232202,
  },
  {
    alias: [/club col[oó]n/i, /cancha de col[oó]n/i, /bar col[oó]n/i, /\bcol[oó]n\b/i],
    nombre: 'Club Colón (Vicente López 170)',
    direccion: 'Vicente López 170, Chivilcoy',
    lat: -34.8919066,
    lon: -60.018989,
  },
  {
    alias: [/racing/i, /club racing/i, /estadio norte/i, /grilon arena/i],
    nombre: 'Racing Club (Av. Soárez 313)',
    direccion: 'Av. Soárez 313, Chivilcoy',
    lat: -34.8919578,
    lon: -60.0132627,
  },
  {
    alias: [/gimnasia/i, /club gimnasia/i, /cancha de gimnasia/i],
    nombre: 'Club Gimnasia (Av. Antonio de Tomaso 449)',
    direccion: 'Av. Antonio de Tomaso 449, Chivilcoy',
    lat: -34.8852128,
    lon: -60.0338578,
  },
  {
    alias: [/san lorenzo/i, /club san lorenzo/i],
    nombre: 'Club San Lorenzo (Río Juramento 220)',
    direccion: 'Río Juramento 220, Chivilcoy',
    lat: -34.8955594,
    lon: -60.01057,
  },
  {
    alias: [/cer[aá]mica/i, /cer[aá]mica argentina/i, /club cer[aá]mica/i],
    nombre: 'Cerámica Argentina (Deán Funes 225)',
    direccion: 'Deán Funes 225, Chivilcoy',
    lat: -34.8971137,
    lon: -60.0122093,
  },

  // --- Supermercados ---
  {
    alias: [/\bvea\b/i, /supermercado vea/i],
    nombre: 'Supermercado Vea (Pellegrini 150)',
    direccion: 'Carlos Pellegrini 150, Chivilcoy',
    lat: -34.8941633,
    lon: -60.0177289,
  },
  {
    alias: [/la an[oó]nima/i, /an[oó]nima/i],
    nombre: 'La Anónima (Av. Soárez 52)',
    direccion: 'Av. Soárez 52, Chivilcoy',
    lat: -34.8953196,
    lon: -60.0174422,
  },

  // --- Instituciones Educativas ---
  {
    alias: [/colegio nacional/i, /\bnacional\b/i, /secundaria 3/i],
    nombre: 'Colegio Nacional (Av. Calixto Calderón 25)',
    direccion: 'Av. Calixto Calderón 25, Chivilcoy',
    lat: -34.9032889,
    lon: -60.0267372,
  },
  {
    alias: [/escuela normal/i, /la normal/i, /isfd 6/i, /instituto 6/i],
    nombre: 'Escuela Normal (Av. José León Suárez 25)',
    direccion: 'Av. José León Suárez 25, Chivilcoy',
    lat: -34.8905012,
    lon: -60.0112796,
  },
  {
    alias: [/escuela comercial/i, /el comercial/i, /secundaria 4/i],
    nombre: 'Escuela Comercial (Av. Antonio de Tomaso 26)',
    direccion: 'Av. Antonio de Tomaso 26, Chivilcoy',
    lat: -34.8909041,
    lon: -60.0272738,
  },
  {
    alias: [/escuela industrial/i, /el industrial/i, /escuela t[eé]cnica/i, /t[eé]cnica 1/i],
    nombre: 'Escuela Técnica 1 (Industrial) (Pellegrini 338)',
    direccion: 'Carlos Pellegrini 338, Chivilcoy',
    lat: -34.8914936,
    lon: -60.0147406,
  },

  // --- Plazas y Parques ---
  {
    alias: [/plaza principal/i, /plaza 25 de mayo/i, /\bcentro\b/i],
    nombre: 'Plaza 25 de Mayo (Centro)',
    direccion: 'Plaza 25 de Mayo, Chivilcoy',
    lat: -34.896867,
    lon: -60.0190293,
  },
  {
    alias: [/plaza col[oó]n/i],
    nombre: 'Plaza Colón',
    direccion: 'Plaza Colón, Chivilcoy',
    lat: -34.8908759,
    lon: -60.0192553,
  },
  {
    alias: [/plaza espa[ñn]a/i],
    nombre: 'Plaza España',
    direccion: 'Plaza España, Chivilcoy',
    lat: -34.8896774,
    lon: -60.0116277,
  },
  {
    alias: [/plaza mitre/i],
    nombre: 'Plaza Mitre',
    direccion: 'Plaza Mitre, Chivilcoy',
    lat: -34.8967027,
    lon: -60.0117616,
  },
  {
    alias: [/plaza belgrano/i],
    nombre: 'Plaza Belgrano',
    direccion: 'Plaza Belgrano, Chivilcoy',
    lat: -34.9028737,
    lon: -60.0188456,
  },
  {
    alias: [/plaza moreno/i],
    nombre: 'Plaza Moreno',
    direccion: 'Plaza Moreno, Chivilcoy',
    lat: -34.9029951,
    lon: -60.0102956,
  },
  {
    alias: [/plaza varela/i, /plaza florencio varela/i],
    nombre: 'Plaza Florencio Varela',
    direccion: 'Plaza Florencio Varela, Chivilcoy',
    lat: -34.8970396,
    lon: -60.0263349,
  },
  {
    alias: [/parque infantil/i, /parque rivadavia/i],
    nombre: 'Parque Infantil Bernardino Rivadavia',
    direccion: 'Parque Infantil, Chivilcoy',
    lat: -34.8903708,
    lon: -60.0265812,
  },
  {
    alias: [/parque martija/i, /\bmartija\b/i],
    nombre: 'Parque Martija (Ruta 30)',
    direccion: 'Ruta Provincial 30, Chivilcoy',
    lat: -34.865,
    lon: -60.105,
  },

  // --- Transporte, Gobierno y Bancos ---
  {
    alias: [/terminal/i, /terminal de [oó]mnibus/i],
    nombre: 'Terminal de Ómnibus (Humberto Primo y Av. Villarino)',
    direccion: 'Humberto Primo, Chivilcoy',
    lat: -34.888547,
    lon: -60.01236,
  },
  {
    alias: [/estaci[oó]n de tren/i, /estaci[oó]n sud/i, /\bestaci[oó]n\b/i],
    nombre: 'Estación Sud (Av. Ceballos)',
    direccion: 'Av. Ceballos, Chivilcoy',
    lat: -34.9045,
    lon: -60.012,
  },
  {
    alias: [/cementerio/i, /cementerio municipal/i],
    nombre: 'Cementerio Municipal (Av. José León Suárez)',
    direccion: 'Av. José León Suárez, Chivilcoy',
    lat: -34.878,
    lon: -60.005,
  },
  {
    alias: [/palacio municipal/i, /municipalidad/i, /\bla muni\b/i],
    nombre: 'Palacio Municipal (25 de Mayo 35)',
    direccion: '25 de Mayo 35, Chivilcoy',
    lat: -34.8962,
    lon: -60.0188,
  },
  {
    alias: [/banco naci[oó]n/i],
    nombre: 'Banco Nación (Av. Soárez y San Martín)',
    direccion: 'Av. Soárez 2, Chivilcoy',
    lat: -34.8965,
    lon: -60.0195,
  },
  {
    alias: [/banco provincia/i],
    nombre: 'Banco Provincia (Pellegrini 2)',
    direccion: 'Pellegrini 2, Chivilcoy',
    lat: -34.897,
    lon: -60.0185,
  },

  // --- Localidades Vecinas y Destinos Interurbanos / de Ruta ---
  {
    // Match "alberti" solo cuando se refiera a la ciudad (sin número de calle ni esquinas)
    alias: [
      /^(voy\s+a\s+|hasta\s+|a\s+|para\s+)?alberti(\s+centro|\s+ciudad)?$/i,
      /ciudad\s+de\s+alberti/i,
      /alberti\s+ruta\s*5/i,
      /partido\s+de\s+alberti/i,
    ],
    nombre: 'Alberti (Centro - Ruta 5)',
    direccion: 'Alberti, Provincia de Buenos Aires',
    lat: -35.0317876,
    lon: -60.2804069,
  },
  {
    alias: [/moquehu[aá]/i],
    nombre: 'Moquehuá (Centro)',
    direccion: 'Moquehuá, Partido de Chivilcoy',
    lat: -35.0920287,
    lon: -59.7754756,
  },
  {
    alias: [/gorostiaga/i],
    nombre: 'Gorostiaga (Centro)',
    direccion: 'Gorostiaga, Partido de Chivilcoy',
    lat: -34.8384597,
    lon: -59.8630066,
  },
  {
    alias: [/la rica/i],
    nombre: 'La Rica (Centro)',
    direccion: 'La Rica, Partido de Chivilcoy',
    lat: -34.9732415,
    lon: -59.861755,
  },
  {
    alias: [/suipacha/i],
    nombre: 'Suipacha (Centro - Ruta 5)',
    direccion: 'Suipacha, Provincia de Buenos Aires',
    lat: -34.7733304,
    lon: -59.690381,
  },
  {
    alias: [/bragado/i],
    nombre: 'Bragado (Centro - Ruta 5)',
    direccion: 'Bragado, Provincia de Buenos Aires',
    lat: -35.1155766,
    lon: -60.489771,
  },
  {
    alias: [/mercedes/i],
    nombre: 'Mercedes (Centro - Ruta 5)',
    direccion: 'Mercedes, Provincia de Buenos Aires',
    lat: -34.6506717,
    lon: -59.4317202,
  },
  {
    alias: [/chacabuco/i],
    nombre: 'Chacabuco (Centro - Ruta 30)',
    direccion: 'Chacabuco, Provincia de Buenos Aires',
    lat: -34.6297043,
    lon: -60.470185,
  },
  {
    alias: [/25 de mayo/i, /veinticinco de mayo/i],
    nombre: '25 de Mayo (Centro)',
    direccion: 'Veinticinco de Mayo, Provincia de Buenos Aires',
    lat: -35.4324152,
    lon: -60.171624,
  },
  {
    alias: [/navarro/i],
    nombre: 'Navarro (Centro - Ruta 30)',
    direccion: 'Navarro, Provincia de Buenos Aires',
    lat: -35.0058641,
    lon: -59.2779545,
  },
  {
    alias: [/ezeiza/i, /aeropuerto\s*(de\s*)?ezeiza/i, /\beze\b/i],
    nombre: 'Aeropuerto Internacional de Ezeiza (EZE)',
    direccion: 'Aeropuerto Internacional Ministro Pistarini, Ezeiza',
    lat: -34.8168141,
    lon: -58.5474234,
  },
  {
    alias: [/aeroparque/i, /\baep\b/i],
    nombre: 'Aeroparque Jorge Newbery (AEP)',
    direccion: 'Aeroparque Jorge Newbery, CABA',
    lat: -34.5594364,
    lon: -58.4146299,
  },
  {
    alias: [/\bcaba\b/i, /capital federal/i, /buenos aires centro/i, /\bobelisco\b/i],
    nombre: 'Ciudad de Buenos Aires (Centro / Obelisco)',
    direccion: 'Obelisco, Av. 9 de Julio, CABA',
    lat: -34.603722,
    lon: -58.381592,
  },
];

function buscarPuntoInteres(texto: string): PuntoInteres | null {
  const t = texto.trim().toLowerCase();
  for (const p of PUNTOS_INTERES_CHIVILCOY) {
    for (const r of p.alias) {
      if (r.test(t)) {
        return p;
      }
    }
  }
  return null;
}

/**
 * Geocodifica una dirección escrita en lenguaje natural (ej: "Eustaquia Sánchez 64", "José León Suárez y calle 21")
 * Prioriza puntos de interés reconocidos de Chivilcoy y resuelve intersecciones / esquinas comunes.
 */
async function geocodificarDireccion(
  rawQuery: string
): Promise<{ lat: number; lon: number; nombreOficial?: string; display?: string } | null> {
  const q = (rawQuery || '').trim();
  if (!q || q.length < 2) return null;

  // 1. Verificar si coincide con un punto de interés conocido de Chivilcoy
  const puntoDirecto = buscarPuntoInteres(q);
  if (puntoDirecto) {
    return {
      lat: puntoDirecto.lat,
      lon: puntoDirecto.lon,
      nombreOficial: puntoDirecto.nombre,
      display: puntoDirecto.direccion,
    };
  }

  const cacheKey = q.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // 2. Limpiar preposiciones y frases conversacionales ("voy hasta", "hasta el", "estoy en", etc.)
  let limpia = transcriptionService.extraerDireccion(q);

  // Verificar si la versión limpia coincide con un punto de interés
  const puntoLimpio = buscarPuntoInteres(limpia);
  if (puntoLimpio) {
    const resPunto = {
      lat: puntoLimpio.lat,
      lon: puntoLimpio.lon,
      nombreOficial: puntoLimpio.nombre,
      display: puntoLimpio.direccion,
    };
    geocodeCache.set(cacheKey, resPunto);
    return resPunto;
  }

  // 3. Generar variantes ordenadas de búsqueda en OpenStreetMap
  const queryFinal = limpia.length >= 3 ? limpia : q;
  const variantes: string[] = [];
  const hasCityConstraint =
    /chivilcoy|alberti|moquehu[aá]|gorostiaga|la\s+rica|suipacha|bragado|mercedes|chacabuco|ezeiza|aeroparque|caba|buenos\s+aires|lujan|navarro/i.test(
      queryFinal
    );
  const base = hasCityConstraint ? queryFinal : `${queryFinal}, Chivilcoy`;
  variantes.push(base);

  // Si incluye " y calle X", normalizar a " y X"
  if (/ y calle /i.test(queryFinal)) {
    const simplificada = queryFinal.replace(/ y calle /gi, ' y ');
    variantes.push(hasCityConstraint ? simplificada : `${simplificada}, Chivilcoy`);
  }

  // Si incluye intersección (" y " o " esq "), probar también invertir el orden de las calles en la esquina
  if (/\s+y\s+|\s+esq\.?\s+/i.test(queryFinal)) {
    const partes = queryFinal.split(/\s+y\s+|\s+esq\.?\s+/i);
    if (partes[0] && partes[1] && partes[0].trim().length >= 3 && partes[1].trim().length >= 3) {
      const invertida = `${partes[1].trim()} y ${partes[0].trim()}`;
      variantes.push(hasCityConstraint ? invertida : `${invertida}, Chivilcoy`);
    }
  }

  // Si tiene número al final, buscar también el nombre de la calle sola
  const matchNumero = queryFinal.match(/^([a-zA-ZáéíóúÁÉÍÓÚñÑ\s\.\d]+?)\s+(\d{1,5})$/);
  if (matchNumero && matchNumero[1]) {
    variantes.push(hasCityConstraint ? `${matchNumero[1].trim()}` : `${matchNumero[1].trim()}, Chivilcoy`);
  }

  // Si es un destino interurbano (Alberti, Suipacha, etc.), ampliar el viewbox al corredor regional
  const esInterurbano =
    /alberti|moquehu[aá]|gorostiaga|la\s+rica|suipacha|bragado|mercedes|chacabuco|ezeiza|aeroparque|caba|buenos\s+aires|lujan|navarro/i.test(
      queryFinal
    );
  const viewboxParam = esInterurbano
    ? 'viewbox=-60.65,-34.30,-58.20,-35.65&bounded=0'
    : 'viewbox=-60.15,-34.83,-59.88,-34.96&bounded=0';

  for (const query of variantes) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&countrycodes=ar&limit=1&addressdetails=1&${viewboxParam}`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'AppRemises/1.0 (coordinacion@remises.com)' },
        signal: AbortSignal.timeout(3000),
      });

      const data = (await res.json()) as any[];
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const display = data[0].display_name || '';

        // Validar que la respuesta pertenezca efectivamente a Chivilcoy o sus corredores interurbanos válidos
        const esValido =
          display.toLowerCase().includes('chivilcoy') ||
          display.toLowerCase().includes('alberti') ||
          display.toLowerCase().includes('moquehu') ||
          display.toLowerCase().includes('gorostiaga') ||
          display.toLowerCase().includes('suipacha') ||
          display.toLowerCase().includes('bragado') ||
          display.toLowerCase().includes('mercedes') ||
          display.toLowerCase().includes('chacabuco') ||
          display.toLowerCase().includes('ezeiza') ||
          display.toLowerCase().includes('aeroparque') ||
          display.toLowerCase().includes('buenos aires') ||
          (lat >= -35.15 && lat <= -34.70 && lon >= -60.30 && lon <= -59.75);

        if (esValido) {
          const resultado = {
            lat,
            lon,
            display,
          };
          geocodeCache.set(cacheKey, resultado);
          return resultado;
        }
      }
    } catch (err) {
      // Continuar con la siguiente variante si hay timeout
    }
  }

  return null;
}

/**
 * Calcula la distancia real de viaje en auto por calles utilizando OSRM (Open Source Routing Machine).
 * Si OSRM no responde en 3 segundos, utiliza Haversine con coeficiente urbano de curvas.
 */
async function calcularDistanciaReal(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number> {
  const routeKey = `${lat1.toFixed(4)},${lon1.toFixed(4)}->${lat2.toFixed(4)},${lon2.toFixed(4)}`;
  if (osrmDistanceCache.has(routeKey)) {
    return osrmDistanceCache.get(routeKey)!;
  }

  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const data = (await res.json()) as any;
    if (data.routes && data.routes.length > 0) {
      const km = data.routes[0].distance / 1000;
      const kmRedondeado = Math.round(km * 10) / 10;
      osrmDistanceCache.set(routeKey, kmRedondeado);
      return kmRedondeado;
    }
  } catch (err) {
    console.warn('OSRM timeout/error, utilizando estimación Haversine urbana:', err);
  }

  // Fallback Haversine con factor 1.35 de recorrido urbano en cuadrícula
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const linealKm = R * c;
  const kmEstimado = Math.round(linealKm * 1.35 * 10) / 10;
  return kmEstimado;
}

// ==============================================================================
// HELPERS DE FECHA Y PARSEO NATURAL DE RESERVAS (ZONA HORARIA ARGENTINA UTC-3)
// ==============================================================================

function getFechaActualArgentina(): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
} {
  const now = new Date();
  const arFormatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'long',
    hour12: false,
  });

  const parts = arFormatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10) - 1; // 0-indexed
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);

  const arDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const dayOfWeek = arDate.getUTCDay();

  return { year, month, day, hour, minute, dayOfWeek };
}

function formatearFechaLegible(fechaUtc: Date): { fechaTexto: string; horaStr: string } {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(fechaUtc);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const weekdayCapitalized = map.weekday.charAt(0).toUpperCase() + map.weekday.slice(1);
  const horaStr = `${map.hour}:${map.minute}`;
  const fechaTexto = `${weekdayCapitalized} ${map.day}/${map.month} a las ${horaStr} hs`;

  return { fechaTexto, horaStr };
}

function parsearFechaHoraReserva(input: string): { fecha: Date; fechaTexto: string; horaStr: string } | { error: string } {
  const texto = input.trim().toLowerCase();
  const ar = getFechaActualArgentina();

  // 1. "en X horas" / "en X minutos"
  const matchEnHoras = texto.match(/en\s+(\d+)\s*(h|hs|hora|horas)/i);
  const matchEnMins = texto.match(/en\s+(\d+)\s*(m|min|mins|minuto|minutos)/i);
  if (matchEnHoras || matchEnMins) {
    const addHours = matchEnHoras ? parseInt(matchEnHoras[1], 10) : 0;
    const addMins = matchEnMins ? parseInt(matchEnMins[1], 10) : 0;
    const targetUtcMs = Date.now() + (addHours * 60 + addMins) * 60 * 1000;
    const targetDate = new Date(targetUtcMs);

    const diffMins = (targetDate.getTime() - Date.now()) / (1000 * 60);
    if (diffMins < 15) {
      return { error: '⚠️ Por favor indicá un horario con al menos *15 minutos de anticipación*.' };
    }

    const { fechaTexto, horaStr } = formatearFechaLegible(targetDate);
    return { fecha: targetDate, fechaTexto, horaStr };
  }

  // 2. Extraer Hora (HH:mm, HH.mm, HH hs, etc.)
  let textoSinFecha = texto
    .replace(/\b(hoy|mañana|manana|pasado mañana|pasado manana)\b/g, '')
    .replace(/\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/g, '')
    .replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g, '')
    .trim();

  const timeRegex = /(?:a\s+las\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(hs|hrs|horas|am|pm)?/i;
  const timeMatch = textoSinFecha.match(timeRegex);
  if (!timeMatch || !timeMatch[1]) {
    return {
      error:
        '⚠️ No pudimos reconocer la hora de tu reserva.\n\nPor favor escribí la fecha y hora indicando el horario (ej: *Mañana 08:30*, *Hoy 23:00*, *Lunes 07:15*).',
    };
  }

  let targetHour = parseInt(timeMatch[1], 10);
  const targetMinute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const ampm = (timeMatch[3] || '').toLowerCase();

  if (ampm === 'pm' && targetHour < 12) targetHour += 12;
  if (ampm === 'am' && targetHour === 12) targetHour = 0;

  if (targetHour < 0 || targetHour > 23 || targetMinute < 0 || targetMinute > 59) {
    return { error: '⚠️ El horario ingresado no es válido. Ingresá una hora entre 00:00 y 23:59.' };
  }

  let targetYear = ar.year;
  let targetMonth = ar.month;
  let targetDay = ar.day;

  // 3. Determinar el Día
  if (texto.includes('pasado mañana') || texto.includes('pasado manana')) {
    targetDay += 2;
  } else if (texto.includes('mañana') || texto.includes('manana')) {
    targetDay += 1;
  } else if (texto.includes('hoy')) {
    // Es hoy
  } else {
    // ¿Nombre de día de semana?
    const diasSemanaMap: Record<string, number> = {
      domingo: 0,
      lunes: 1,
      martes: 2,
      miercoles: 3,
      miércoles: 3,
      jueves: 4,
      viernes: 5,
      sabado: 6,
      sábado: 6,
    };

    let diaSemanaEncontrado = -1;
    for (const [diaNombre, diaNum] of Object.entries(diasSemanaMap)) {
      if (new RegExp(`\\b${diaNombre}\\b`, 'i').test(texto)) {
        diaSemanaEncontrado = diaNum;
        break;
      }
    }

    if (diaSemanaEncontrado !== -1) {
      let diffDays = (diaSemanaEncontrado - ar.dayOfWeek + 7) % 7;
      if (diffDays === 0) {
        if (targetHour < ar.hour || (targetHour === ar.hour && targetMinute <= ar.minute)) {
          diffDays = 7;
        }
      }
      targetDay += diffDays;
    } else {
      // ¿Fecha numérica DD/MM?
      const fechaNumMatch = texto.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
      if (fechaNumMatch) {
        targetDay = parseInt(fechaNumMatch[1], 10);
        targetMonth = parseInt(fechaNumMatch[2], 10) - 1;
        if (fechaNumMatch[3]) {
          let y = parseInt(fechaNumMatch[3], 10);
          if (y < 100) y += 2000;
          targetYear = y;
        }
      } else {
        // Sin día explícito: si la hora ya pasó hoy (o falta menos de 15m), asume mañana
        if (targetHour < ar.hour || (targetHour === ar.hour && targetMinute <= ar.minute + 15)) {
          targetDay += 1;
        }
      }
    }
  }

  // Argentina es UTC-3, por lo que UTC = targetHour + 3
  const targetDateUtc = new Date(Date.UTC(targetYear, targetMonth, targetDay, targetHour + 3, targetMinute, 0));

  const diffMinutes = (targetDateUtc.getTime() - Date.now()) / (1000 * 60);
  if (diffMinutes < 15) {
    return {
      error:
        '⚠️ La hora elegida ya pasó o es muy próxima. Por favor programá tu viaje con al menos *15 minutos de anticipación*.\n\n_Si necesitás un móvil ya mismo, presioná "Pedir Ahora"_',
    };
  }

  if (diffMinutes > 30 * 24 * 60) {
    return {
      error: '⚠️ Las reservas pueden programarse hasta con 30 días de anticipación.',
    };
  }

  const { fechaTexto, horaStr } = formatearFechaLegible(targetDateUtc);
  return {
    fecha: targetDateUtc,
    fechaTexto,
    horaStr,
  };
}

// ==============================================================================
// SERVICIO PRINCIPAL DEL BOT DE WHATSAPP
// ==============================================================================

export const whatsappBotService = {
  /**
   * Procesa cualquier mensaje entrante de un usuario por WhatsApp
   */
  async procesarMensaje(params: {
    from: string;
    messageId: string;
    tipo: 'text' | 'interactive' | 'location' | 'audio';
    texto?: string;
    botonId?: string;
    location?: { latitude: number; longitude: number; name?: string; address?: string };
    audioId?: string;
    senderName?: string;
  }) {
    const { from, messageId, tipo, texto, botonId, location, audioId, senderName } = params;
    const cleanFrom = whatsappService.formatearNumero(from);
    const sesion = getSesion(cleanFrom);

    // Marcar mensaje como leído en WhatsApp
    whatsappService.marcarComoLeido(messageId).catch(() => {});

    // 1. Identificar o registrar al cliente en la base de datos
    let cliente = await prisma.cliente.findFirst({
      where: {
        OR: [
          { telefono: cleanFrom },
          { telefono: { contains: cleanFrom.slice(-8) } }, // Coincidencia por últimos 8 dígitos
        ],
      },
      include: {
        remiseria: true,
      },
    });

    const nombreMostrado = cliente?.nombre || senderName || 'Pasajero';
    sesion.nombre = nombreMostrado;

    // Obtener remisería principal
    let remiseria = cliente?.remiseria;
    if (!remiseria) {
      remiseria = await prisma.remiseria.findFirst();
    }
    const remiseriaId = remiseria?.id || '';
    const bajadaBandera = remiseria?.bajadaBandera || 3500;
    const valorKm = remiseria?.valorKm || 800;

    // 2. Comandos globales directos (reiniciar, cancelar, estado, operador)
    const textoLower = (texto || '').trim().toLowerCase();
    const actionId = botonId || '';

    if (actionId === 'BTN_CANCELAR' || textoLower === 'cancelar' || textoLower === 'salir') {
      resetSesion(cleanFrom);
      return await whatsappService.enviarBotones(
        cleanFrom,
        '❌ Operación cancelada. ¡Cuando nos necesites volvé a escribirnos!',
        [
          { id: 'BTN_PEDIR_AHORA', title: '🚕 Pedir Ahora' },
          { id: 'BTN_RESERVAR', title: '📅 Reservar Viaje' },
        ]
      );
    }

    if (actionId === 'BTN_OPERADOR' || textoLower === 'operador' || textoLower === 'central') {
      return await whatsappService.enviarTexto(
        cleanFrom,
        `📞 Podés comunicarte directamente con nuestros operadores a los teléfonos fijos:\n☎️ 2346-427637\n☎️ 2346-433000\n\nEstamos a tu disposición las 24 horas.`
      );
    }

    if (actionId === 'BTN_ESTADO' || textoLower === 'estado' || textoLower === 'mis viajes') {
      return await this.consultarEstadoViaje(cleanFrom, cliente?.id);
    }

    // ==============================================================================
    // 3. PROCESAMIENTO DE MENSAJES DE AUDIO / VOZ (TRANSCRIPCIÓN Y CONFIRMACIÓN)
    // ==============================================================================
    if (tipo === 'audio' && audioId) {
      const transcripcion = await transcriptionService.transcribirAudioWhatsApp(audioId);

      if (!transcripcion || transcripcion.trim().length < 2) {
        return await whatsappService.enviarTexto(
          cleanFrom,
          '🎙️ *No pudimos entender con claridad tu audio por ruido de fondo.*\n\n✍️ Por favor escribinos tu mensaje por texto o compartinos tu ubicación GPS con el clip 📎.'
        );
      }

      let direccionLimpia = transcriptionService.extraerDireccion(transcripcion);
      const puntoEncontrado = buscarPuntoInteres(direccionLimpia) || buscarPuntoInteres(transcripcion);
      if (puntoEncontrado) {
        direccionLimpia = puntoEncontrado.nombre;
      }
      sesion.audioTextoOriginal = transcripcion;
      sesion.audioDireccionPendiente = direccionLimpia;

      if (sesion.estado === 'IDLE') {
        const transLower = transcripcion.toLowerCase();
        if (
          transLower.includes('reserva') ||
          transLower.includes('agendar') ||
          transLower.includes('para mañana') ||
          transLower.includes('para más tarde')
        ) {
          sesion.esReserva = true;
          const parseResult = parsearFechaHoraReserva(transcripcion);
          if (!('error' in parseResult)) {
            sesion.fechaHoraReserva = parseResult.fecha;
            sesion.fechaHoraTexto = parseResult.fechaTexto;
            sesion.horaInicioStr = parseResult.horaStr;
            sesion.estado = 'ESPERANDO_ORIGEN';
            return await whatsappService.enviarTexto(
              cleanFrom,
              `🎙️ *Te escuchamos:* _"${transcripcion}"_\n\n🗓️ *Reserva programada para:* ${parseResult.fechaTexto}\n\n📍 *¿Dónde te pasamos a buscar?*\nPodés escribir la dirección o mandar otro audio indicando el origen:`
            );
          } else {
            sesion.estado = 'ESPERANDO_FECHA_HORA_RESERVA';
            return await whatsappService.enviarTexto(
              cleanFrom,
              `🎙️ *Te escuchamos:* _"${transcripcion}"_\n\n📅 ¿Para qué día y hora necesitás el remís? (ej: *Mañana 08:30*, *Hoy 23:00*)`
            );
          }
        } else {
          // Audio normal en IDLE pidiendo auto
          sesion.esReserva = false;
          sesion.estado = 'CONFIRMANDO_AUDIO_ORIGEN';
          return await whatsappService.enviarBotones(
            cleanFrom,
            `🎙️ *Escuchamos tu audio:*\n_\"${transcripcion}\"_\n\n🟢 Entendimos que tu origen es:\n*${direccionLimpia}*\n\n¿Es correcta esta dirección para buscarte?`,
            [
              { id: 'BTN_CONFIRMAR_AUDIO_ORIGEN', title: '✅ Sí, es correcta' },
              { id: 'BTN_REINTENTAR_AUDIO_ORIGEN', title: '✍️ No, escribirla' },
            ],
            'Confirmación de Audio'
          );
        }
      }

      if (sesion.estado === 'ESPERANDO_ORIGEN') {
        sesion.estado = 'CONFIRMANDO_AUDIO_ORIGEN';
        return await whatsappService.enviarBotones(
          cleanFrom,
          `🎙️ *Escuchamos tu audio:*\n_\"${transcripcion}\"_\n\n🟢 Entendimos que tu origen es:\n*${direccionLimpia}*\n\n¿Es correcta esta dirección para buscarte?`,
          [
            { id: 'BTN_CONFIRMAR_AUDIO_ORIGEN', title: '✅ Sí, es correcta' },
            { id: 'BTN_REINTENTAR_AUDIO_ORIGEN', title: '✍️ No, escribirla' },
          ],
          'Confirmación de Audio'
        );
      }

      if (sesion.estado === 'ESPERANDO_DESTINO') {
        sesion.estado = 'CONFIRMANDO_AUDIO_DESTINO';
        return await whatsappService.enviarBotones(
          cleanFrom,
          `🎙️ *Escuchamos tu audio:*\n_\"${transcripcion}\"_\n\n🔴 Entendimos que tu destino es:\n*${direccionLimpia}*\n\n¿Es correcto este destino?`,
          [
            { id: 'BTN_CONFIRMAR_AUDIO_DESTINO', title: '✅ Sí, es correcto' },
            { id: 'BTN_REINTENTAR_AUDIO_DESTINO', title: '✍️ No, escribirlo' },
          ],
          'Confirmación de Audio'
        );
      }

      if (sesion.estado === 'ESPERANDO_FECHA_HORA_RESERVA') {
        const parseResult = parsearFechaHoraReserva(transcripcion);
        if ('error' in parseResult) {
          return await whatsappService.enviarTexto(
            cleanFrom,
            `🎙️ *Te escuchamos:* _"${transcripcion}"_\n\n${parseResult.error}`
          );
        }
        sesion.fechaHoraReserva = parseResult.fecha;
        sesion.fechaHoraTexto = parseResult.fechaTexto;
        sesion.horaInicioStr = parseResult.horaStr;
        sesion.estado = 'ESPERANDO_ORIGEN';
        return await whatsappService.enviarTexto(
          cleanFrom,
          `🗓️ *Reserva para:* ${parseResult.fechaTexto}\n\n📍 *¿Dónde te pasamos a buscar?*\nPodés escribir la dirección o mandar otro audio diciendo el lugar:`
        );
      }
    }

    // ==============================================================================
    // 4. MANEJO SEGÚN ESTADO DE LA CONVERSACIÓN
    // ==============================================================================
    switch (sesion.estado) {
      case 'IDLE': {
        // Disparador: Reservar para más tarde
        if (
          actionId === 'BTN_RESERVAR' ||
          textoLower.includes('reserva') ||
          textoLower.includes('agendar') ||
          textoLower.includes('programar') ||
          textoLower.includes('para mañana') ||
          textoLower.includes('para mas tarde') ||
          textoLower.includes('para más tarde') ||
          textoLower.includes('otro momento')
        ) {
          sesion.esReserva = true;
          sesion.estado = 'ESPERANDO_FECHA_HORA_RESERVA';
          return await whatsappService.enviarTexto(
            cleanFrom,
            `📅 *¿Para qué día y hora necesitás el remís?*\n\nPodés escribir por ejemplo:\n• *'Hoy 23:30'*\n• *'Mañana 08:00'*\n• *'Lunes 07:30'*\n• *'25/11 14:00'*\n\n_(O podés mandarnos un audio diciendo el día y la hora)_`
          );
        }

        // Disparador: Pedir ahora inmediatamente
        if (
          actionId === 'BTN_PEDIR' ||
          actionId === 'BTN_PEDIR_AHORA' ||
          textoLower.includes('pedir') ||
          textoLower.includes('remis') ||
          textoLower.includes('auto') ||
          textoLower.includes('viaje') ||
          textoLower.includes('ahora')
        ) {
          sesion.esReserva = false;
          sesion.estado = 'ESPERANDO_ORIGEN';
          return await whatsappService.enviarTexto(
            cleanFrom,
            `📍 *¿Dónde te pasamos a buscar?*\n\nPodés:\n1. 📎 Compartir tu *ubicación GPS* desde el clip de WhatsApp.\n2. ✍️ O escribir la calle y altura (ej: *Rivadavia 250*).\n3. 🎙️ O mandar un *mensaje de voz*.`
          );
        }

        // Si ya tiene un viaje activo en curso, mostrarle el estado directo
        const viajeActivo = await prisma.viaje.findFirst({
          where: {
            OR: [
              { clienteTelefono: cleanFrom },
              { clienteId: cliente?.id },
            ],
            estado: { in: ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] },
          },
        });

        if (viajeActivo) {
          return await this.consultarEstadoViaje(cleanFrom, cliente?.id);
        }

        // Saludo de bienvenida y menú principal interactivo
        const mensajeBienvenida = `👋 ¡Hola, *${nombreMostrado}*! Bienvenido a *Remises Bruno*.\n¿Cómo querés viajar hoy?`;
        return await whatsappService.enviarBotones(cleanFrom, mensajeBienvenida, [
          { id: 'BTN_PEDIR_AHORA', title: '🚕 Pedir Ahora' },
          { id: 'BTN_RESERVAR', title: '📅 Reservar Viaje' },
          { id: 'BTN_ESTADO', title: '📍 Estado / Ayuda' },
        ]);
      }

      case 'ESPERANDO_FECHA_HORA_RESERVA': {
        if (!texto || texto.trim().length < 2) {
          return await whatsappService.enviarTexto(
            cleanFrom,
            '⚠️ Por favor indicá el día y la hora de tu reserva (ej: *Mañana 08:30*, *Hoy 23:00*, *Lunes 07:15*).'
          );
        }

        const parseResult = parsearFechaHoraReserva(texto);
        if ('error' in parseResult) {
          return await whatsappService.enviarTexto(cleanFrom, parseResult.error);
        }

        sesion.fechaHoraReserva = parseResult.fecha;
        sesion.fechaHoraTexto = parseResult.fechaTexto;
        sesion.horaInicioStr = parseResult.horaStr;
        sesion.estado = 'ESPERANDO_ORIGEN';

        return await whatsappService.enviarTexto(
          cleanFrom,
          `🗓️ *Reserva para:* ${parseResult.fechaTexto}\n\n📍 *¿Dónde te pasamos a buscar?*\nPodés:\n1. 📎 Compartir tu *ubicación GPS* desde el clip de WhatsApp.\n2. ✍️ O escribir la dirección (ej: *Rivadavia 250*).\n3. 🎙️ O mandar un *audio*.`
        );
      }

      case 'ESPERANDO_ORIGEN': {
        if (tipo === 'location' && location) {
          sesion.origenLat = location.latitude;
          sesion.origenLon = location.longitude;
          sesion.origen = location.address || location.name || `Ubicación GPS (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`;
        } else if (texto && texto.trim().length >= 3) {
          // Limpiar frases introductorias ("estoy en...", "salgo de...") y validar dirección
          const direccionLimpia = transcriptionService.extraerDireccion(texto.trim());
          const geoO = await geocodificarDireccion(direccionLimpia);
          if (!geoO) {
            return await whatsappService.enviarTexto(
              cleanFrom,
              `⚠️ No pudimos encontrar la dirección *"${direccionLimpia}"* en el mapa de Chivilcoy.\n\nPor favor verificá:\n• Que el nombre de la calle y la altura estén bien escritos (ej: *Rivadavia 250*).\n• Si es una esquina, asegurate de que ambas calles se crucen (ej: *Sarmiento y Belgrano*).\n• O compartinos tu *ubicación GPS* directa desde el clip 📎 de WhatsApp.`
            );
          }
          sesion.origen = geoO.nombreOficial || direccionLimpia;
          sesion.origenLat = geoO.lat;
          sesion.origenLon = geoO.lon;
        } else {
          return await whatsappService.enviarTexto(
            cleanFrom,
            '⚠️ Por favor enviá una dirección válida, compartí tu ubicación GPS o mandanos un audio.'
          );
        }

        sesion.estado = 'ESPERANDO_DESTINO';
        return await whatsappService.enviarTexto(
          cleanFrom,
          `✅ *Origen:* ${sesion.origen}\n\n🏁 *¿Hacia dónde te llevamos?*\nEscribí la dirección de destino o mandá un audio (ej: *Av. Sarmiento 500*, *Hospital Municipal*):`
        );
      }

      case 'CONFIRMANDO_AUDIO_ORIGEN': {
        const esAfirmativo =
          actionId === 'BTN_CONFIRMAR_AUDIO_ORIGEN' ||
          textoLower === 'si' ||
          textoLower === 'sí' ||
          textoLower.includes('correcto') ||
          textoLower.includes('correcta');

        const esNegativo =
          actionId === 'BTN_REINTENTAR_AUDIO_ORIGEN' ||
          textoLower === 'no' ||
          textoLower.includes('corregir') ||
          textoLower.includes('cambiar');

        if (esAfirmativo) {
          const dirO = transcriptionService.extraerDireccion(sesion.audioDireccionPendiente || 'Origen confirmado por audio');
          const geoO = await geocodificarDireccion(dirO);
          if (!geoO) {
            sesion.estado = 'ESPERANDO_ORIGEN';
            return await whatsappService.enviarTexto(
              cleanFrom,
              `⚠️ No pudimos encontrar la dirección *"${dirO}"* en el mapa de Chivilcoy.\n\nPor favor verificá:\n• Que el nombre de la calle y la altura estén bien escritos (ej: *Rivadavia 250*).\n• Si es una esquina, asegurate de que ambas calles se crucen.\n• O compartinos tu *ubicación GPS* directa desde el clip 📎 de WhatsApp.`
            );
          }
          sesion.origen = geoO.nombreOficial || dirO;
          sesion.origenLat = geoO.lat;
          sesion.origenLon = geoO.lon;
          sesion.estado = 'ESPERANDO_DESTINO';
          return await whatsappService.enviarTexto(
            cleanFrom,
            `✅ *Origen confirmado:* ${sesion.origen}\n\n🏁 *¿Hacia dónde te llevamos?*\nEscribí la dirección de destino o mandá un audio:`
          );
        } else if (esNegativo) {
          sesion.estado = 'ESPERANDO_ORIGEN';
          return await whatsappService.enviarTexto(
            cleanFrom,
            '✍️ Por favor escribí la calle y altura por texto (ej: *Rivadavia 250*) o compartinos tu ubicación GPS 📎:'
          );
        } else if (texto && texto.trim().length >= 3) {
          // El usuario escribió directamente la corrección
          const geoO = await geocodificarDireccion(texto.trim());
          if (!geoO) {
            return await whatsappService.enviarTexto(
              cleanFrom,
              `⚠️ No pudimos encontrar la dirección *"${texto.trim()}"* en el mapa de Chivilcoy.\n\nPor favor verificá el nombre de la calle y altura (ej: *Rivadavia 250*) o compartinos tu ubicación GPS 📎:`
            );
          }
          sesion.origen = geoO.nombreOficial || texto.trim();
          sesion.origenLat = geoO.lat;
          sesion.origenLon = geoO.lon;
          sesion.estado = 'ESPERANDO_DESTINO';
          return await whatsappService.enviarTexto(
            cleanFrom,
            `✅ *Origen:* ${sesion.origen}\n\n🏁 *¿Hacia dónde te llevamos?*\nEscribí la dirección de destino o mandá un audio:`
          );
        } else {
          return await whatsappService.enviarBotones(
            cleanFrom,
            `Entendimos que tu origen es: *${sesion.audioDireccionPendiente}*\n\n¿Es correcto?`,
            [
              { id: 'BTN_CONFIRMAR_AUDIO_ORIGEN', title: '✅ Sí, es correcta' },
              { id: 'BTN_REINTENTAR_AUDIO_ORIGEN', title: '✍️ No, escribirla' },
            ]
          );
        }
      }

      case 'ESPERANDO_DESTINO': {
        if (tipo === 'location' && location) {
          sesion.destinoLat = location.latitude;
          sesion.destinoLon = location.longitude;
          sesion.destino = location.address || location.name || `Destino GPS (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`;
        } else if (texto && texto.trim().length >= 3) {
          // Limpiar frases como "voy hasta...", "llevame a..." y validar en el mapa
          const direccionLimpia = transcriptionService.extraerDireccion(texto.trim());
          const geoD = await geocodificarDireccion(direccionLimpia);
          if (!geoD) {
            return await whatsappService.enviarTexto(
              cleanFrom,
              `⚠️ No pudimos encontrar el destino *"${direccionLimpia}"* en el mapa de Chivilcoy.\n\nPor favor verificá el nombre de la calle (ej: *Av. Sarmiento 500*), punto de referencia (ej: *Hospital*, *Terminal*) o compartí tu ubicación GPS 📎:`
            );
          }
          sesion.destino = geoD.nombreOficial || direccionLimpia;
          sesion.destinoLat = geoD.lat;
          sesion.destinoLon = geoD.lon;
        } else {
          return await whatsappService.enviarTexto(
            cleanFrom,
            '⚠️ Por favor escribí la dirección hacia dónde te llevamos o mandanos un audio.'
          );
        }

        // Si el origen no tenía coordenadas, intentar nuevamente
        if ((!sesion.origenLat || !sesion.origenLon) && sesion.origen) {
          const geoO = await geocodificarDireccion(sesion.origen);
          if (geoO) {
            sesion.origenLat = geoO.lat;
            sesion.origenLon = geoO.lon;
            if (geoO.nombreOficial) {
              sesion.origen = geoO.nombreOficial;
            }
          }
        }

        // Calcular distancia real (vía OSRM o Haversine)
        let dist = 2.5;
        if (sesion.origenLat && sesion.origenLon && sesion.destinoLat && sesion.destinoLon) {
          dist = await calcularDistanciaReal(
            sesion.origenLat,
            sesion.origenLon,
            sesion.destinoLat,
            sesion.destinoLon
          );
          if (dist < 0.5) dist = 0.8;
        }

        // Cálculo de precio según tarifario vigente de la remisería
        const kmAdicionales = Math.max(0, dist - 1);
        const precioGpsPuro = bajadaBandera + kmAdicionales * valorKm;
        const precioEstimado = Math.round(precioGpsPuro / 100) * 100;

        sesion.distanciaKm = dist;
        sesion.precioEstimado = precioEstimado;
        sesion.estado = 'CONFIRMANDO_COTIZACION';

        if (sesion.esReserva && sesion.fechaHoraTexto) {
          const resumenReserva =
            `📋 *Resumen de tu Reserva Programada:*\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `🗓️ *Fecha y Hora:* *${sesion.fechaHoraTexto}*\n` +
            `🟢 *Origen:* ${sesion.origen}\n` +
            `🔴 *Destino:* ${sesion.destino}\n` +
            `📏 *Distancia:* ~${dist} km\n` +
            `💵 *Precio estimado:* *$${precioEstimado.toLocaleString('es-AR')}* _(Efectivo)_\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `¿Confirmás la reserva?`;

          return await whatsappService.enviarBotones(
            cleanFrom,
            resumenReserva,
            [
              { id: 'BTN_CONFIRMAR_RESERVA', title: '✅ Confirmar Reserva' },
              { id: 'BTN_CANCELAR', title: '❌ Cancelar' },
            ],
            'Reserva de Viaje'
          );
        } else {
          const resumen =
            `📋 *Resumen de tu viaje:*\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `🟢 *Origen:* ${sesion.origen}\n` +
            `🔴 *Destino:* ${sesion.destino}\n` +
            `📏 *Distancia:* ~${dist} km\n` +
            `💵 *Precio estimado:* *$${precioEstimado.toLocaleString('es-AR')}* _(Efectivo)_\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `¿Deseas solicitar el móvil ahora?`;

          return await whatsappService.enviarBotones(
            cleanFrom,
            resumen,
            [
              { id: 'BTN_CONFIRMAR', title: '✅ Confirmar Pedido' },
              { id: 'BTN_CANCELAR', title: '❌ Cancelar' },
            ],
            'Cotización de Viaje'
          );
        }
      }

      case 'CONFIRMANDO_AUDIO_DESTINO': {
        const esAfirmativo =
          actionId === 'BTN_CONFIRMAR_AUDIO_DESTINO' ||
          textoLower === 'si' ||
          textoLower === 'sí' ||
          textoLower.includes('correcto') ||
          textoLower.includes('correcta');

        const esNegativo =
          actionId === 'BTN_REINTENTAR_AUDIO_DESTINO' ||
          textoLower === 'no' ||
          textoLower.includes('corregir') ||
          textoLower.includes('cambiar');

        if (esAfirmativo) {
          const dirD = transcriptionService.extraerDireccion(sesion.audioDireccionPendiente || 'Destino confirmado por audio');
          const geoD = await geocodificarDireccion(dirD);
          if (!geoD) {
            sesion.estado = 'ESPERANDO_DESTINO';
            return await whatsappService.enviarTexto(
              cleanFrom,
              `⚠️ No pudimos encontrar el destino *"${dirD}"* en el mapa de Chivilcoy.\n\nPor favor escribí la calle y altura (ej: *Av. Sarmiento 500*), punto de referencia o mandá un nuevo audio:`
            );
          }
          sesion.destino = geoD.nombreOficial || dirD;
          sesion.destinoLat = geoD.lat;
          sesion.destinoLon = geoD.lon;

          if ((!sesion.origenLat || !sesion.origenLon) && sesion.origen) {
            const geoO = await geocodificarDireccion(sesion.origen);
            if (geoO) {
              sesion.origenLat = geoO.lat;
              sesion.origenLon = geoO.lon;
              if (geoO.nombreOficial) {
                sesion.origen = geoO.nombreOficial;
              }
            }
          }

          let dist = 2.5;
          if (sesion.origenLat && sesion.origenLon && sesion.destinoLat && sesion.destinoLon) {
            dist = await calcularDistanciaReal(
              sesion.origenLat,
              sesion.origenLon,
              sesion.destinoLat,
              sesion.destinoLon
            );
            if (dist < 0.5) dist = 0.8;
          }

          const kmAdicionales = Math.max(0, dist - 1);
          const precioGpsPuro = bajadaBandera + kmAdicionales * valorKm;
          const precioEstimado = Math.round(precioGpsPuro / 100) * 100;

          sesion.distanciaKm = dist;
          sesion.precioEstimado = precioEstimado;
          sesion.estado = 'CONFIRMANDO_COTIZACION';

          if (sesion.esReserva && sesion.fechaHoraTexto) {
            const resumenReserva =
              `📋 *Resumen de tu Reserva Programada:*\n` +
              `━━━━━━━━━━━━━━━━━━━\n` +
              `🗓️ *Fecha y Hora:* *${sesion.fechaHoraTexto}*\n` +
              `🟢 *Origen:* ${sesion.origen}\n` +
              `🔴 *Destino:* ${sesion.destino}\n` +
              `📏 *Distancia:* ~${dist} km\n` +
              `💵 *Precio estimado:* *$${precioEstimado.toLocaleString('es-AR')}* _(Efectivo)_\n` +
              `━━━━━━━━━━━━━━━━━━━\n` +
              `¿Confirmás la reserva?`;

            return await whatsappService.enviarBotones(
              cleanFrom,
              resumenReserva,
              [
                { id: 'BTN_CONFIRMAR_RESERVA', title: '✅ Confirmar Reserva' },
                { id: 'BTN_CANCELAR', title: '❌ Cancelar' },
              ],
              'Reserva de Viaje'
            );
          } else {
            const resumen =
              `📋 *Resumen de tu viaje:*\n` +
              `━━━━━━━━━━━━━━━━━━━\n` +
              `🟢 *Origen:* ${sesion.origen}\n` +
              `🔴 *Destino:* ${sesion.destino}\n` +
              `📏 *Distancia:* ~${dist} km\n` +
              `💵 *Precio estimado:* *$${precioEstimado.toLocaleString('es-AR')}* _(Efectivo)_\n` +
              `━━━━━━━━━━━━━━━━━━━\n` +
              `¿Deseas solicitar el móvil ahora?`;

            return await whatsappService.enviarBotones(
              cleanFrom,
              resumen,
              [
                { id: 'BTN_CONFIRMAR', title: '✅ Confirmar Pedido' },
                { id: 'BTN_CANCELAR', title: '❌ Cancelar' },
              ],
              'Cotización de Viaje'
            );
          }
        } else if (esNegativo) {
          sesion.estado = 'ESPERANDO_DESTINO';
          return await whatsappService.enviarTexto(
            cleanFrom,
            '✍️ Por favor escribí el destino por texto (ej: *Av. Sarmiento 500* o *Hospital Municipal*):'
          );
        } else if (texto && texto.trim().length >= 3) {
          // El usuario escribió directamente la corrección del destino
          const geoD = await geocodificarDireccion(texto.trim());
          if (!geoD) {
            return await whatsappService.enviarTexto(
              cleanFrom,
              `⚠️ No pudimos encontrar el destino *"${texto.trim()}"* en el mapa de Chivilcoy.\n\nPor favor verificá la dirección (ej: *Av. Sarmiento 500* o *Hospital Municipal*):`
            );
          }
          sesion.destino = geoD.nombreOficial || texto.trim();
          sesion.destinoLat = geoD.lat;
          sesion.destinoLon = geoD.lon;

          let dist = 2.5;
          if (sesion.origenLat && sesion.origenLon && sesion.destinoLat && sesion.destinoLon) {
            dist = await calcularDistanciaReal(
              sesion.origenLat,
              sesion.origenLon,
              sesion.destinoLat,
              sesion.destinoLon
            );
            if (dist < 0.5) dist = 0.8;
          }

          const kmAdicionales = Math.max(0, dist - 1);
          const precioGpsPuro = bajadaBandera + kmAdicionales * valorKm;
          const precioEstimado = Math.round(precioGpsPuro / 100) * 100;

          sesion.distanciaKm = dist;
          sesion.precioEstimado = precioEstimado;
          sesion.estado = 'CONFIRMANDO_COTIZACION';

          const resumen =
            `📋 *Resumen de tu viaje:*\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `🟢 *Origen:* ${sesion.origen}\n` +
            `🔴 *Destino:* ${sesion.destino}\n` +
            `📏 *Distancia:* ~${dist} km\n` +
            `💵 *Precio estimado:* *$${precioEstimado.toLocaleString('es-AR')}* _(Efectivo)_\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `¿Deseas solicitar el móvil ahora?`;

          return await whatsappService.enviarBotones(
            cleanFrom,
            resumen,
            [
              { id: 'BTN_CONFIRMAR', title: '✅ Confirmar Pedido' },
              { id: 'BTN_CANCELAR', title: '❌ Cancelar' },
            ],
            'Cotización de Viaje'
          );
        } else {
          return await whatsappService.enviarBotones(
            cleanFrom,
            `Entendimos que tu destino es: *${sesion.audioDireccionPendiente}*\n\n¿Es correcto?`,
            [
              { id: 'BTN_CONFIRMAR_AUDIO_DESTINO', title: '✅ Sí, es correcto' },
              { id: 'BTN_REINTENTAR_AUDIO_DESTINO', title: '✍️ No, escribirlo' },
            ]
          );
        }
      }

      case 'CONFIRMANDO_COTIZACION': {
        const esAfirmativo =
          actionId === 'BTN_CONFIRMAR' ||
          actionId === 'BTN_CONFIRMAR_RESERVA' ||
          textoLower.includes('si') ||
          textoLower.includes('confirmar') ||
          textoLower.includes('confirmo');

        if (esAfirmativo) {
          if (sesion.esReserva) {
            return await this.crearReservaDesdeWhatsApp(cleanFrom, sesion, cliente, remiseriaId);
          } else {
            return await this.crearViajeDesdeWhatsApp(cleanFrom, sesion, cliente, remiseriaId);
          }
        } else {
          const botonConfirmarId = sesion.esReserva ? 'BTN_CONFIRMAR_RESERVA' : 'BTN_CONFIRMAR';
          return await whatsappService.enviarBotones(
            cleanFrom,
            '¿Querés confirmar el servicio o cancelarlo?',
            [
              { id: botonConfirmarId, title: '✅ Confirmar' },
              { id: 'BTN_CANCELAR', title: '❌ Cancelar' },
            ]
          );
        }
      }
    }
  },

  /**
   * Crea una Reserva programada en la base de datos de Remises Bruno
   */
  async crearReservaDesdeWhatsApp(
    cleanFrom: string,
    sesion: SesionClienteWhatsApp,
    clienteExistente: any,
    remiseriaId: string
  ) {
    try {
      const trackingToken = crypto.randomBytes(16).toString('hex');
      const codigoPin = Math.floor(1000 + Math.random() * 9000).toString();
      const origen = sesion.origen || 'Origen solicitado por WhatsApp';
      const destino = sesion.destino || 'Destino a convenir';
      const precio = sesion.precioEstimado || 3500;
      const clienteNombre = sesion.nombre || 'Pasajero WhatsApp';
      const fechaInicio = sesion.fechaHoraReserva || new Date();
      const horaInicio = sesion.horaInicioStr || '08:00';
      const fechaTexto = sesion.fechaHoraTexto || 'Fecha programada';

      const origenDetallado =
        sesion.origenLat && sesion.origenLon
          ? `${sesion.origenLat},${sesion.origenLon}`
          : undefined;
      const destinoDetallado =
        sesion.destinoLat && sesion.destinoLon
          ? `${sesion.destinoLat},${sesion.destinoLon}`
          : undefined;

      // 1. Guardar en la tabla Reserva (para que aparezca en el tab Reservados de la Central)
      const reserva = await prisma.reserva.create({
        data: {
          clienteNombre,
          clienteTelefono: cleanFrom,
          clienteEmail: clienteExistente?.email || null,
          origen,
          destino,
          fechaInicio,
          horaInicio,
          tipo: 'UNICA',
          estado: 'ACTIVA',
          observaciones: `Reserva programada por WhatsApp Bot para ${fechaTexto}. Est: $${precio.toLocaleString('es-AR')}`,
          remiseriaId,
          clienteId: clienteExistente?.id || null,
        },
      });

      // 2. Registrar también el Viaje programado con la fecha de la reserva
      const viaje = await prisma.viaje.create({
        data: {
          origen,
          destino,
          precio,
          fecha: fechaInicio,
          estado: 'PENDIENTE',
          observaciones: `Viaje Reservado por WhatsApp para: ${fechaTexto} (Reserva #${reserva.id.slice(-4).toUpperCase()})`,
          clienteId: clienteExistente?.id || null,
          clienteNombre,
          clienteTelefono: cleanFrom,
          remiseriaId,
          origenDetallado,
          destinoDetallado,
          trackingToken,
          codigoPin,
          metodoPago: 'EFECTIVO',
        },
      });

      // Resetear estado de la sesión
      resetSesion(cleanFrom);

      // 3. Notificar en tiempo real por WebSocket a la central del Coordinador
      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        io.to(remiseriaId).emit('nueva_reserva_recibida', reserva);
        io.to(remiseriaId).emit('nuevo_viaje_recibido', viaje);
      } catch (sErr) {
        console.warn('Socket aviso WhatsApp nueva reserva:', sErr);
      }

      // 4. Confirmar al pasajero por WhatsApp
      const confirmacionTexto =
        `📅 *¡Reserva agendada con éxito!*\n\n` +
        `Tu viaje quedó registrado en nuestra central:\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🗓️ *Fecha y Hora:* *${fechaTexto}*\n` +
        `🟢 *Origen:* ${origen}\n` +
        `🔴 *Destino:* ${destino}\n` +
        `📏 *Distancia:* ~${sesion.distanciaKm || 2.5} km\n` +
        `💵 *Precio estimado:* *$${precio.toLocaleString('es-AR')}*\n` +
        `🔒 *PIN de seguridad:* *${codigoPin}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `La central asignará tu móvil con anticipación y te avisaremos por WhatsApp en cuanto el chofer salga a buscarte.`;

      await whatsappService.enviarBotones(cleanFrom, confirmacionTexto, [
        { id: 'BTN_ESTADO', title: '📍 Mis Reservas / Viajes' },
        { id: 'BTN_OPERADOR', title: '📞 Hablar con Central' },
      ]);

      return { success: true, reservaId: reserva.id, viajeId: viaje.id };
    } catch (err: any) {
      console.error('Error creando reserva desde WhatsApp:', err);
      resetSesion(cleanFrom);
      return await whatsappService.enviarTexto(
        cleanFrom,
        'Tuvimos un inconveniente al agendar tu reserva. Por favor comunicate con nuestros teléfonos fijos: 2346-427637 o 2346-433000.'
      );
    }
  },

  /**
   * Crea el Viaje inmediato en la base de datos de Remises Bruno y lo dispara a Central y Choferes
   */
  async crearViajeDesdeWhatsApp(
    cleanFrom: string,
    sesion: SesionClienteWhatsApp,
    clienteExistente: any,
    remiseriaId: string
  ) {
    try {
      const trackingToken = crypto.randomBytes(16).toString('hex');
      const codigoPin = Math.floor(1000 + Math.random() * 9000).toString();
      const origen = sesion.origen || 'Origen solicitado por WhatsApp';
      const destino = sesion.destino || 'Destino a convenir';
      const precio = sesion.precioEstimado || 3500;
      const clienteNombre = sesion.nombre || 'Pasajero WhatsApp';

      const origenDetallado =
        sesion.origenLat && sesion.origenLon
          ? `${sesion.origenLat},${sesion.origenLon}`
          : undefined;
      const destinoDetallado =
        sesion.destinoLat && sesion.destinoLon
          ? `${sesion.destinoLat},${sesion.destinoLon}`
          : undefined;

      const viaje = await prisma.viaje.create({
        data: {
          origen,
          destino,
          precio,
          fecha: new Date(),
          estado: 'PENDIENTE',
          observaciones: 'Pedido generado automáticamente por WhatsApp Bot',
          clienteId: clienteExistente?.id || null,
          clienteNombre,
          clienteTelefono: cleanFrom,
          remiseriaId,
          origenDetallado,
          destinoDetallado,
          trackingToken,
          codigoPin,
          metodoPago: 'EFECTIVO',
        },
        include: {
          cliente: true,
          chofer: true,
          vehiculo: true,
          remiseria: true,
        },
      });

      // Resetear estado de la sesión
      resetSesion(cleanFrom);

      // 1. Notificar en tiempo real por WebSocket a la central del Coordinador
      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        io.to(remiseriaId).emit('nuevo_viaje_recibido', viaje);
      } catch (sErr) {
        console.warn('Socket aviso WhatsApp nuevo viaje:', sErr);
      }

      // 2. Disparar notificación Push a los choferes conectados de la remisería
      try {
        pushNotificationService.enviarAChoferesDeRemiseria(remiseriaId, {
          title: '🚕 ¡Nuevo viaje por WhatsApp!',
          body: `${origen} ➔ ${destino} ($${precio.toLocaleString('es-AR')})`,
          url: '/chofer/app',
          tag: `whatsapp-viaje-${viaje.id}`,
          data: { viajeId: viaje.id },
        }).catch(() => {});
      } catch {}

      // 3. Confirmar al pasajero por WhatsApp
      const confirmacionTexto =
        `🚕 *¡Pedido confirmado!*\n\n` +
        `Tu solicitud ya ingresó a nuestra central con el viaje *#${viaje.id.slice(-4).toUpperCase()}*.\n` +
        `🔒 *PIN de inicio de viaje:* *${codigoPin}*\n\n` +
        `Estamos asignándote el mejor móvil disponible. Te avisaremos por acá en cuanto el chofer salga a buscarte.`;

      await whatsappService.enviarBotones(cleanFrom, confirmacionTexto, [
        { id: 'BTN_ESTADO', title: '📍 Estado del viaje' },
        { id: 'BTN_OPERADOR', title: '📞 Hablar con Central' },
      ]);

      return { success: true, viajeId: viaje.id };
    } catch (err: any) {
      console.error('Error creando viaje desde WhatsApp:', err);
      resetSesion(cleanFrom);
      return await whatsappService.enviarTexto(
        cleanFrom,
        'Tuvimos un inconveniente al registrar tu pedido. Por favor comunicate con nuestros teléfonos fijos: 2346-427637 o 2346-433000.'
      );
    }
  },

  /**
   * Consulta y responde el estado actual de los viajes o reservas del cliente
   */
  async consultarEstadoViaje(cleanFrom: string, clienteId?: string) {
    const [viaje, reservas] = await Promise.all([
      prisma.viaje.findFirst({
        where: {
          OR: [
            { clienteTelefono: cleanFrom },
            ...(clienteId ? [{ clienteId }] : []),
          ],
          estado: { in: ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] },
        },
        include: {
          chofer: true,
          vehiculo: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.reserva.findMany({
        where: {
          clienteTelefono: cleanFrom,
          estado: 'ACTIVA',
          fechaInicio: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        include: {
          chofer: true,
        },
        orderBy: { fechaInicio: 'asc' },
        take: 3,
      }),
    ]);

    if (!viaje && reservas.length === 0) {
      return await whatsappService.enviarBotones(
        cleanFrom,
        'No tenés ningún viaje activo ni reservas programadas en este momento.',
        [
          { id: 'BTN_PEDIR_AHORA', title: '🚕 Pedir Ahora' },
          { id: 'BTN_RESERVAR', title: '📅 Reservar Viaje' },
        ]
      );
    }

    let respuesta = '';

    // Si tiene un viaje activo en curso o por llegar
    if (viaje) {
      const choferNombre = viaje.chofer?.nombre || 'Chofer en asignación';
      const vehiculo = viaje.vehiculo;
      const vehiculoStr = vehiculo ? `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.patente})` : 'Móvil a confirmar';

      let estadoTexto = '';
      switch (viaje.estado) {
        case 'PENDIENTE':
          estadoTexto = '🟡 *Buscando móvil disponible...* Tu viaje ya está en pantalla central.';
          break;
        case 'ACEPTADO':
          estadoTexto = `🟢 *Chofer asignado:* ${choferNombre}\n🚗 *Vehículo:* ${vehiculoStr}\n_El chofer va en camino a buscarte._`;
          break;
        case 'EN_CAMINO':
          estadoTexto = `🔔 *¡Tu remis ya está esperando afuera!*\n🚗 *Vehículo:* ${vehiculoStr}\n_Ya podés salir a subirte._`;
          break;
        case 'EN_CURSO':
          estadoTexto = `🚕 *Viaje en curso* hacia ${viaje.destino}.`;
          break;
      }

      respuesta +=
        `📋 *Estado de tu Viaje #${viaje.id.slice(-4).toUpperCase()}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `${estadoTexto}\n` +
        `🟢 *Origen:* ${viaje.origen}\n` +
        `🔴 *Destino:* ${viaje.destino}\n` +
        `🔒 *PIN de seguridad:* *${viaje.codigoPin || 'Sin PIN'}*\n` +
        `━━━━━━━━━━━━━━━━━━━`;
    }

    // Si tiene reservas activas
    if (reservas.length > 0) {
      if (respuesta.length > 0) respuesta += '\n\n';
      respuesta += `📅 *Tus Reservas Programadas:*\n━━━━━━━━━━━━━━━━━━━\n`;
      respuesta += reservas
        .map((r) => {
          const { fechaTexto } = formatearFechaLegible(r.fechaInicio);
          const choferStr = r.chofer
            ? `🚗 Móvil asignado: *${r.chofer.nombre}*`
            : `🟡 Agendada en central (se asignará previo al viaje)`;
          return (
            `🗓️ *${fechaTexto}*\n` +
            `🟢 *Origen:* ${r.origen}\n` +
            `🔴 *Destino:* ${r.destino}\n` +
            `${choferStr}`
          );
        })
        .join('\n───────────────────\n');
    }

    return await whatsappService.enviarTexto(cleanFrom, respuesta);
  },

  /**
   * Notifica por WhatsApp al pasajero cuando el chofer avisa que está llegando o afuera
   */
  async notificarCambioEstadoPasajero(viaje: any, nuevoEstado: string, mensajeExtra?: string) {
    const telefono = viaje.clienteTelefono || viaje.cliente?.telefono;
    if (!telefono) return;

    const choferNombre = viaje.chofer?.nombre || 'Tu chofer';
    const vehiculo = viaje.vehiculo;
    const autoStr = vehiculo ? ` (${vehiculo.marca} ${vehiculo.modelo} - ${vehiculo.patente})` : '';

    if (nuevoEstado === 'EN_CAMINO') {
      const msg = `🔔 *¡Tu remis está esperando afuera!*\n${choferNombre} ya está en tu puerta${autoStr}.\n¡Ya podés salir a subirte!`;
      await whatsappService.enviarTexto(telefono, msg).catch(() => {});
    } else if (nuevoEstado === 'ACEPTADO') {
      const msg = `🚗 *¡Chofer en camino!*\n${choferNombre} aceptó tu viaje${autoStr} y va en camino a buscarte.`;
      await whatsappService.enviarTexto(telefono, msg).catch(() => {});
    } else if (nuevoEstado === 'LLEGANDO') {
      const msg = `📍 *¡Tu remis está a 2 cuadras!*\n${choferNombre}${autoStr} está llegando. ¡Podés ir preparándote!`;
      await whatsappService.enviarTexto(telefono, msg).catch(() => {});
    }
  },
};
