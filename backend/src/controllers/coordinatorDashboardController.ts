import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';
import bcrypt from 'bcryptjs';
import { batchDispatchService } from '../services/batchDispatchService';

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return R * c;
}

const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas en memoria
const geocodeSearchCache = new Map<string, { data: any[]; expiresAt: number }>();
const geocodeInFlightMap = new Map<string, Promise<any[]>>();
const osrmDistanceCache = new Map<string, { distanceKm: number; expiresAt: number }>();

async function searchNominatimCached(rawQuery: string, limit = 5): Promise<any[]> {
  const queryString = (rawQuery || '').trim();
  if (!queryString || queryString.length < 3) return [];

  const cacheKey = `${limit}:${queryString.toLowerCase()}`;
  const ahora = Date.now();
  const cached = geocodeSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > ahora) {
    return cached.data;
  }

  // Deduplicar peticiones simultáneas idénticas en hora pico
  const inFlight = geocodeInFlightMap.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const fetchPromise = (async () => {
    try {
      const hasCityConstraint =
        /,/g.test(queryString) ||
        /chivilcoy|buenos\s+aires|caba|federal|ezeiza|retiro|lujan|mercedes/i.test(queryString);
      const viewboxParam = 'viewbox=-60.15,-34.83,-59.88,-34.96';
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString)}&countrycodes=ar&limit=${limit}&addressdetails=1&${viewboxParam}&bounded=0`;
      if (!hasCityConstraint) {
        url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString + ', Chivilcoy')}&countrycodes=ar&limit=${limit}&addressdetails=1&${viewboxParam}&bounded=0`;
      }

      const response = await fetch(url, {
        headers: { 'User-Agent': 'AppRemises/1.0 (coordinacion@remises.com)' },
        signal: AbortSignal.timeout(3500),
      });
      let data = (await response.json()) as any[];

      if (!hasCityConstraint && (!Array.isArray(data) || data.length === 0)) {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString)}&countrycodes=ar&limit=${limit}&addressdetails=1&${viewboxParam}&bounded=0`;
        const fallbackResponse = await fetch(fallbackUrl, {
          headers: { 'User-Agent': 'AppRemises/1.0 (coordinacion@remises.com)' },
          signal: AbortSignal.timeout(3500),
        });
        data = (await fallbackResponse.json()) as any[];
      }

      const finalData = Array.isArray(data) ? data : [];
      if (geocodeSearchCache.size >= 1500) {
        const oldestKey = geocodeSearchCache.keys().next().value;
        if (oldestKey) geocodeSearchCache.delete(oldestKey);
      }
      geocodeSearchCache.set(cacheKey, {
        data: finalData,
        expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS,
      });
      return finalData;
    } finally {
      geocodeInFlightMap.delete(cacheKey);
    }
  })();

  geocodeInFlightMap.set(cacheKey, fetchPromise);
  return fetchPromise;
}

async function geocodeAddressInternal(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const data = await searchNominatimCached(query, 1);
    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (e) {
    return null;
  }
}

export const coordinatorDashboardController = {
  // Obtener viajes en curso (incluye asignados/en camino/en curso)
  async getViajesEnCurso(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Obtener la remisería del coordinador
      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const viajes = await prisma.viaje.findMany({
        where: {
          remiseriaId: coordinador.remiseriaId,
          estado: {
            in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO']
          }
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
              vehiculo: {
                select: {
                  id: true,
                  patente: true,
                  marca: true,
                  modelo: true
                }
              }
            }
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true
            }
          }
        },
        orderBy: {
          fecha: 'desc'
        }
      });

      res.json({
        success: true,
        data: viajes
      });
    } catch (error) {
      console.error('Error getting viajes en curso:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener viajes finalizados y anulados (historial)
  async getViajesHistorial(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      let remiseriaId: string | null = null;
      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });
      if (coordinador) {
        remiseriaId = coordinador.remiseriaId;
      } else if ((req.user as any)?.remiseriaId) {
        remiseriaId = (req.user as any).remiseriaId;
      }

      if (!remiseriaId) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador o remisería no encontrada'
        });
      }

      const { estado, fechaDesde, fechaHasta, limit } = req.query;

      const whereClause: any = {
        remiseriaId,
        estado: {
          in: ['COMPLETADO', 'CANCELADO']
        }
      };

      if (estado && typeof estado === 'string' && ['COMPLETADO', 'CANCELADO'].includes(estado.toUpperCase())) {
        whereClause.estado = estado.toUpperCase();
      }

      if (fechaDesde || fechaHasta) {
        whereClause.fecha = {};
        if (fechaDesde && typeof fechaDesde === 'string') {
          whereClause.fecha.gte = new Date(fechaDesde);
        }
        if (fechaHasta && typeof fechaHasta === 'string') {
          const hasta = new Date(fechaHasta);
          if (fechaHasta.length === 10) {
            hasta.setHours(23, 59, 59, 999);
          }
          whereClause.fecha.lte = hasta;
        }
      }

      const take = limit ? Math.min(Number(limit), 1000) : 300;

      const viajes = await prisma.viaje.findMany({
        where: whereClause,
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
              vehiculo: {
                select: {
                  id: true,
                  patente: true,
                  marca: true,
                  modelo: true
                }
              }
            }
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true
            }
          }
        },
        orderBy: {
          fecha: 'desc'
        },
        take
      });

      res.json({
        success: true,
        data: viajes
      });
    } catch (error) {
      console.error('Error getting viajes historial:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener viajes sin asignar
  async getViajesSinAsignar(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const viajes = await prisma.viaje.findMany({
        where: {
          estado: 'PENDIENTE',
          OR: [
            { remiseriaId: coordinador.remiseriaId },
            { clienteId: { not: null } }
          ]
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
              vehiculo: true
            }
          },
          vehiculo: true
        },
        orderBy: {
          fecha: 'asc'
        }
      });

      res.json({
        success: true,
        data: viajes
      });
    } catch (error) {
      console.error('Error getting viajes sin asignar:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Asignar chofer y vehículo a un viaje pendiente
  async asignarViaje(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      const { id } = req.params;
      const { choferId, vehiculoId } = req.body;

      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!choferId) {
        return res.status(400).json({
          success: false,
          message: 'Debe seleccionar un chofer para asignar el viaje'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const viaje = await prisma.viaje.findUnique({
        where: { id },
        include: { cliente: true }
      });

      if (!viaje) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado'
        });
      }

      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
        include: { vehiculo: true }
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado'
        });
      }

      const finalVehiculoId = vehiculoId || chofer.vehiculoId || null;

      // Si el chofer no tenía ese vehículo asociado y se eligió uno, opcionalmente lo vinculamos al viaje
      const updatedViaje = await prisma.viaje.update({
        where: { id },
        data: {
          choferId: chofer.id,
          vehiculoId: finalVehiculoId,
          remiseriaId: coordinador.remiseriaId,
          estado: 'ACEPTADO',
          clienteNombre: viaje.clienteNombre || (viaje.cliente ? `${viaje.cliente.nombre} ${viaje.cliente.apellido}` : undefined),
          clienteTelefono: viaje.clienteTelefono || viaje.cliente?.telefono || undefined,
          clienteEmail: viaje.clienteEmail || viaje.cliente?.email || undefined
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
              vehiculo: {
                select: {
                  id: true,
                  patente: true,
                  marca: true,
                  modelo: true
                }
              }
            }
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true
            }
          }
        }
      });

      await prisma.appUsage.create({
        data: {
          userId: coordinadorId,
          userEmail: coordinador.email,
          action: 'ASSIGN_VIAJE',
          details: JSON.stringify({
            viajeId: updatedViaje.id,
            choferId: chofer.id,
            vehiculoId: finalVehiculoId
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });

      // Al asignarle viaje desde la central, sacarlo de la Tabla de espera
      if (chofer.enParadaVirtual) {
        await prisma.chofer.update({
          where: { id: chofer.id },
          data: { enParadaVirtual: false, paradaVirtualIngreso: null }
        });
      }

      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        if (io) {
          io.to(coordinador.remiseriaId).emit('viaje_asignado_directo', {
            choferId: chofer.id,
            viaje: updatedViaje
          });
          io.to(coordinador.remiseriaId).emit('viaje_estado_actualizado', {
            viajeId: updatedViaje.id,
            estado: 'ACEPTADO',
            viaje: updatedViaje
          });
        }
      } catch (sErr) {
        console.warn('Socket asignarViaje warning:', sErr);
      }

      res.json({
        success: true,
        data: updatedViaje,
        message: 'Auto y chofer asignados exitosamente'
      });
    } catch (error) {
      console.error('Error asignando viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al asignar el viaje'
      });
    }
  },

  // Actualizar estado de un viaje (EN_CAMINO, EN_CURSO, COMPLETADO, CANCELADO)
  async actualizarEstadoViaje(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      const { id } = req.params;
      const { estado } = req.body;

      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const estadosValidos = ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO'];
      if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado de viaje inválido'
        });
      }

      const updatedViaje = await prisma.viaje.update({
        where: { id },
        data: { estado },
        include: {
          cliente: true,
          chofer: true,
          vehiculo: true
        }
      });

      res.json({
        success: true,
        data: updatedViaje,
        message: `Estado del viaje actualizado a ${estado}`
      });
    } catch (error) {
      console.error('Error actualizando estado de viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener viajes reservados
  async getViajesReservados(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const reservas = await prisma.reserva.findMany({
        where: {
          remiseriaId: coordinador.remiseriaId,
          estado: 'ACTIVA'
        },
        include: {
          chofer: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true
            }
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true
            }
          }
        },
        orderBy: {
          fechaInicio: 'asc'
        }
      });

      res.json({
        success: true,
        data: reservas
      });
    } catch (error) {
      console.error('Error getting reservas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Crear nuevo viaje
  async createViaje(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      const {
        origen,
        destino,
        precio,
        fecha,
        clienteNombre,
        clienteTelefono,
        clienteEmail,
        clienteId,
        prioridad,
        origenDetallado,
        destinoDetallado,
        observaciones,
        choferId,
        vehiculoId
      } = req.body;

      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const viaje = await prisma.viaje.create({
        data: {
          origen,
          destino,
          precio: parseFloat(precio),
          fecha: new Date(fecha),
          clienteNombre,
          clienteTelefono,
          clienteEmail,
          clienteId: clienteId || null,
          prioridad: prioridad || 'NORMAL',
          origenDetallado,
          destinoDetallado,
          observaciones,
          choferId: choferId || null,
          vehiculoId: vehiculoId || null,
          remiseriaId: coordinador.remiseriaId,
          estado: choferId ? 'ACEPTADO' : 'PENDIENTE'
        }
      });

      // Track the action
      await prisma.appUsage.create({
        data: {
          userId: coordinadorId,
          userEmail: coordinador.email,
          action: 'CREATE_VIAJE',
          details: JSON.stringify({ viajeId: viaje.id }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });

      res.status(201).json({
        success: true,
        data: viaje,
        message: 'Viaje creado exitosamente'
      });
    } catch (error) {
      console.error('Error creating viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Registrar cliente rápido (al vuelo)
  async createCliente(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const {
        nombre,
        apellido,
        dni,
        telefono,
        email,
        direccion
      } = req.body;

      if (!nombre || !apellido || !dni || !telefono || !direccion) {
        return res.status(400).json({
          success: false,
          message: 'Campos requeridos faltantes (nombre, apellido, dni, telefono, direccion)'
        });
      }

      // Verificar si ya existe un cliente con ese DNI
      const existingCliente = await prisma.cliente.findUnique({
        where: { dni }
      });

      if (existingCliente) {
        return res.status(400).json({
          success: false,
          message: 'El DNI ya está registrado en el sistema'
        });
      }

      // Generar email único si no se provee o verificar el existente
      let finalEmail = email;
      if (!finalEmail) {
        finalEmail = `${dni}@appremises.com`;
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: finalEmail }
      });

      if (existingUser) {
        finalEmail = `${dni}-${Date.now()}@appremises.com`;
      }

      // Password por defecto
      const passwordHash = await bcrypt.hash('RemisDefault123!', 10);

      // Crear el registro de User
      const user = await prisma.user.create({
        data: {
          email: finalEmail,
          passwordHash,
          rol: 'CLIENTE',
          activo: true
        }
      });

      // Crear el registro de Cliente
      const cliente = await prisma.cliente.create({
        data: {
          nombre,
          apellido,
          dni,
          telefono,
          email: finalEmail,
          direccion,
          fechaNacimiento: new Date('1990-01-01'), // Fecha por defecto
          activo: true,
          userId: user.id
        }
      });

      res.status(201).json({
        success: true,
        data: cliente,
        message: 'Cliente registrado exitosamente'
      });
    } catch (error) {
      console.error('Error creating cliente:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Calcular precio estimado basado en origen, destino y tarifas de la remisería
  async calcularPrecio(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      const { origen, destino, latOrigen, lonOrigen, latDestino, lonDestino } = req.body;

      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!origen || !destino) {
        return res.status(400).json({
          success: false,
          message: 'Origen y destino son requeridos'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const rawValorKm = coordinador.remiseria?.valorKm;
      const rawBajadaBandera = coordinador.remiseria?.bajadaBandera;
      const valorKm = rawValorKm && rawValorKm > 0 ? rawValorKm : 1200;
      const bajadaBandera = rawBajadaBandera && rawBajadaBandera > 0 ? rawBajadaBandera : 3500;

      let distanciaKm = 0;
      let calculatedViaRoute = false;

      let finalLatOrigen = latOrigen ? parseFloat(latOrigen.toString()) : undefined;
      let finalLonOrigen = lonOrigen ? parseFloat(lonOrigen.toString()) : undefined;
      let finalLatDestino = latDestino ? parseFloat(latDestino.toString()) : undefined;
      let finalLonDestino = lonDestino ? parseFloat(lonDestino.toString()) : undefined;

      // Si faltan coordenadas pero tenemos los textos de las direcciones, geocodificamos automáticamente
      if ((!finalLatOrigen || !finalLonOrigen) && origen) {
        const geoO = await geocodeAddressInternal(origen);
        if (geoO) {
          finalLatOrigen = geoO.lat;
          finalLonOrigen = geoO.lon;
        }
      }

      if ((!finalLatDestino || !finalLonDestino) && destino && destino.toLowerCase() !== 'a convenir') {
        const geoD = await geocodeAddressInternal(destino);
        if (geoD) {
          finalLatDestino = geoD.lat;
          finalLonDestino = geoD.lon;
        }
      }

      // Si tenemos las coordenadas de origen y destino, calculamos por OSRM (con caché en memoria) o Haversine
      if (finalLatOrigen && finalLonOrigen && finalLatDestino && finalLonDestino) {
        const routeKey = `${finalLatOrigen.toFixed(4)},${finalLonOrigen.toFixed(4)}->${finalLatDestino.toFixed(4)},${finalLonDestino.toFixed(4)}`;
        const cachedRoute = osrmDistanceCache.get(routeKey);
        if (cachedRoute && cachedRoute.expiresAt > Date.now()) {
          distanciaKm = cachedRoute.distanceKm;
          calculatedViaRoute = true;
        } else {
          try {
            const url = `http://router.project-osrm.org/route/v1/driving/${finalLonOrigen},${finalLatOrigen};${finalLonDestino},${finalLatDestino}?overview=false`;
            const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
            const data = (await response.json()) as any;
            if (data.routes && data.routes.length > 0) {
              distanciaKm = data.routes[0].distance / 1000;
              distanciaKm = Math.round(distanciaKm * 10) / 10;
              calculatedViaRoute = true;
              if (osrmDistanceCache.size >= 1500) {
                const oldestKey = osrmDistanceCache.keys().next().value;
                if (oldestKey) osrmDistanceCache.delete(oldestKey);
              }
              osrmDistanceCache.set(routeKey, {
                distanceKm: distanciaKm,
                expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS,
              });
            }
          } catch (error) {
            console.warn('OSRM no respondió a tiempo, recurriendo a Haversine:', error);
          }
        }

        if (!calculatedViaRoute) {
          const distLineal = haversineDistanceKm(finalLatOrigen, finalLonOrigen, finalLatDestino, finalLonDestino);
          distanciaKm = Math.round(distLineal * 1.3 * 10) / 10;
          calculatedViaRoute = true;
        }
      }

      // Si el destino es "a convenir" o no se pudo geolocalizar, estimamos viaje urbano base
      if (!calculatedViaRoute) {
        if (!destino || destino.toLowerCase() === 'a convenir') {
          distanciaKm = 1.0;
        } else {
          distanciaKm = 2.5; // Distancia urbana estándar promedio
        }
      }

      // Fórmula solicitada por el usuario:
      // Bajada de bandera incluye de 0 a 1 KM. 
      // Por cada KM restante se le suma valorKm.
      let precioEstimado = bajadaBandera;
      if (distanciaKm > 1) {
        precioEstimado += (distanciaKm - 1) * valorKm;
      }
      // Redondear a múltiplos de 50 para cobro exacto y ágil
      precioEstimado = Math.round(precioEstimado / 50) * 50;

      res.json({
        success: true,
        data: {
          origen,
          destino,
          distanciaKm,
          precio: precioEstimado,
          precioEstimado,
          precioSugerido: precioEstimado,
          bajadaBandera,
          valorKm,
          calculatedViaRoute,
          coords: {
            origen: finalLatOrigen && finalLonOrigen ? { lat: finalLatOrigen, lon: finalLonOrigen } : null,
            destino: finalLatDestino && finalLonDestino ? { lat: finalLatDestino, lon: finalLonDestino } : null
          }
        }
      });
    } catch (error) {
      console.error('Error al calcular precio estimado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Geocodificación de direcciones usando OpenStreetMap Nominatim (con caché en memoria y deduplicación para hora pico)
  async geocode(req: Request, res: Response) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Query es requerido'
        });
      }

      const data = await searchNominatimCached(q as string, 5);

      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error en geocodificación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al buscar direcciones en el mapa'
      });
    }
  },

  // Crear nueva reserva
  async createReserva(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      const {
        clienteNombre,
        clienteTelefono,
        clienteEmail,
        origen,
        destino,
        fechaInicio,
        fechaFin,
        horaInicio,
        horaFin,
        diasSemana,
        tipo,
        observaciones
      } = req.body;

      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const reserva = await prisma.reserva.create({
        data: {
          clienteNombre,
          clienteTelefono,
          clienteEmail,
          origen,
          destino,
          fechaInicio: new Date(fechaInicio),
          fechaFin: fechaFin ? new Date(fechaFin) : null,
          horaInicio,
          horaFin,
          diasSemana: diasSemana ? JSON.stringify(diasSemana) : null,
          tipo: tipo || 'UNICA',
          observaciones,
          remiseriaId: coordinador.remiseriaId,
          estado: 'ACTIVA'
        }
      });

      // Track the action
      await prisma.appUsage.create({
        data: {
          userId: coordinadorId,
          userEmail: coordinador.email,
          action: 'CREATE_RESERVA',
          details: JSON.stringify({ reservaId: reserva.id }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });

      res.status(201).json({
        success: true,
        data: reserva,
        message: 'Reserva creada exitosamente'
      });
    } catch (error) {
      console.error('Error creating reserva:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener vehículos en tiempo real
  async getVehiculosTiempoReal(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const vehiculos = await prisma.vehiculo.findMany({
        where: {
          remiseriaId: coordinador.remiseriaId,
          estado: 'ACTIVO'
        },
        include: {
          choferes: {
            where: { estado: 'ACTIVO' },
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              isOnline: true
            }
          }
        }
      });

      // También traer choferes activos que están online y no tienen vehículo asignado
      const choferesSinVehiculo = await prisma.chofer.findMany({
        where: {
          remiseriaId: coordinador.remiseriaId,
          estado: 'ACTIVO',
          isOnline: true,
          vehiculoId: null
        }
      });

      const viajesActivosFlota = await prisma.viaje.findMany({
        where: {
          remiseriaId: coordinador.remiseriaId,
          estado: { in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] }
        },
        select: { choferId: true, vehiculoId: true }
      });
      const choferesEnViajeSet = new Set(viajesActivosFlota.map(v => v.choferId).filter(Boolean));
      const vehiculosEnViajeSet = new Set(viajesActivosFlota.map(v => v.vehiculoId).filter(Boolean));

      const vehiculosConEstado = vehiculos.map(v => {
        const choferAsig = v.choferes && v.choferes[0];
        const estaEnViaje = vehiculosEnViajeSet.has(v.id) || (choferAsig && choferesEnViajeSet.has(choferAsig.id));
        return {
          ...v,
          enViaje: Boolean(estaEnViaje),
          estadoOperativo: estaEnViaje ? 'en_viaje' : (choferAsig?.isOnline ? 'disponible' : 'fuera_servicio')
        };
      });

      const choferesMapeados = choferesSinVehiculo.map(c => {
        const estaEnViaje = choferesEnViajeSet.has(c.id);
        return {
          id: c.id,
          patente: 'Auto Propio',
          marca: 'Chofer',
          modelo: 'Móvil',
          anio: 2024,
          color: 'Azul',
          tipo: 'Auto',
          capacidad: 4,
          estado: 'ACTIVO' as const,
          enViaje: Boolean(estaEnViaje),
          estadoOperativo: estaEnViaje ? 'en_viaje' : 'disponible',
          propietario: `${c.nombre} ${c.apellido}`,
          latitud: null,
          longitud: null,
          ultimaUbicacion: null,
          remiseriaId: coordinador.remiseriaId,
          observaciones: estaEnViaje ? 'En viaje activo' : 'Chofer conectado',
          choferes: [{
            id: c.id,
            nombre: c.nombre,
            apellido: c.apellido,
            telefono: c.telefono,
            isOnline: c.isOnline
          }]
        };
      });

      res.json({
        success: true,
        data: [...vehiculosConEstado, ...choferesMapeados],
        remiseria: coordinador.remiseria ? {
          id: coordinador.remiseria.id,
          nombreFantasia: coordinador.remiseria.nombreFantasia,
          razonSocial: coordinador.remiseria.razonSocial,
          cuit: coordinador.remiseria.cuit,
          direccion: coordinador.remiseria.direccion,
          telefono: coordinador.remiseria.telefono,
          latitud: coordinador.remiseria.latitud,
          longitud: coordinador.remiseria.longitud,
        } : null
      });
    } catch (error) {
      console.error('Error getting vehiculos tiempo real:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener los datos y ubicación de la remisería del coordinador
  async getMiRemiseria(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador || !coordinador.remiseria) {
        return res.status(404).json({
          success: false,
          message: 'Remisería no encontrada para este coordinador'
        });
      }

      res.json({
        success: true,
        data: coordinador.remiseria
      });
    } catch (error) {
      console.error('Error getting mi remiseria:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener choferes en tiempo real
  async getChoferesTiempoReal(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const [choferes, viajesEnCurso] = await Promise.all([
        prisma.chofer.findMany({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'ACTIVO',
            isOnline: true
          },
          include: {
            vehiculo: {
              select: {
                id: true,
                patente: true,
                marca: true,
                modelo: true
              }
            }
          },
          orderBy: [
            { paradaVirtualIngreso: 'asc' },
            { updatedAt: 'asc' }
          ]
        }),
        prisma.viaje.findMany({
          where: {
            remiseriaId: coordinador.remiseriaId,
            choferId: { not: null },
            estado: { in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] }
          },
          select: { choferId: true }
        })
      ]);

      const choferesOcupadosSet = new Set(viajesEnCurso.map(v => v.choferId));
      const choferesEnriquecidos = choferes.map(c => {
        const tieneViaje = choferesOcupadosSet.has(c.id);
        let enPausa = false;
        try {
          if (c.observaciones && c.observaciones.startsWith('{')) {
            enPausa = Boolean(JSON.parse(c.observaciones).enPausa);
          }
        } catch {}
        return {
          ...c,
          estado: tieneViaje ? 'en_viaje' : (enPausa ? 'en_pausa' : 'disponible'),
          enParadaVirtual: tieneViaje ? false : c.enParadaVirtual
        };
      });

      res.json({
        success: true,
        data: choferesEnriquecidos
      });
    } catch (error) {
      console.error('Error getting choferes tiempo real:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener estadísticas del dashboard
  async getDashboardStats(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const [
        viajesEnCurso,
        viajesSinAsignar,
        reservasActivas,
        totalVehiculos,
        totalChoferes,
        viajesFinalizados,
        viajesCancelados
      ] = await Promise.all([
        prisma.viaje.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: {
              in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO']
            }
          }
        }),
        prisma.viaje.count({
          where: {
            estado: 'PENDIENTE',
            OR: [
              { remiseriaId: coordinador.remiseriaId },
              { clienteId: { not: null } }
            ]
          }
        }),
        prisma.reserva.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'ACTIVA'
          }
        }),
        prisma.vehiculo.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'ACTIVO'
          }
        }),
        prisma.chofer.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'ACTIVO'
          }
        }),
        prisma.viaje.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'COMPLETADO'
          }
        }),
        prisma.viaje.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'CANCELADO'
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          viajesEnCurso,
          viajesSinAsignar,
          reservasActivas,
          totalVehiculos,
          totalChoferes,
          viajesFinalizados,
          viajesCancelados,
          viajesHistorial: viajesFinalizados + viajesCancelados
        }
      });
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener propuesta de despacho óptimo (Batch Matching)
  async getDespachoOptimo(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const optimizacion = await batchDispatchService.calcularLoteOptimo(coordinador.remiseriaId);
      res.json(optimizacion);
    } catch (error) {
      console.error('Error al calcular lote óptimo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al calcular lote de despacho óptimo'
      });
    }
  },

  // Aplicar las asignaciones de un lote óptimo
  async aplicarDespachoOptimo(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      if (!coordinadorId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId }
      });

      if (!coordinador) {
        return res.status(404).json({
          success: false,
          message: 'Coordinador no encontrado'
        });
      }

      const { matches } = req.body;
      if (!matches || !Array.isArray(matches) || matches.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe enviar un arreglo de asignaciones (matches) a aplicar'
        });
      }

      const resultado = await batchDispatchService.aplicarLote(
        coordinador.remiseriaId,
        matches,
        coordinadorId
      );

      res.json(resultado);
    } catch (error: any) {
      console.error('Error al aplicar lote óptimo:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al aplicar asignaciones en lote'
      });
    }
  },

  // 1. Búsqueda predictiva de pasajeros habituales por teléfono o nombre
  async searchClientesPredictivo(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      const { q } = req.query;

      if (!coordinadorId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json({ success: true, data: [] });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId }
      });

      if (!coordinador) {
        return res.status(404).json({ success: false, message: 'Coordinador no encontrado' });
      }

      const searchTerm = q.trim();

      const clientes = await prisma.cliente.findMany({
        where: {
          OR: [
            { telefono: { contains: searchTerm, mode: 'insensitive' } },
            { nombre: { contains: searchTerm, mode: 'insensitive' } },
            { apellido: { contains: searchTerm, mode: 'insensitive' } },
            { dni: { contains: searchTerm } }
          ]
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          telefono: true,
          email: true,
          direccion: true,
          observaciones: true,
          direccionesFrecuentes: true
        },
        take: 6
      });

      const clientesConHistorial = await Promise.all(
        clientes.map(async (c) => {
          const ultimosViajes = await prisma.viaje.findMany({
            where: {
              OR: [
                { clienteId: c.id },
                { clienteTelefono: c.telefono }
              ]
            },
            orderBy: { fecha: 'desc' },
            take: 3,
            select: {
              origen: true,
              destino: true,
              precio: true,
              fecha: true
            }
          });

          const origenesHabituales = Array.from(new Set([
            ...(c.direccion ? [c.direccion] : []),
            ...ultimosViajes.map((v) => v.origen).filter(Boolean)
          ]));
          const destinosHabituales = Array.from(new Set(
            ultimosViajes.map((v) => v.destino).filter(Boolean)
          ));

          return {
            ...c,
            nombreCompleto: `${c.nombre} ${c.apellido}`.trim(),
            origenesHabituales,
            destinosHabituales,
            ultimoViaje: ultimosViajes[0] || null
          };
        })
      );

      res.json({
        success: true,
        data: clientesConHistorial
      });
    } catch (error) {
      console.error('Error buscando clientes predictivo:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // 2. Carga ultrarrápida de viaje express telefónico (< 5s)
  async crearViajeExpress(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      if (!coordinadorId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({ success: false, message: 'Coordinador no encontrado' });
      }

      const {
        telefono,
        nombre,
        apellido,
        origen,
        destino,
        precio,
        choferId,
        vehiculoId,
        observaciones,
        prioridad,
        recargoTipo,
        recargoMonto
      } = req.body;

      if (!telefono || !origen) {
        return res.status(400).json({
          success: false,
          message: 'Teléfono y dirección de origen son obligatorios'
        });
      }

      let clienteId: string | null = null;
      const cleanPhone = telefono.trim();
      let cliente = await prisma.cliente.findFirst({
        where: { telefono: cleanPhone }
      });

      if (!cliente && nombre) {
        try {
          const dummyEmail = `cliente_${cleanPhone.replace(/\D/g, '') || Date.now()}@bruno.local`;
          const dummyDni = `TEL_${cleanPhone.replace(/\D/g, '').slice(-8) || Date.now()}`;
          const bcrypt = await import('bcryptjs');
          const hashedPassword = await bcrypt.default.hash('123456', 10);

          const nuevoUser = await prisma.user.create({
            data: {
              email: dummyEmail,
              passwordHash: hashedPassword,
              rol: 'CLIENTE'
            }
          });

          cliente = await prisma.cliente.create({
            data: {
              userId: nuevoUser.id,
              nombre: nombre.trim(),
              apellido: (apellido || '').trim(),
              dni: dummyDni,
              telefono: cleanPhone,
              email: dummyEmail,
              direccion: origen,
              fechaNacimiento: new Date('1990-01-01'),
              remiseriaId: coordinador.remiseriaId
            }
          });
          clienteId = cliente.id;
        } catch (errCliente) {
          console.warn('Aviso creación cliente rápido:', errCliente);
        }
      } else if (cliente) {
        clienteId = cliente.id;
      }

      let precioFinal = parseFloat(precio) || 0;
      if (precioFinal <= 0) {
        precioFinal = coordinador.remiseria.bajadaBandera || 3500;
      }

      // El viaje siempre se crea como PENDIENTE para que el chofer lo acepte voluntariamente
      const estadoInicial = 'PENDIENTE';

      let choferVehiculoId = vehiculoId || null;
      if (choferId && !choferVehiculoId) {
        const choferEncontrado = await prisma.chofer.findUnique({
          where: { id: choferId },
          select: { vehiculoId: true }
        });
        choferVehiculoId = choferEncontrado?.vehiculoId || null;
      }

      const nuevoViaje = await prisma.viaje.create({
        data: {
          remiseriaId: coordinador.remiseriaId,
          clienteId,
          clienteNombre: nombre ? `${nombre} ${apellido || ''}`.trim() : (cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Pasajero Telefónico'),
          clienteTelefono: cleanPhone,
          origen: origen.trim(),
          destino: (destino || 'A convenir').trim(),
          precio: precioFinal,
          fecha: new Date(),
          estado: estadoInicial,
          observaciones: observaciones || null,
          prioridad: prioridad || 'NORMAL',
          choferId: choferId || null,
          vehiculoId: choferVehiculoId,
          recargoTipo: null,
          recargoMonto: 0
        },
        include: {
          cliente: true,
          chofer: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              vehiculo: true
            }
          },
          vehiculo: true
        }
      });

      await prisma.appUsage.create({
        data: {
          userId: coordinadorId,
          userEmail: coordinador.email,
          action: 'CREATE_VIAJE_EXPRESS',
          details: JSON.stringify({ viajeId: nuevoViaje.id, choferId, precio: precioFinal }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });

      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        if (io) {
          io.to(coordinador.remiseriaId).emit('nuevo_viaje_recibido', nuevoViaje);
          io.to(coordinador.remiseriaId).emit('viaje_disponible', nuevoViaje);
          if (choferId) {
            io.to(coordinador.remiseriaId).emit('viaje_asignado_directo', {
              choferId,
              viaje: nuevoViaje
            });
            io.to(coordinador.remiseriaId).emit('viaje_estado_actualizado', {
              viajeId: nuevoViaje.id,
              estado: 'PENDIENTE',
              mensaje: 'Viaje ofrecido al chofer, pendiente de aceptación',
              viaje: nuevoViaje
            });
          }
        }
      } catch (socketErr) {
        console.warn('Aviso socket viaje express:', socketErr);
      }

      res.status(201).json({
        success: true,
        data: nuevoViaje,
        message: choferId ? 'Viaje despachado al móvil (pendiente de aceptación por el chofer)' : 'Viaje ingresado a la cola sin asignar'
      });
    } catch (error) {
      console.error('Error creando viaje express:', error);
      res.status(500).json({ success: false, message: 'Error al registrar viaje express' });
    }
  },

  // 3. Reasignación rápida de móvil en caliente (1 clic)
  async reasignarViaje(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      const { id } = req.params;
      const { nuevoChoferId, nuevoVehiculoId, motivo } = req.body;

      if (!coordinadorId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      if (!nuevoChoferId) {
        return res.status(400).json({ success: false, message: 'Debe seleccionar el nuevo chofer' });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({ success: false, message: 'Coordinador no encontrado' });
      }

      const viaje = await prisma.viaje.findUnique({
        where: { id },
        include: { chofer: true, cliente: true }
      });

      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      const choferAnteriorId = viaje.choferId;

      const nuevoChofer = await prisma.chofer.findUnique({
        where: { id: nuevoChoferId },
        include: { vehiculo: true }
      });

      if (!nuevoChofer) {
        return res.status(404).json({ success: false, message: 'Nuevo chofer no encontrado' });
      }

      const finalVehiculoId = nuevoVehiculoId || nuevoChofer.vehiculoId || null;

      const viajeActualizado = await prisma.viaje.update({
        where: { id },
        data: {
          choferId: nuevoChofer.id,
          vehiculoId: finalVehiculoId,
          choferAnteriorId: choferAnteriorId || undefined,
          motivoReasignacion: motivo || 'Reasignación operativa por central',
          estado: 'ACEPTADO'
        },
        include: {
          cliente: true,
          chofer: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              vehiculo: true
            }
          },
          vehiculo: true
        }
      });

      await prisma.appUsage.create({
        data: {
          userId: coordinadorId,
          userEmail: coordinador.email,
          action: 'REASSIGN_VIAJE',
          details: JSON.stringify({
            viajeId: id,
            choferAnteriorId,
            nuevoChoferId,
            motivo
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });

      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        if (io) {
          if (choferAnteriorId) {
            io.to(coordinador.remiseriaId).emit('viaje_retirado_chofer', {
              choferId: choferAnteriorId,
              viajeId: id,
              motivo: motivo || 'Viaje reasignado a otro móvil por la central'
            });
          }

          io.to(coordinador.remiseriaId).emit('viaje_asignado_directo', {
            choferId: nuevoChofer.id,
            viaje: viajeActualizado
          });

          io.to(coordinador.remiseriaId).emit('viaje_estado_actualizado', {
            viajeId: id,
            estado: 'ACEPTADO',
            mensaje: `Viaje reasignado a ${nuevoChofer.nombre} ${nuevoChofer.apellido}`,
            viaje: viajeActualizado
          });

          io.to(coordinador.remiseriaId).emit('chofer_reasignado', {
            viajeId: id,
            nuevoChofer: {
              nombre: `${nuevoChofer.nombre} ${nuevoChofer.apellido}`,
              telefono: nuevoChofer.telefono,
              vehiculo: nuevoChofer.vehiculo ? `${nuevoChofer.vehiculo.marca} ${nuevoChofer.vehiculo.modelo} (${nuevoChofer.vehiculo.patente})` : 'Auto Asignado'
            }
          });
        }
      } catch (socketErr) {
        console.warn('Aviso socket reasignar viaje:', socketErr);
      }

      res.json({
        success: true,
        data: viajeActualizado,
        message: `Viaje reasignado con éxito a ${nuevoChofer.nombre} ${nuevoChofer.apellido}`
      });
    } catch (error) {
      console.error('Error al reasignar viaje:', error);
      res.status(500).json({ success: false, message: 'Error interno al reasignar el viaje' });
    }
  },

  // 4. Auditoría de cancelaciones
  async getAuditoriaCancelaciones(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      if (!coordinadorId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId }
      });

      if (!coordinador) {
        return res.status(404).json({ success: false, message: 'Coordinador no encontrado' });
      }

      const { fechaDesde, fechaHasta, canceladoPor } = req.query;

      const whereClause: any = {
        remiseriaId: coordinador.remiseriaId,
        estado: 'CANCELADO'
      };

      if (canceladoPor && typeof canceladoPor === 'string' && ['CLIENTE', 'CHOFER', 'COORDINADOR'].includes(canceladoPor.toUpperCase())) {
        whereClause.canceladoPor = canceladoPor.toUpperCase();
      }

      if (fechaDesde || fechaHasta) {
        whereClause.fecha = {};
        if (fechaDesde && typeof fechaDesde === 'string') {
          whereClause.fecha.gte = new Date(fechaDesde);
        }
        if (fechaHasta && typeof fechaHasta === 'string') {
          const hasta = new Date(fechaHasta);
          if (fechaHasta.length === 10) hasta.setHours(23, 59, 59, 999);
          whereClause.fecha.lte = hasta;
        }
      }

      const viajesCancelados = await prisma.viaje.findMany({
        where: whereClause,
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true
            }
          },
          chofer: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              vehiculo: true
            }
          }
        },
        orderBy: {
          fecha: 'desc'
        },
        take: 300
      });

      const totalCancelados = viajesCancelados.length;
      const canceladosCliente = viajesCancelados.filter((v) => v.canceladoPor === 'CLIENTE').length;
      const canceladosChofer = viajesCancelados.filter((v) => v.canceladoPor === 'CHOFER').length;
      const canceladosCoordinador = viajesCancelados.filter((v) => v.canceladoPor === 'COORDINADOR' || !v.canceladoPor).length;
      const conCostoMinimo = viajesCancelados.filter((v) => v.debeAbonarMinimo || (v.costoCancelacion && v.costoCancelacion > 0)).length;
      const totalRecaudadoCancelaciones = viajesCancelados.reduce((acc, v) => acc + (v.costoCancelacion || 0), 0);

      const motivosConteo: Record<string, number> = {};
      viajesCancelados.forEach((v) => {
        const motivoKey = (v.motivoCancelacion || 'Sin motivo especificado').trim();
        motivosConteo[motivoKey] = (motivosConteo[motivoKey] || 0) + 1;
      });

      const rankingMotivos = Object.entries(motivosConteo)
        .map(([motivo, cantidad]) => ({ motivo, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

      res.json({
        success: true,
        data: {
          metricas: {
            totalCancelados,
            canceladosCliente,
            canceladosChofer,
            canceladosCoordinador,
            conCostoMinimo,
            totalRecaudadoCancelaciones,
            rankingMotivos
          },
          viajes: viajesCancelados
        }
      });
    } catch (error) {
      console.error('Error obteniendo auditoría de cancelaciones:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // 5. Configuración de tarifas especiales (Lluvia, Nocturna, Feriado)
  async getConfiguracionTarifas(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      if (!coordinadorId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId },
        include: { remiseria: true }
      });

      if (!coordinador) {
        return res.status(404).json({ success: false, message: 'Coordinador no encontrado' });
      }

      const rem = coordinador.remiseria;
      res.json({
        success: true,
        data: {
          tarifaEspecialActiva: rem.tarifaEspecialActiva || 'NORMAL',
          porcentajeRecargoTarifa: rem.porcentajeRecargoTarifa || 0,
          bajadaBandera: rem.bajadaBandera || 3500,
          valorKm: rem.valorKm || 1200,
          valorHoraEspera: rem.valorHoraEspera || 12000
        }
      });
    } catch (error) {
      console.error('Error al obtener configuración de tarifas:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  async updateConfiguracionTarifas(req: AuthenticatedRequest, res: Response) {
    try {
      const coordinadorId = req.user?.id;
      if (!coordinadorId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      const coordinador = await prisma.coordinador.findFirst({
        where: { userId: coordinadorId }
      });

      if (!coordinador) {
        return res.status(404).json({ success: false, message: 'Coordinador no encontrado' });
      }

      const { tarifaEspecialActiva, porcentajeRecargoTarifa, bajadaBandera, valorKm, valorHoraEspera } = req.body;

      const dataToUpdate: any = {};
      if (tarifaEspecialActiva !== undefined) dataToUpdate.tarifaEspecialActiva = tarifaEspecialActiva;
      if (porcentajeRecargoTarifa !== undefined) dataToUpdate.porcentajeRecargoTarifa = parseFloat(porcentajeRecargoTarifa);
      if (bajadaBandera !== undefined) dataToUpdate.bajadaBandera = parseFloat(bajadaBandera);
      if (valorKm !== undefined) dataToUpdate.valorKm = parseFloat(valorKm);
      if (valorHoraEspera !== undefined) dataToUpdate.valorHoraEspera = parseFloat(valorHoraEspera);

      const updatedRemiseria = await prisma.remiseria.update({
        where: { id: coordinador.remiseriaId },
        data: dataToUpdate
      });

      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        if (io) {
          io.to(coordinador.remiseriaId).emit('tarifa_configuracion_actualizada', {
            tarifaEspecialActiva: updatedRemiseria.tarifaEspecialActiva,
            porcentajeRecargoTarifa: updatedRemiseria.porcentajeRecargoTarifa,
            bajadaBandera: updatedRemiseria.bajadaBandera,
            valorKm: updatedRemiseria.valorKm
          });
        }
      } catch (socketErr) {
        console.warn('Aviso socket tarifas:', socketErr);
      }

      res.json({
        success: true,
        data: updatedRemiseria,
        message: 'Configuración de tarifas actualizada exitosamente'
      });
    } catch (error) {
      console.error('Error actualizando tarifas:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
};
