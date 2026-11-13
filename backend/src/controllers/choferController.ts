import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';
import bcrypt from 'bcryptjs';

// ============================================================================
// SISTEMA DE TABLAS (COLA FIFO) + DESPACHO POR PROXIMIDAD (A POCAS CUADRAS)
// ============================================================================
interface OfertaViajeState {
  choferOfertadoId: string;
  motivoOferta: 'CERCANIA' | 'TABLA';
  puestoTabla: number;
  distanciaMetros: number | null;
  expiraEn: number;
  rechazadosIds: Set<string>;
}

const OFERTA_TIMEOUT_MS = 15000; // 15 segundos para choferes con la app abierta en pantalla
const OFERTA_TIMEOUT_SIN_APP_MS = 8000; // 8 segundos para choferes online en BD sin sesión activa abierta
const HEARTBEAT_ACTIVO_MS = 20000; // 20 segundos máximo sin latido para detectar sesión activa en navegador
const RADIO_CERCANIA_METROS = 600; // ~5 a 6 cuadras del pedido
const VENTAJA_MINIMA_CERCANIA_METROS = 250; // Al menos 2.5 cuadras más cerca que el #1 de la tabla

export const ofertasViajesMap = new Map<string, OfertaViajeState>();
export const choferHeartbeatMap = new Map<string, number>();

async function resolverChoferFallbackId(): Promise<string | undefined> {
  // 1) Priorizar chofer que actualmente tenga un viaje activo en curso
  const viajeActivo = await prisma.viaje.findFirst({
    where: {
      choferId: { not: null },
      estado: { in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] },
    },
    orderBy: { updatedAt: 'desc' },
    select: { choferId: true },
  });
  if (viajeActivo?.choferId) return viajeActivo.choferId;

  // 2) Priorizar chofer con heartbeat activo en la app
  const ahora = Date.now();
  let mejorHeartbeatChoferId: string | undefined;
  let mejorTs = 0;
  for (const [id, ts] of choferHeartbeatMap.entries()) {
    if (ahora - ts <= HEARTBEAT_ACTIVO_MS && ts > mejorTs) {
      mejorTs = ts;
      mejorHeartbeatChoferId = id;
    }
  }
  if (mejorHeartbeatChoferId) return mejorHeartbeatChoferId;

  // 3) Priorizar chofer en Parada Virtual / Tabla
  const enTabla = await prisma.chofer.findFirst({
    where: { estado: 'ACTIVO', isOnline: true, enParadaVirtual: true },
    orderBy: { paradaVirtualIngreso: 'asc' },
    select: { id: true },
  });
  if (enTabla?.id) return enTabla.id;

  // 4) Fallback general
  const fallback =
    (await prisma.chofer.findFirst({
      where: { estado: 'ACTIVO', isOnline: true },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })) ||
    (await prisma.chofer.findFirst({
      where: { estado: 'ACTIVO' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    }));
  return fallback?.id;
}

function calcularDistanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function parsearCoordenadasOrigen(origenDetallado?: string | null): { lat: number; lng: number } | null {
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
  } catch {
    // ignore
  }
  return null;
}

function estaChoferEnPausa(observaciones?: string | null): boolean {
  if (!observaciones || !observaciones.startsWith('{')) return false;
  try {
    const obs = JSON.parse(observaciones);
    return Boolean(obs.enPausa);
  } catch {
    return false;
  }
}

export const choferController = {
  // Obtener todos los choferes
  async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const { rol, id: userId } = req.user!;
      let whereClause: any = {};

      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        whereClause = { remiseriaId: { in: remiseriaIds } };
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        whereClause = { remiseriaId: coordinador?.remiseriaId || '' };
      }

      const choferes = await prisma.chofer.findMany({
        where: whereClause,
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
              direccion: true,
              latitud: true,
              longitud: true,
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: choferes,
      });
    } catch (error) {
      console.error('Error getting choferes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener choferes por remisería
  async getByRemiseria(req: AuthenticatedRequest, res: Response) {
    try {
      const { remiseriaId } = req.params;
      const { rol, id: userId } = req.user!;

      // Validar acceso a la remiseriaId
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para acceder a esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para acceder a esta remisería',
          });
        }
      }

      const choferes = await prisma.chofer.findMany({
        where: {
          remiseriaId,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
              direccion: true,
              latitud: true,
              longitud: true,
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: choferes,
      });
    } catch (error) {
      console.error('Error getting choferes by remiseria:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener chofer por ID
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rol, id: userId } = req.user!;

      const chofer = await prisma.chofer.findFirst({
        where: {
          id,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
              direccion: true,
              latitud: true,
              longitud: true,
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Validar acceso
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(chofer.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver este chofer',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== chofer.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver este chofer',
          });
        }
      }

      res.json({
        success: true,
        data: chofer,
      });
    } catch (error) {
      console.error('Error getting chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Crear chofer
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { 
        numeroChofer, 
        nombre, 
        apellido, 
        dni, 
        telefono, 
        email, 
        direccion, 
        categoriaLicencia, 
        vtoLicencia, 
        observaciones, 
        remiseriaId, 
        vehiculoId,
        esPropietario,
        comisionPorcentaje,
        fotoUrl
      } = req.body;

      // Validar campos requeridos
      if (!numeroChofer || !nombre || !apellido || !dni || !telefono || !categoriaLicencia || !vtoLicencia || !remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'Los campos número de chofer, nombre, apellido, DNI, teléfono, categoría de licencia, vencimiento de licencia y remisería son requeridos',
        });
      }

      // Verificar si el número de chofer ya existe
      const existingNumeroChofer = await prisma.chofer.findFirst({
        where: {
          numeroChofer,
        },
      });

      if (existingNumeroChofer) {
        return res.status(400).json({
          success: false,
          message: 'El número de chofer ya está registrado',
        });
      }

      // Verificar si el DNI ya existe
      const existingChofer = await prisma.chofer.findFirst({
        where: {
          dni,
        },
      });

      if (existingChofer) {
        return res.status(400).json({
          success: false,
          message: 'El DNI ya está registrado',
        });
      }

      // Verificar que la remisería existe
      const remiseria = await prisma.remiseria.findUnique({
        where: { id: remiseriaId },
      });

      if (!remiseria) {
        return res.status(400).json({
          success: false,
          message: 'Remisería no encontrada',
        });
      }

      // Validar acceso del usuario creador a la remisería
      const { rol, id: userId } = req.user!;
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para crear choferes en esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para crear choferes en esta remisería',
          });
        }
      }

      // Verificar que el vehículo existe si se proporciona
      if (vehiculoId) {
        const vehiculo = await prisma.vehiculo.findUnique({
          where: { id: vehiculoId },
        });

        if (!vehiculo) {
          return res.status(400).json({
            success: false,
            message: 'Vehículo no encontrado',
          });
        }
      }

      // El email del chofer será el provisto, o si no se provee, generaremos uno temporal para que pueda loguearse
      const choferEmail = email || `${numeroChofer.toLowerCase()}@remiseria.com`;
      
      // Verificar si el email ya está en uso por otro usuario
      const existingUser = await prisma.user.findUnique({
        where: { email: choferEmail },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'El email proporcionado ya está en uso por otro usuario. Si no proporcionó uno, el email autogenerado ya existe.',
        });
      }

      // La contraseña por defecto será su DNI
      const passwordHash = await bcrypt.hash(dni, 10);

      // Usar transacción para crear el Usuario y el Chofer
      const result = await prisma.$transaction(async (prisma) => {
        const user = await prisma.user.create({
          data: {
            email: choferEmail,
            passwordHash,
            rol: 'CHOFER',
            activo: true,
          },
        });

        const chofer = await prisma.chofer.create({
          data: {
            numeroChofer,
            nombre,
            apellido,
            dni,
            telefono,
            email: choferEmail,
            direccion,
            categoriaLicencia,
            vtoLicencia: new Date(vtoLicencia),
            observaciones: observaciones || null,
            esPropietario: esPropietario || false,
            comisionPorcentaje: comisionPorcentaje !== undefined ? parseFloat(comisionPorcentaje) : 30.0,
            remiseriaId,
            vehiculoId: vehiculoId || null,
            fotoUrl: fotoUrl || null,
            userId: user.id,
          },
          include: {
            remiseria: {
              select: {
                id: true,
                nombreFantasia: true,
              },
            },
            vehiculo: {
              select: {
                id: true,
                patente: true,
                marca: true,
                modelo: true,
              },
            },
          },
        });

        return chofer;
      });

      // Registrar log de auditoría
      if (req.user) {
        await prisma.appUsage.create({
          data: {
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'CREATE_CHOFER',
            details: JSON.stringify({ choferId: result.id, nombre: `${result.nombre} ${result.apellido}`, numeroChofer: result.numeroChofer }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || null
          }
        });
      }

      res.status(201).json({
        success: true,
        data: result,
        message: 'Chofer creado exitosamente. Contraseña temporal: DNI',
      });
    } catch (error) {
      console.error('Error creating chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Actualizar chofer
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { 
        numeroChofer, 
        nombre, 
        apellido, 
        dni, 
        telefono, 
        email, 
        direccion, 
        categoriaLicencia, 
        vtoLicencia, 
        observaciones, 
        estado, 
        vehiculoId,
        esPropietario,
        comisionPorcentaje,
        fotoUrl
      } = req.body;

      // Verificar que el chofer existe
      const existingChofer = await prisma.chofer.findFirst({
        where: {
          id,
        },
      });

      if (!existingChofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Validar acceso
      const { rol, id: userId } = req.user!;
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(existingChofer.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar choferes de esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== existingChofer.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar choferes de esta remisería',
          });
        }
      }

      // Si se está cambiando el número de chofer, verificar que no exista
      if (numeroChofer && numeroChofer !== existingChofer.numeroChofer) {
        const numeroChoferExists = await prisma.chofer.findFirst({
          where: {
            numeroChofer,
            id: { not: id },
          },
        });

        if (numeroChoferExists) {
          return res.status(400).json({
            success: false,
            message: 'El número de chofer ya está registrado',
          });
        }
      }

      // Si se está cambiando el DNI, verificar que no exista
      if (dni && dni !== existingChofer.dni) {
        const dniExists = await prisma.chofer.findFirst({
          where: {
            dni,
            id: { not: id },
          },
        });

        if (dniExists) {
          return res.status(400).json({
            success: false,
            message: 'El DNI ya está registrado',
          });
        }
      }

      // Verificar que el vehículo existe si se proporciona
      if (vehiculoId) {
        const vehiculo = await prisma.vehiculo.findUnique({
          where: { id: vehiculoId },
        });

        if (!vehiculo) {
          return res.status(400).json({
            success: false,
            message: 'Vehículo no encontrado',
          });
        }
      }

      // Preparar datos de actualización
      const updateData: any = {};
      if (numeroChofer) updateData.numeroChofer = numeroChofer;
      if (nombre) updateData.nombre = nombre;
      if (apellido) updateData.apellido = apellido;
      if (dni) updateData.dni = dni;
      if (telefono) updateData.telefono = telefono;
      if (email !== undefined) updateData.email = email;
      if (direccion !== undefined) updateData.direccion = direccion;
      if (categoriaLicencia) updateData.categoriaLicencia = categoriaLicencia;
      if (vtoLicencia) updateData.vtoLicencia = new Date(vtoLicencia);
      if (observaciones !== undefined) updateData.observaciones = observaciones;
      if (estado !== undefined) updateData.estado = estado;
      if (vehiculoId !== undefined) updateData.vehiculoId = vehiculoId;
      if (esPropietario !== undefined) updateData.esPropietario = esPropietario;
      if (comisionPorcentaje !== undefined) updateData.comisionPorcentaje = parseFloat(comisionPorcentaje);
      if (fotoUrl !== undefined) updateData.fotoUrl = fotoUrl;

      const chofer = await prisma.chofer.update({
        where: { id },
        data: updateData,
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
              direccion: true,
              latitud: true,
              longitud: true,
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
      });

      // Registrar log de auditoría
      if (req.user) {
        await prisma.appUsage.create({
          data: {
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'UPDATE_CHOFER',
            details: JSON.stringify({ choferId: chofer.id, nombre: `${chofer.nombre} ${chofer.apellido}`, numeroChofer: chofer.numeroChofer }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || null
          }
        });
      }

      res.json({
        success: true,
        data: chofer,
        message: 'Chofer actualizado exitosamente',
      });
    } catch (error) {
      console.error('Error updating chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Baja lógica del chofer
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      // Verificar que el chofer existe
      const chofer = await prisma.chofer.findFirst({
        where: {
          id,
        },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Validar acceso
      const { rol, id: userId } = req.user!;
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(chofer.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar choferes de esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== chofer.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar choferes de esta remisería',
          });
        }
      }

      // Baja lógica (marcar como dado de baja)
      await prisma.chofer.update({
        where: { id },
        data: { estado: 'DADO_DE_BAJA' },
      });

      // Registrar log de auditoría
      if (req.user) {
        await prisma.appUsage.create({
          data: {
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'DELETE_CHOFER',
            details: JSON.stringify({ choferId: chofer.id, nombre: `${chofer.nombre} ${chofer.apellido}` }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || null
          }
        });
      }

      res.json({
        success: true,
        message: 'Chofer eliminado exitosamente',
      });
    } catch (error) {
      console.error('Error deleting chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Cambiar estado del chofer (activar/suspender/dar de baja)
  async toggleStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const chofer = await prisma.chofer.findUnique({
        where: { id },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Validar acceso
      const { rol, id: userId } = req.user!;
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } }
        });
        const remiseriaIds = duenio?.remiserias.map(r => r.remiseriaId) || [];
        if (!remiseriaIds.includes(chofer.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar choferes de esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId }
        });
        if (coordinador?.remiseriaId !== chofer.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar choferes de esta remisería',
          });
        }
      }

      // Cambiar estado: ACTIVO -> SUSPENDIDO -> DADO_DE_BAJA -> ACTIVO
      let newEstado: 'ACTIVO' | 'SUSPENDIDO' | 'DADO_DE_BAJA';
      let message: string;

      switch (chofer.estado) {
        case 'ACTIVO':
          newEstado = 'SUSPENDIDO';
          message = 'Chofer suspendido exitosamente';
          break;
        case 'SUSPENDIDO':
          newEstado = 'DADO_DE_BAJA';
          message = 'Chofer dado de baja exitosamente';
          break;
        case 'DADO_DE_BAJA':
          newEstado = 'ACTIVO';
          message = 'Chofer activado exitosamente';
          break;
        default:
          newEstado = 'ACTIVO';
          message = 'Chofer activado exitosamente';
      }

      const updatedChofer = await prisma.chofer.update({
        where: { id },
        data: { estado: newEstado },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
              direccion: true,
              latitud: true,
              longitud: true,
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
      });

      // Registrar log de auditoría
      if (req.user) {
        await prisma.appUsage.create({
          data: {
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'TOGGLE_CHOFER_STATUS',
            details: JSON.stringify({ choferId: updatedChofer.id, nombre: `${updatedChofer.nombre} ${updatedChofer.apellido}`, estado: newEstado }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || null
          }
        });
      }

      res.json({
        success: true,
        data: updatedChofer,
        message,
      });
    } catch (error) {
      console.error('Error toggling chofer status:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },
  // Cambiar estado online del chofer
  async updateOnlineStatus(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || req.body?.choferId;
      const { isOnline } = req.body;

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no es un chofer',
        });
      }

      if (typeof isOnline !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'El estado isOnline es requerido',
        });
      }

      const choferActual = await prisma.chofer.findUnique({
        where: { id: choferId },
      });

      if (!choferActual) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      if (isOnline && choferActual.estado !== 'ACTIVO') {
        const msg =
          choferActual.estado === 'PENDIENTE_APROBACION'
            ? 'Tu cuenta está pendiente de aprobación por el dueño de la remisería. No puedes conectarte aún.'
            : choferActual.estado === 'RECHAZADO'
            ? `Tu solicitud fue rechazada por la remisería.${choferActual.motivoRechazo ? ' Motivo: ' + choferActual.motivoRechazo : ''}`
            : 'Tu cuenta de chofer se encuentra suspendida o dada de baja.';
        return res.status(403).json({
          success: false,
          message: msg,
          estado: choferActual.estado,
        });
      }

      const updatedChofer = await prisma.chofer.update({
        where: { id: choferId },
        data: {
          isOnline,
          // Sistema de Tablas: al conectarse entra al final de la cola; al desconectarse sale de la cola
          enParadaVirtual: isOnline ? true : false,
          paradaVirtualIngreso: isOnline
            ? (choferActual.enParadaVirtual && choferActual.paradaVirtualIngreso
                ? choferActual.paradaVirtualIngreso
                : new Date())
            : null,
        },
      });

      // Manejar automáticamente el turno activo según el estado online
      let turnoActivo = null;
      if (isOnline) {
        turnoActivo = await prisma.turnoChofer.findFirst({
          where: { choferId, activo: true },
        });
        if (!turnoActivo) {
          const odometroInicio = req.body?.odometroInicio ? parseFloat(req.body.odometroInicio) : null;
          turnoActivo = await prisma.turnoChofer.create({
            data: {
              choferId,
              vehiculoId: updatedChofer.vehiculoId || null,
              activo: true,
              odometroInicio: odometroInicio !== null && !isNaN(odometroInicio) ? odometroInicio : null,
            },
          });
        }
      } else {
        const turnosActivos = await prisma.turnoChofer.findMany({
          where: { choferId, activo: true },
        });
        const odometroFin = req.body?.odometroFin ? parseFloat(req.body.odometroFin) : null;
        for (const t of turnosActivos) {
          await prisma.turnoChofer.update({
            where: { id: t.id },
            data: {
              activo: false,
              fechaFin: new Date(),
              odometroFin: odometroFin !== null && !isNaN(odometroFin) ? odometroFin : null,
            },
          });
        }
      }

      res.json({
        success: true,
        data: {
          ...updatedChofer,
          turnoActivo,
        },
        message: isOnline ? 'Chofer conectado exitosamente' : 'Chofer desconectado exitosamente',
      });
    } catch (error) {
      console.error('Error updating online status:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener estado actual del chofer, viaje en curso y alertas de viajes disponibles
  async getMiEstado(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || (req.query.choferId as string | undefined);

      if (!choferId) {
        choferId = await resolverChoferFallbackId();
      }

      if (!choferId) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
        select: {
          id: true,
          numeroChofer: true,
          nombre: true,
          apellido: true,
          dni: true,
          telefono: true,
          email: true,
          estado: true,
          motivoRechazo: true,
          observaciones: true,
          esPropietario: true,
          comisionPorcentaje: true,
          isOnline: true,
          enParadaVirtual: true,
          paradaVirtualIngreso: true,
          remiseriaId: true,
          vehiculoId: true,
          updatedAt: true,
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
              color: true,
            },
          },
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
              direccion: true,
              latitud: true,
              longitud: true,
            },
          },
        },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Ejecutar en paralelo las consultas de estado del chofer y de la flota
      const [viajeActual, viajesEnCursoRemiseria, choferesOnlineRemiseria, turnoActivo] =
        await Promise.all([
          prisma.viaje.findFirst({
            where: {
              choferId: chofer.id,
              estado: {
                in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'],
              },
            },
            include: {
              cliente: {
                select: {
                  id: true,
                  nombre: true,
                  apellido: true,
                  telefono: true,
                  fotoUrl: true,
                },
              },
              vehiculo: {
                select: {
                  id: true,
                  patente: true,
                  marca: true,
                  modelo: true,
                  color: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          }),
          prisma.viaje.findMany({
            where: {
              remiseriaId: chofer.remiseriaId,
              choferId: { not: null },
              estado: { in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] },
            },
            select: { choferId: true },
          }),
          prisma.chofer.findMany({
            where: {
              remiseriaId: chofer.remiseriaId,
              estado: 'ACTIVO',
              isOnline: true,
            },
            select: {
              id: true,
              nombre: true,
              apellido: true,
              isOnline: true,
              enParadaVirtual: true,
              paradaVirtualIngreso: true,
              updatedAt: true,
              observaciones: true,
              vehiculo: {
                select: {
                  id: true,
                  patente: true,
                  latitud: true,
                  longitud: true,
                },
              },
            },
          }),
          prisma.turnoChofer.findFirst({
            where: {
              choferId: chofer.id,
              activo: true,
            },
            orderBy: {
              fechaInicio: 'desc',
            },
          }),
        ]);

      // Extraer datos de pausa de observaciones
      let enPausa = false;
      let motivoPausa = null;
      let pausaInicio = null;
      try {
        if (chofer.observaciones && chofer.observaciones.startsWith('{')) {
          const obs = JSON.parse(chofer.observaciones);
          enPausa = Boolean(obs.enPausa);
          motivoPausa = obs.motivoPausa || null;
          pausaInicio = obs.pausaInicio || null;
        }
      } catch {
        // no es JSON
      }

      // ======================================================================
      // CALCULAR LA "TABLA" (COLA FIFO DE CHOFERES LIBRES CON APP ABIERTA)
      // ======================================================================
      const ahoraHeartbeatMs = Date.now();
      if (chofer.isOnline) {
        choferHeartbeatMap.set(chofer.id, ahoraHeartbeatMs);
      } else {
        choferHeartbeatMap.delete(chofer.id);
      }

      const choferesOcupadosSet = new Set(viajesEnCursoRemiseria.map((v) => v.choferId));

      // Filtrar choferes realmente libres (online, sin viaje en curso y sin pausa)
      // Prioridad en la Tabla:
      // 1) Choferes anotados en la Tabla (enParadaVirtual: true), ordenados por paradaVirtualIngreso ASC
      // 2) Choferes con sesión activa en la app (heartbeat reciente) antes que choferes de prueba inactivos de la BD
      const libresCandidatos = choferesOnlineRemiseria.filter(
        (c) => !choferesOcupadosSet.has(c.id) && !estaChoferEnPausa(c.observaciones)
      );

      const enTablaExplicitos = libresCandidatos.filter((c) => c.enParadaVirtual);
      const baseTabla = enTablaExplicitos.length > 0 ? enTablaExplicitos : libresCandidatos;

      const tablaChoferesLibres = baseTabla.sort((a, b) => {
        const aActivo = ahoraHeartbeatMs - (choferHeartbeatMap.get(a.id) || 0) <= HEARTBEAT_ACTIVO_MS ? 1 : 0;
        const bActivo = ahoraHeartbeatMs - (choferHeartbeatMap.get(b.id) || 0) <= HEARTBEAT_ACTIVO_MS ? 1 : 0;
        if (aActivo !== bActivo) return bActivo - aActivo;

        const timeA = a.paradaVirtualIngreso ? new Date(a.paradaVirtualIngreso).getTime() : new Date(a.updatedAt).getTime();
        const timeB = b.paradaVirtualIngreso ? new Date(b.paradaVirtualIngreso).getTime() : new Date(b.updatedAt).getTime();
        return timeA - timeB;
      });

      const miIndiceTabla = tablaChoferesLibres.findIndex((c) => c.id === chofer.id);
      const puestoEnTabla = miIndiceTabla !== -1 ? miIndiceTabla + 1 : null;
      const totalEnTabla = tablaChoferesLibres.length;

      // Si no tiene viaje activo y no está en pausa, buscar viajes pendientes y aplicar:
      // 1) Proximidad si algún chofer libre está a pocas cuadras (<= 600m) del pedido y más cerca que la base/#1
      // 2) Si no, respetar estrictamente el orden de la Tabla (#1, luego #2 si rechaza/vence, etc.)
      let viajesDisponibles: any[] = [];
      let viajeEnColaTabla: {
        viajeId: string;
        puestoOfertado: number;
        choferOfertadoNombre: string;
        segundosRestantes: number;
      } | null = null;
      if (!viajeActual && !enPausa && chofer.isOnline) {
        const candidatosViajes = await prisma.viaje.findMany({
          where: {
            estado: 'PENDIENTE',
            OR: [
              // 1. Asignado específicamente a este chofer
              { choferId: chofer.id },
              // 2. O pedido pendiente sin chofer asignado
              {
                choferId: null,
                OR: [
                  { remiseriaId: chofer.remiseriaId },
                  { clienteId: { not: null } },
                ],
              },
            ],
          },
          include: {
            cliente: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                telefono: true,
                fotoUrl: true,
              },
            },
          },
          orderBy: [
            { prioridad: 'desc' },
            { createdAt: 'asc' },
          ],
        });

        const ahoraMs = Date.now();
        const baseLat = chofer.remiseria?.latitud ?? -34.901138;
        const baseLng = chofer.remiseria?.longitud ?? -60.013778;

        // Limpiar ofertas en memoria de viajes que ya no están en PENDIENTE
        const idsPendientesSet = new Set(candidatosViajes.map((cv) => cv.id));
        for (const key of ofertasViajesMap.keys()) {
          if (!idsPendientesSet.has(key)) {
            ofertasViajesMap.delete(key);
          }
        }

        // Control para despacho paralelo (1 oferta simultánea por chofer libre de la Tabla)
        // Así si entran 5 pedidos juntos y hay 5 autos en la Tabla, salen los 5 en paralelo (#1, #2, #3, #4, #5)
        const choferesConOfertaActiva = new Set<string>();

        for (const v of candidatosViajes) {
          // Si fue asignado explícitamente a este chofer, mostrarlo directo
          if (v.choferId === chofer.id) {
            viajesDisponibles.push({
              ...v,
              motivoOferta: 'ASIGNADO_DIRECTO',
              puestoTabla: puestoEnTabla || 1,
            });
            continue;
          }

          if (tablaChoferesLibres.length === 0) continue;

          let state = ofertasViajesMap.get(v.id);
          if (!state) {
            state = {
              choferOfertadoId: '',
              motivoOferta: 'TABLA',
              puestoTabla: 1,
              distanciaMetros: null,
              expiraEn: 0,
              rechazadosIds: new Set<string>(),
            };
            ofertasViajesMap.set(v.id, state);
          }

          // Si la oferta actual venció por tiempo, pasar al siguiente chofer de la tabla
          if (state.choferOfertadoId && ahoraMs >= state.expiraEn) {
            state.rechazadosIds.add(state.choferOfertadoId);
            state.choferOfertadoId = '';
          }

          // Si este chofer ya tiene otra oferta activa de mayor prioridad/antigüedad en este ciclo,
          // reasignar este viaje al siguiente chofer libre para evitar embudo en el Puesto #1
          if (state.choferOfertadoId && choferesConOfertaActiva.has(state.choferOfertadoId)) {
            state.choferOfertadoId = '';
          }

          // Verificar si el chofer actualmente ofertado sigue libre
          const ofertadoSigueLibre =
            state.choferOfertadoId &&
            !state.rechazadosIds.has(state.choferOfertadoId) &&
            tablaChoferesLibres.some((c) => c.id === state!.choferOfertadoId);

          if (ofertadoSigueLibre) {
            choferesConOfertaActiva.add(state.choferOfertadoId);
          } else {
            // Filtrar choferes de la tabla que aún no rechazaron ni dejaron vencer este viaje
            // y que NO tengan ya otro viaje ofreciéndose en simultáneo
            let elegibles = tablaChoferesLibres.filter(
              (c) => !state!.rechazadosIds.has(c.id) && !choferesConOfertaActiva.has(c.id)
            );

            if (elegibles.length === 0) {
              // Si todos los que no tienen oferta activa ya habían rechazado este viaje,
              // reiniciar historial de rechazos pero respetando a los que están ocupados con otra oferta
              const libresSinOtraOferta = tablaChoferesLibres.filter(
                (c) => !choferesConOfertaActiva.has(c.id)
              );
              if (libresSinOtraOferta.length > 0) {
                state.rechazadosIds.clear();
                elegibles = libresSinOtraOferta;
              }
            }

            // Si hay más viajes que choferes libres y todos los choferes libres ya tienen 1 oferta activa en pantalla,
            // este viaje aguarda en cola hasta que el próximo chofer se desocupe o responda
            if (elegibles.length > 0) {
              const primeroTabla = elegibles[0];
              let ganador = primeroTabla;
              let motivo: 'CERCANIA' | 'TABLA' = 'TABLA';
              let distGanadorMetros: number | null = null;

              const coordsPedido = parsearCoordenadasOrigen(v.origenDetallado);
              if (coordsPedido) {
                const latPrimero = primeroTabla.vehiculo?.latitud ?? baseLat;
                const lngPrimero = primeroTabla.vehiculo?.longitud ?? baseLng;
                const distPrimero = calcularDistanciaMetros(
                  latPrimero,
                  lngPrimero,
                  coordsPedido.lat,
                  coordsPedido.lng
                );
                distGanadorMetros = distPrimero;

                // Buscar si hay algún chofer libre "a pocas cuadras" (<= 600m) del pedido
                // y al menos 250m más cerca que el #1 elegible de la tabla
                let mejorCercano: typeof primeroTabla | null = null;
                let menorDistanciaCercano = Infinity;

                for (const cand of elegibles) {
                  const cLat = cand.vehiculo?.latitud ?? baseLat;
                  const cLng = cand.vehiculo?.longitud ?? baseLng;
                  const dMetros = calcularDistanciaMetros(cLat, cLng, coordsPedido.lat, coordsPedido.lng);

                  if (
                    dMetros <= RADIO_CERCANIA_METROS &&
                    dMetros + VENTAJA_MINIMA_CERCANIA_METROS < distPrimero &&
                    dMetros < menorDistanciaCercano
                  ) {
                    menorDistanciaCercano = dMetros;
                    mejorCercano = cand;
                  }
                }

                if (mejorCercano) {
                  ganador = mejorCercano;
                  motivo = 'CERCANIA';
                  distGanadorMetros = menorDistanciaCercano;
                }
              }

              const puestoGanador = tablaChoferesLibres.findIndex((c) => c.id === ganador.id) + 1;
              const ganadorLatido = choferHeartbeatMap.get(ganador.id) || 0;
              const tieneAppAbierta = ahoraMs - ganadorLatido <= HEARTBEAT_ACTIVO_MS;
              const timeoutMs = tieneAppAbierta ? OFERTA_TIMEOUT_MS : OFERTA_TIMEOUT_SIN_APP_MS;

              state.choferOfertadoId = ganador.id;
              state.motivoOferta = motivo;
              state.puestoTabla = puestoGanador > 0 ? puestoGanador : 1;
              state.distanciaMetros = distGanadorMetros;
              state.expiraEn = ahoraMs + timeoutMs;
              choferesConOfertaActiva.add(ganador.id);
            }
          }

          // Solo notificar si ESTE chofer es el destinatario actual según la Tabla o Cercanía
          if (state.choferOfertadoId === chofer.id) {
            viajesDisponibles.push({
              ...v,
              motivoOferta: state.motivoOferta,
              puestoTabla: state.puestoTabla,
              distanciaOfertaMetros: state.distanciaMetros,
              segundosParaAceptar: Math.max(1, Math.ceil((state.expiraEn - ahoraMs) / 1000)),
            });
          } else if (!viajeEnColaTabla && state.choferOfertadoId) {
            const choferOfertadoObj = tablaChoferesLibres.find((c) => c.id === state!.choferOfertadoId);
            viajeEnColaTabla = {
              viajeId: v.id,
              puestoOfertado: state.puestoTabla,
              choferOfertadoNombre: choferOfertadoObj
                ? `${choferOfertadoObj.nombre} ${choferOfertadoObj.apellido || ''}`.trim()
                : `Puesto #${state.puestoTabla}`,
              segundosRestantes: Math.max(1, Math.ceil((state.expiraEn - ahoraMs) / 1000)),
            };
          }
        }
      }

      res.json({
        success: true,
        data: {
          chofer: {
            ...chofer,
            enPausa,
            motivoPausa,
            pausaInicio,
            puestoEnTabla,
            totalEnTabla,
          },
          viajeActual,
          viajesDisponibles,
          viajeEnColaTabla,
          turnoActivo,
          enPausa,
          motivoPausa,
          pausaInicio,
          puestoEnTabla,
          totalEnTabla,
        },
      });
    } catch (error) {
      console.error('Error getting estado del chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Pausar o reanudar el turno del chofer (sin cerrar sesión ni finalizar turno)
  async togglePausa(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || req.body?.choferId;
      const { enPausa, motivo } = req.body;

      if (!choferId && req.user?.id) {
        const choferByUser = await prisma.chofer.findFirst({
          where: { userId: req.user.id },
        });
        if (choferByUser) choferId = choferByUser.id;
      }

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(401).json({
          success: false,
          message: 'No se pudo identificar al chofer',
        });
      }

      if (enPausa) {
        const viajeActivo = await prisma.viaje.findFirst({
          where: {
            choferId,
            estado: { in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] }
          }
        });
        if (viajeActivo) {
          return res.status(400).json({
            success: false,
            message: 'No puedes pausar tu turno mientras tienes un viaje en curso.',
          });
        }
      }

      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
        include: { vehiculo: true }
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      let obsObj: any = {};
      try {
        if (chofer.observaciones && chofer.observaciones.startsWith('{')) {
          obsObj = JSON.parse(chofer.observaciones);
        }
      } catch (e) {
        obsObj = {};
      }

      obsObj.enPausa = Boolean(enPausa);
      obsObj.motivoPausa = enPausa ? (motivo || 'Descanso') : null;
      obsObj.pausaInicio = enPausa ? new Date().toISOString() : null;

      const updatedChofer = await prisma.chofer.update({
        where: { id: choferId },
        data: {
          observaciones: JSON.stringify(obsObj),
          // Sistema de Tablas: si se pausa sale de la tabla; al reanudar entra al final de la cola
          enParadaVirtual: enPausa ? false : true,
          paradaVirtualIngreso: enPausa ? null : new Date(),
        },
        include: { vehiculo: true }
      });

      // Notificar por WebSockets a la sala de la remisería
      try {
        const { getIO, invalidarChoferCache } = await import('../lib/socket');
        invalidarChoferCache(chofer.id);
        const io = getIO();
        if (io && chofer.remiseriaId) {
          const estadoVehiculo = enPausa ? 'en_pausa' : 'disponible';
          io.to(chofer.remiseriaId).emit('chofer_pausa_cambiada', {
            choferId,
            enPausa: Boolean(enPausa),
            motivo: obsObj.motivoPausa,
            nombre: `${chofer.nombre} ${chofer.apellido}`,
            estado: estadoVehiculo
          });

          io.to(chofer.remiseriaId).emit('vehiculo_movido', {
            id: chofer.vehiculoId || chofer.id,
            choferId: chofer.id,
            vehiculoId: chofer.vehiculoId,
            patente: chofer.vehiculo?.patente || 'Auto Propio',
            chofer: `${chofer.nombre} ${chofer.apellido}`,
            estado: estadoVehiculo,
            motivoPausa: obsObj.motivoPausa
          });
        }
      } catch (wsErr) {
        console.warn('Aviso socket al pausar turno:', wsErr);
      }

      res.json({
        success: true,
        data: {
          enPausa: Boolean(enPausa),
          motivoPausa: obsObj.motivoPausa,
          pausaInicio: obsObj.pausaInicio,
        },
        message: enPausa
          ? `Turno pausado (${obsObj.motivoPausa}). No recibirás viajes hasta reanudar.`
          : '¡Turno reanudado! Ya estás disponible para recibir viajes.',
      });
    } catch (error) {
      console.error('Error al cambiar pausa de turno:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Aceptar un viaje pendiente desde la app del chofer
  async aceptarViaje(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      let choferId = req.user?.chofer?.id || req.body?.choferId;

      if (!choferId) {
        choferId = await resolverChoferFallbackId();
      }

      if (!choferId) {
        return res.status(401).json({
          success: false,
          message: 'No se pudo identificar al chofer',
        });
      }

      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
      });

      if (!viaje) {
        return res.status(404).json({
          success: false,
          message: 'El viaje no existe',
        });
      }

      if (viaje.estado === 'CANCELADO') {
        return res.status(400).json({
          success: false,
          message: 'El viaje fue cancelado por el cliente',
        });
      }

      // ATOMIC UPDATE (Blindaje Concurrencia QA):
      // Garantiza a nivel de PostgreSQL que si dos choferes aceptan en el mismo milisegundo,
      // solo uno gane el viaje y se evite la doble asignación (Race Condition).
      const updateResult = await prisma.viaje.updateMany({
        where: {
          id: viajeId,
          OR: [
            { estado: 'PENDIENTE' },
            { choferId: chofer.id }
          ]
        },
        data: {
          choferId: chofer.id,
          vehiculoId: chofer.vehiculoId || viaje.vehiculoId || null,
          estado: 'ACEPTADO',
        },
      });

      if (updateResult.count === 0) {
        return res.status(409).json({
          success: false,
          message: 'Este viaje ya fue tomado por otro conductor',
        });
      }

      const viajeActualizado = await prisma.viaje.findUnique({
        where: { id: viajeId },
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              fotoUrl: true,
            },
          },
          chofer: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              fotoUrl: true,
              vehiculo: {
                select: {
                  id: true,
                  patente: true,
                  marca: true,
                  modelo: true,
                  color: true,
                  latitud: true,
                  longitud: true,
                  ultimaUbicacion: true,
                },
              },
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
              color: true,
              latitud: true,
              longitud: true,
              ultimaUbicacion: true,
            },
          },
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
              direccion: true,
              latitud: true,
              longitud: true,
              valorHoraEspera: true,
            },
          },
        },
      });

      if (!viajeActualizado) {
        return res.status(500).json({
          success: false,
          message: 'Error al recuperar el viaje actualizado',
        });
      }

      // Al tomar el viaje, sale de la Tabla y limpiamos la oferta activa y cualquier otra oferta apuntando a este chofer
      ofertasViajesMap.delete(viajeId);
      for (const st of ofertasViajesMap.values()) {
        if (st.choferOfertadoId === chofer.id) {
          st.choferOfertadoId = '';
          st.expiraEn = 0;
        }
      }
      await prisma.chofer.update({
        where: { id: chofer.id },
        data: {
          enParadaVirtual: false,
          paradaVirtualIngreso: null,
        },
      });

      try {
        const { getIO, invalidarChoferCache } = await import('../lib/socket');
        invalidarChoferCache(chofer.id);
        const io = getIO();
        if (io && viaje.remiseriaId) {
          io.to(viaje.remiseriaId).emit('parada_virtual_actualizada', {
            choferId: chofer.id,
            accion: 'SALIDA_VIAJE',
          });
          io.to(viaje.remiseriaId).emit('viaje_estado_actualizado', {
            viajeId: viajeActualizado.id,
            estado: 'ACEPTADO',
            mensaje: '¡Un chofer aceptó tu viaje y está en camino!',
            viaje: viajeActualizado,
          });
          const veh = viajeActualizado.vehiculo || viajeActualizado.chofer?.vehiculo;
          const baseLat = viajeActualizado.remiseria?.latitud ?? -34.901138;
          const baseLng = viajeActualizado.remiseria?.longitud ?? -60.013778;
          io.to(viaje.remiseriaId).emit('vehiculo_movido', {
            id: veh?.id || chofer.id,
            choferId: chofer.id,
            patente: veh?.patente || 'Auto Propio',
            chofer: `${chofer.nombre} ${chofer.apellido}`.trim(),
            estado: 'en_viaje',
            ubicacion: {
              lat: Number(veh?.latitud ?? baseLat),
              lng: Number(veh?.longitud ?? baseLng),
            },
            ultimaActualizacion: new Date().toISOString(),
          });
        }
      } catch {}

      res.json({
        success: true,
        data: viajeActualizado,
        message: 'Viaje aceptado exitosamente',
      });
    } catch (error) {
      console.error('Error aceptando viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Rechazar un viaje pendiente o asignado desde la app del chofer
  async rechazarViaje(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const choferId = req.user?.chofer?.id || req.body?.choferId || (await resolverChoferFallbackId());

      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
        include: { chofer: true }
      });

      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      // Registrar el rechazo en el gestor de la Tabla para que pase inmediatamente al siguiente chofer
      if (choferId) {
        let state = ofertasViajesMap.get(viajeId);
        if (!state) {
          state = {
            choferOfertadoId: '',
            motivoOferta: 'TABLA',
            puestoTabla: 1,
            distanciaMetros: null,
            expiraEn: 0,
            rechazadosIds: new Set<string>(),
          };
          ofertasViajesMap.set(viajeId, state);
        }
        state.rechazadosIds.add(choferId);
        if (state.choferOfertadoId === choferId) {
          state.choferOfertadoId = '';
          state.expiraEn = 0;
        }
      }

      // Si el viaje estaba asignado a este chofer pero aún estaba PENDIENTE, liberarlo
      if (viaje.estado === 'PENDIENTE') {
        const viajeLiberado = await prisma.viaje.update({
          where: { id: viajeId },
          data: {
            choferId: null,
            vehiculoId: null
          },
          include: {
            cliente: true,
            chofer: true
          }
        });

        try {
          const { getIO } = await import('../lib/socket');
          const io = getIO();
          if (io && viaje.remiseriaId) {
            io.to(viaje.remiseriaId).emit('viaje_rechazado_por_chofer', {
              viajeId: viaje.id,
              choferId,
              mensaje: `El móvil asignado rechazó el viaje. Ha vuelto a la cola sin asignar.`
            });
            io.to(viaje.remiseriaId).emit('viaje_estado_actualizado', {
              viajeId: viaje.id,
              estado: 'PENDIENTE',
              viaje: viajeLiberado
            });
          }
        } catch (sErr) {
          console.warn('Socket error rechazarViaje:', sErr);
        }
      }

      res.json({ success: true, message: 'Viaje rechazado correctamente' });
    } catch (error) {
      console.error('Error al rechazar viaje:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Actualizar el estado del viaje en curso desde la app del chofer (EN_CAMINO, EN_CURSO, COMPLETADO, CANCELADO)
  async actualizarEstadoViaje(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const { estado, distanciaKmConPasajero, distanciaKmSinPasajero, metodoPago } = req.body;

      const estadosValidos = ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO'];
      if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado de viaje inválido',
        });
      }

      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
      });

      if (!viaje) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado',
        });
      }

      const distCon = distanciaKmConPasajero !== undefined ? parseFloat(distanciaKmConPasajero) : undefined;
      const distSin = distanciaKmSinPasajero !== undefined ? parseFloat(distanciaKmSinPasajero) : undefined;

      const updateData: any = { estado };
      if (distCon !== undefined && !isNaN(distCon)) {
        updateData.distanciaKmConPasajero = distCon;
      }
      if (distSin !== undefined && !isNaN(distSin)) {
        updateData.distanciaKmSinPasajero = distSin;
      }
      if (metodoPago && ['EFECTIVO', 'TRANSFERENCIA'].includes(metodoPago)) {
        updateData.metodoPago = metodoPago;
      }

      // Si el chofer recalcula la tarifa por desvío/km reales recorridos
      if (req.body.precioFinal !== undefined && !isNaN(Number(req.body.precioFinal))) {
        updateData.precio = Math.round(Number(req.body.precioFinal) / 100) * 100;
      }

      // Si el viaje se completa y estaba en espera, finalizar la espera y sumar al precio final redondeado a múltiplos de 100
      if (estado === 'COMPLETADO' && viaje.enEspera && viaje.inicioEsperaActual) {
        const remiseriaObj = await prisma.remiseria.findUnique({ where: { id: viaje.remiseriaId } });
        const valorHora = remiseriaObj?.valorHoraEspera || 12000;
        const delta = Math.max(0, Math.round((new Date().getTime() - new Date(viaje.inicioEsperaActual).getTime()) / 1000));
        const totalSegundos = (viaje.tiempoEsperaSegundos || 0) + delta;
        // Siempre redondear en múltiplos de 100
        const costoEspera = Math.round(((totalSegundos / 3600) * valorHora) / 100) * 100;
        const precioBase = updateData.precio !== undefined 
          ? updateData.precio 
          : Number(viaje.precio) - (Number(viaje.costoEspera) || 0);
        updateData.enEspera = false;
        updateData.inicioEsperaActual = null;
        updateData.tiempoEsperaSegundos = totalSegundos;
        updateData.costoEspera = costoEspera;
        updateData.precio = precioBase + costoEspera;
      }

      const viajeActualizado = await prisma.viaje.update({
        where: { id: viajeId },
        data: updateData,
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              fotoUrl: true,
            },
          },
          chofer: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              fotoUrl: true,
              vehiculo: {
                select: {
                  id: true,
                  patente: true,
                  marca: true,
                  modelo: true,
                  color: true,
                  latitud: true,
                  longitud: true,
                  ultimaUbicacion: true,
                },
              },
            },
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
              color: true,
              latitud: true,
              longitud: true,
              ultimaUbicacion: true,
            },
          },
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
              direccion: true,
              latitud: true,
              longitud: true,
              valorHoraEspera: true,
            },
          },
        },
      });

      if (!viajeActualizado) {
        return res.status(500).json({
          success: false,
          message: 'Error al recuperar el viaje actualizado',
        });
      }

      // Si el viaje se completa o avanza y trae distancias, acumular al turno activo del chofer
      const choferId = viaje.choferId;
      if (choferId && ((distCon && distCon > 0) || (distSin && distSin > 0))) {
        const turnoActivo = await prisma.turnoChofer.findFirst({
          where: { choferId, activo: true },
        });
        if (turnoActivo) {
          const deltaCon = (distCon && distCon > 0) ? distCon : 0;
          const deltaSin = (distSin && distSin > 0) ? distSin : 0;
          await prisma.turnoChofer.update({
            where: { id: turnoActivo.id },
            data: {
              kmConPasajero: { increment: deltaCon },
              kmSinPasajero: { increment: deltaSin },
              kmTotalConectado: { increment: deltaCon + deltaSin },
            },
          });
        }
      }

      // Sistema de Tablas: cuando el chofer finaliza el viaje y queda libre,
      // se lo agrega automáticamente al FINAL de la cola (tabla)
      if (choferId && estado === 'COMPLETADO') {
        ofertasViajesMap.delete(viaje.id);
        await prisma.chofer.update({
          where: { id: choferId },
          data: {
            enParadaVirtual: true,
            paradaVirtualIngreso: new Date(),
          },
        });
      }

      // Si el viaje finalizado es en Cuenta Corriente, sumamos al saldo adeudado del cliente
      if (estado === 'COMPLETADO' && viaje.clienteId && viajeActualizado.metodoPago === 'CUENTA_CORRIENTE') {
        try {
          await prisma.cliente.update({
            where: { id: viaje.clienteId },
            data: {
              saldoCuentaCorriente: {
                increment: Number(viajeActualizado.precio || 0)
              }
            }
          });
        } catch (errCC) {
          console.warn('Aviso incrementando saldo cuenta corriente:', errCC);
        }
      }

      // Emitir evento por socket para notificar al cliente y coordinador en tiempo real
      try {
        const { getIO } = await import('../lib/socket');
        const ioInstance = getIO();
        ioInstance.to(viaje.remiseriaId).emit('viaje_estado_actualizado', {
          viajeId: viaje.id,
          estado,
          mensaje: estado === 'EN_CAMINO' ? '¡El chofer está esperando afuera!' : undefined,
          viaje: viajeActualizado,
        });
        if (estado === 'COMPLETADO') {
          ioInstance.to(viaje.remiseriaId).emit('parada_virtual_actualizada', {
            choferId,
            accion: 'INGRESO_FIN_VIAJE',
          });
        }
      } catch (errSocket) {
        // Sockets opcional
      }

      res.json({
        success: true,
        data: viajeActualizado,
        message: 'Estado del viaje actualizado',
      });
    } catch (error) {
      console.error('Error actualizando estado del viaje del chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Avisar al cliente que el chofer está llegando (a pocas cuadras)
  async avisarLlegando(req: AuthenticatedRequest, res: Response) {
    try {
      const viajeId = req.params.viajeId || req.params.id;
      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
        include: {
          chofer: true,
          vehiculo: true,
          cliente: true,
        },
      });

      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      const choferNombre = viaje.chofer?.nombre || 'El chofer';
      const vehiculo = viaje.vehiculo;
      const autoStr = vehiculo ? ` (${vehiculo.marca} ${vehiculo.modelo} - ${vehiculo.patente})` : '';

      try {
        const { getIO } = await import('../lib/socket');
        const ioInstance = getIO();
        ioInstance.to(viaje.remiseriaId).emit('chofer_llegando', {
          viajeId: viaje.id,
          mensaje: `🚕 ¡${choferNombre}${autoStr} está llegando a tu ubicación! Podés ir preparándote.`,
          choferNombre,
          vehiculo,
          viaje,
        });
      } catch (errSocket) {}

      res.json({
        success: true,
        message: 'Aviso de llegada enviado al cliente',
      });
    } catch (error) {
      console.error('Error al avisar que el chofer está llegando:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Agregar parada intermedia desde la app del chofer (a pedido del pasajero o desvío)
  async agregarParada(req: AuthenticatedRequest, res: Response) {
    try {
      const viajeId = req.params.viajeId || req.params.id;
      const { direccion, lat, lon } = req.body;

      if (!direccion || !direccion.trim()) {
        return res.status(400).json({ success: false, message: 'La dirección de la parada es requerida' });
      }

      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
        include: { remiseria: true, chofer: true, vehiculo: true, cliente: true },
      });

      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      if (!['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO'].includes(viaje.estado)) {
        return res.status(400).json({ success: false, message: 'No se pueden agregar paradas a un viaje finalizado o cancelado' });
      }

      let paradasActuales: any[] = [];
      if (viaje.paradas) {
        try {
          paradasActuales = JSON.parse(viaje.paradas);
          if (!Array.isArray(paradasActuales)) paradasActuales = [];
        } catch {
          paradasActuales = [];
        }
      }

      const nuevaParada = {
        id: `parada-${Date.now()}`,
        direccion: direccion.trim(),
        lat: lat ? parseFloat(lat) : undefined,
        lon: lon ? parseFloat(lon) : undefined,
        completada: false,
        orden: paradasActuales.length + 1,
      };

      paradasActuales.push(nuevaParada);

      let latO: number | undefined;
      let lonO: number | undefined;
      let latD: number | undefined;
      let lonD: number | undefined;

      if (viaje.origenDetallado && viaje.origenDetallado.includes(',')) {
        const parts = viaje.origenDetallado.split(',');
        latO = parseFloat(parts[0]);
        lonO = parseFloat(parts[1]);
      }
      if (viaje.destinoDetallado && viaje.destinoDetallado.includes(',')) {
        const parts = viaje.destinoDetallado.split(',');
        latD = parseFloat(parts[0]);
        lonD = parseFloat(parts[1]);
      }

      const { calcularPrecioViaje } = await import('./clienteController');
      const remiseria = viaje.remiseria || (await prisma.remiseria.findFirst());
      const valorKm = remiseria?.valorKm || 1200;
      const precioBaseAnterior = Number(viaje.precio) - (Number(viaje.costoEspera) || 0);

      const cotizacion = await calcularPrecioViaje(
        viaje.origen,
        viaje.destino,
        latO,
        lonO,
        latD,
        lonD,
        paradasActuales
      );

      const costoParadaAdicional = Math.round((valorKm * 1.5) / 100) * 100;
      const nuevoPrecioBase = Math.max(cotizacion.precio, precioBaseAnterior + costoParadaAdicional);
      const precioFinal = Math.round((nuevoPrecioBase + (viaje.costoEspera || 0)) / 100) * 100;

      const updatedViaje = await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          paradas: JSON.stringify(paradasActuales),
          precio: precioFinal,
        },
        include: {
          chofer: true,
          vehiculo: true,
          cliente: true,
        },
      });

      try {
        const { getIO, invalidarChoferCache } = await import('../lib/socket');
        if (updatedViaje.choferId) invalidarChoferCache(updatedViaje.choferId);
        const io = getIO();
        io.to(viaje.remiseriaId).emit('parada_agregada', {
          viajeId,
          nuevaParada,
          paradas: paradasActuales,
          nuevoPrecio: precioFinal,
          viaje: updatedViaje,
        });
      } catch {}

      res.json({
        success: true,
        data: updatedViaje,
        message: 'Parada intermedia agregada exitosamente',
      });
    } catch (error) {
      console.error('Error al agregar parada desde chofer:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Control de Espera (Iniciar / Pausar espera con recargo dinámico)
  async controlarEspera(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const { accion } = req.body; // 'INICIAR' | 'PAUSAR'

      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
        include: { remiseria: true },
      });

      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      const valorHoraEspera = viaje.remiseria?.valorHoraEspera || 12000;
      let nuevoTiempoEspera = viaje.tiempoEsperaSegundos || 0;
      let enEspera = viaje.enEspera;
      let inicioEsperaActual = viaje.inicioEsperaActual;

      if (accion === 'INICIAR') {
        enEspera = true;
        inicioEsperaActual = new Date();
      } else if (accion === 'PAUSAR') {
        if (enEspera && inicioEsperaActual) {
          const deltaSegundos = Math.max(
            0,
            Math.round((new Date().getTime() - new Date(inicioEsperaActual).getTime()) / 1000)
          );
          nuevoTiempoEspera += deltaSegundos;
        }
        enEspera = false;
        inicioEsperaActual = null;
      }

      // Redondear siempre en múltiplos de 100
      const costoEspera = Math.round(((nuevoTiempoEspera / 3600) * valorHoraEspera) / 100) * 100;
      const precioBase = Number(viaje.precio) - (Number(viaje.costoEspera) || 0);
      const precioTotal = precioBase + costoEspera;

      const updatedViaje = await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          enEspera,
          inicioEsperaActual,
          tiempoEsperaSegundos: nuevoTiempoEspera,
          costoEspera,
          precio: precioTotal,
        },
      });

      try {
        const { getIO } = await import('../lib/socket');
        const ioInstance = getIO();
        ioInstance.to(viaje.remiseriaId).emit('espera_actualizada', {
          viajeId,
          enEspera,
          inicioEsperaActual,
          tiempoEsperaSegundos: nuevoTiempoEspera,
          costoEspera,
          valorHoraEspera,
          nuevoPrecio: precioTotal,
          viaje: updatedViaje,
        });
      } catch (errSocket) {}

      res.json({
        success: true,
        data: {
          enEspera,
          inicioEsperaActual,
          tiempoEsperaSegundos: nuevoTiempoEspera,
          costoEspera,
          precioTotal,
        },
        message: accion === 'INICIAR' ? 'Espera iniciada' : 'Espera pausada',
      });
    } catch (error) {
      console.error('Error al controlar espera del viaje:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Enviar mensaje de chat desde la app del chofer
  async enviarMensajeChat(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const { texto } = req.body;

      if (!texto || !texto.trim()) {
        return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío' });
      }

      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
        include: { chofer: true },
      });

      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      if (!['PENDIENTE', 'ACEPTADO', 'EN_CAMINO'].includes(viaje.estado)) {
        return res.status(400).json({
          success: false,
          message: 'El chat solo está disponible antes de iniciar el viaje.',
        });
      }

      let historial: any[] = [];
      if (viaje.mensajesChat) {
        try {
          historial = JSON.parse(viaje.mensajesChat);
          if (!Array.isArray(historial)) historial = [];
        } catch {
          historial = [];
        }
      }

      const nombreChofer = viaje.chofer
        ? `${viaje.chofer.nombre} ${viaje.chofer.apellido || ''}`.trim()
        : 'Chofer';
      const nuevoMensaje = {
        id: `msg-${Date.now()}`,
        remitente: 'CHOFER',
        remitenteNombre: nombreChofer,
        texto: texto.trim(),
        timestamp: new Date().toISOString(),
      };

      historial.push(nuevoMensaje);

      await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          mensajesChat: JSON.stringify(historial),
        },
      });

      try {
        const { getIO } = await import('../lib/socket');
        const ioInstance = getIO();
        ioInstance.to(viaje.remiseriaId).emit('mensaje_chat_recibido', {
          viajeId,
          mensaje: nuevoMensaje,
        });
      } catch (errSocket) {}

      res.json({
        success: true,
        data: nuevoMensaje,
        message: 'Mensaje enviado',
      });
    } catch (error) {
      console.error('Error al enviar chat del chofer:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Obtener historial de viajes del chofer
  async getMisViajes(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || (req.query.choferId as string | undefined);

      if (!choferId && req.user?.id) {
        const choferByUser = await prisma.chofer.findFirst({
          where: { userId: req.user.id },
        });
        if (choferByUser) choferId = choferByUser.id;
      }

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      const { fecha, desde, hasta } = req.query;
      const whereClause: any = { choferId };

      if (fecha && typeof fecha === 'string') {
        const parts = fecha.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
          const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
          whereClause.fecha = { gte: startOfDay, lte: endOfDay };
        }
      } else if (desde || hasta) {
        whereClause.fecha = {};
        if (desde && typeof desde === 'string') {
          const parts = desde.split('-');
          whereClause.fecha.gte =
            parts.length === 3
              ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0)
              : new Date(desde);
        }
        if (hasta && typeof hasta === 'string') {
          const parts = hasta.split('-');
          whereClause.fecha.lte =
            parts.length === 3
              ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999)
              : new Date(hasta);
        }
      }

      const viajes = await prisma.viaje.findMany({
        where: whereClause,
        include: {
          cliente: {
            select: {
              nombre: true,
              apellido: true,
              telefono: true,
              fotoUrl: true,
            },
          },
          vehiculo: {
            select: {
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
        orderBy: {
          fecha: 'desc',
        },
      });

      res.json({
        success: true,
        data: viajes,
      });
    } catch (error) {
      console.error('Error obteniendo viajes del chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener historial de turnos del chofer (con métricas y vehículo)
  async getMisTurnos(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || (req.query.choferId as string | undefined);

      if (!choferId && req.user?.id) {
        const choferByUser = await prisma.chofer.findFirst({
          where: { userId: req.user.id },
        });
        if (choferByUser) choferId = choferByUser.id;
      }

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      const { fecha, desde, hasta } = req.query;
      const whereClause: any = { choferId };

      if (fecha && typeof fecha === 'string') {
        const parts = fecha.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
          const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
          whereClause.OR = [
            { fechaInicio: { gte: startOfDay, lte: endOfDay } },
            { fechaFin: { gte: startOfDay, lte: endOfDay } },
            { activo: true, fechaInicio: { lte: endOfDay } },
          ];
        }
      } else if (desde || hasta) {
        let dDate: Date | null = null;
        let hDate: Date | null = null;

        if (desde && typeof desde === 'string') {
          const parts = desde.split('-');
          dDate =
            parts.length === 3
              ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0)
              : new Date(desde);
        }
        if (hasta && typeof hasta === 'string') {
          const parts = hasta.split('-');
          hDate =
            parts.length === 3
              ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999)
              : new Date(hasta);
        }

        if (dDate && hDate) {
          whereClause.OR = [
            { fechaInicio: { gte: dDate, lte: hDate } },
            { fechaFin: { gte: dDate, lte: hDate } },
            { activo: true, fechaInicio: { lte: hDate } },
          ];
        } else if (dDate) {
          whereClause.OR = [
            { fechaInicio: { gte: dDate } },
            { fechaFin: { gte: dDate } },
            { activo: true },
          ];
        } else if (hDate) {
          whereClause.fechaInicio = { lte: hDate };
        }
      }

      const turnos = await prisma.turnoChofer.findMany({
        where: whereClause,
        include: {
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
              color: true,
            },
          },
        },
        orderBy: {
          fechaInicio: 'desc',
        },
      });

      res.json({
        success: true,
        data: turnos,
      });
    } catch (error) {
      console.error('Error obteniendo turnos del chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // ==========================================
  // TURNOS Y TRACKING DE KILOMETRAJE
  // ==========================================

  // Obtener el turno activo actual del chofer
  async getTurnoActivo(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || (req.query.choferId as string | undefined);

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      const turnoActivo = await prisma.turnoChofer.findFirst({
        where: { choferId, activo: true },
        include: {
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
        orderBy: { fechaInicio: 'desc' },
      });

      res.json({
        success: true,
        data: turnoActivo,
      });
    } catch (error) {
      console.error('Error al obtener turno activo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Iniciar manualmente un turno de trabajo
  async iniciarTurno(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || req.body?.choferId;
      const { odometroInicio, observaciones } = req.body;

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(401).json({
          success: false,
          message: 'No se pudo identificar al chofer',
        });
      }

      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Si ya hay un turno activo, lo retornamos
      let turno = await prisma.turnoChofer.findFirst({
        where: { choferId, activo: true },
      });

      if (!turno) {
        const odoVal = odometroInicio !== undefined ? parseFloat(odometroInicio) : null;
        turno = await prisma.turnoChofer.create({
          data: {
            choferId,
            vehiculoId: chofer.vehiculoId || null,
            activo: true,
            odometroInicio: odoVal !== null && !isNaN(odoVal) ? odoVal : null,
            observaciones,
          },
        });
      }

      // Asegurar que el chofer quede en estado online
      await prisma.chofer.update({
        where: { id: choferId },
        data: { isOnline: true },
      });

      res.json({
        success: true,
        data: turno,
        message: 'Turno iniciado correctamente',
      });
    } catch (error) {
      console.error('Error al iniciar turno:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Finalizar el turno activo del chofer con cálculo de Arqueo de Caja
  async finalizarTurno(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || req.body?.choferId;
      const { odometroFin, observaciones } = req.body;

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(401).json({
          success: false,
          message: 'No se pudo identificar al chofer',
        });
      }

      const turnosActivos = await prisma.turnoChofer.findMany({
        where: { choferId, activo: true },
      });

      const odoVal = odometroFin !== undefined ? parseFloat(odometroFin) : null;
      let ultimoTurnoId: string | undefined = undefined;

      for (const t of turnosActivos) {
        ultimoTurnoId = t.id;
        await prisma.turnoChofer.update({
          where: { id: t.id },
          data: {
            activo: false,
            fechaFin: new Date(),
            odometroFin: odoVal !== null && !isNaN(odoVal) ? odoVal : null,
            observaciones: observaciones || t.observaciones,
          },
        });
      }

      // Desconectar al chofer y quitarlo de parada virtual
      await prisma.chofer.update({
        where: { id: choferId },
        data: {
          isOnline: false,
          enParadaVirtual: false,
          paradaVirtualIngreso: null,
        },
      });

      // Calcular Arqueo de Cierre del Turno finalizado
      const resumenCierre = await choferController.calcularArqueoInterno(choferId, ultimoTurnoId);

      res.json({
        success: true,
        message: 'Turno finalizado correctamente',
        data: {
          resumenCierre,
        },
      });
    } catch (error) {
      console.error('Error al finalizar turno:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Actualizar kilometraje acumulado en tiempo real en el turno activo
  async actualizarKmTurno(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || req.body?.choferId;
      const { kmConPasajeroDelta, kmSinPasajeroDelta } = req.body;

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(401).json({
          success: false,
          message: 'No se pudo identificar al chofer',
        });
      }

      let turnoActivo = await prisma.turnoChofer.findFirst({
        where: { choferId, activo: true },
        orderBy: { fechaInicio: 'desc' },
      });

      if (!turnoActivo) {
        // Si no tiene turno activo pero está sumando km, creamos uno
        const chofer = await prisma.chofer.findUnique({ where: { id: choferId } });
        turnoActivo = await prisma.turnoChofer.create({
          data: {
            choferId,
            vehiculoId: chofer?.vehiculoId || null,
            activo: true,
          },
        });
      }

      const deltaCon = kmConPasajeroDelta ? Math.max(0, parseFloat(kmConPasajeroDelta)) : 0;
      const deltaSin = kmSinPasajeroDelta ? Math.max(0, parseFloat(kmSinPasajeroDelta)) : 0;
      const deltaTotal = deltaCon + deltaSin;

      if (deltaTotal > 0) {
        turnoActivo = await prisma.turnoChofer.update({
          where: { id: turnoActivo.id },
          data: {
            kmConPasajero: { increment: deltaCon },
            kmSinPasajero: { increment: deltaSin },
            kmTotalConectado: { increment: deltaTotal },
          },
        });
      }

      res.json({
        success: true,
        data: turnoActivo,
      });
    } catch (error) {
      console.error('Error al actualizar km del turno:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // ==========================================
  // GASTOS DEL CHOFER (COMBUSTIBLE, REPARACIONES, ETC.)
  // ==========================================

  // Listar gastos cargados por el chofer
  async getMisGastos(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || (req.query.choferId as string | undefined);

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      const { tipo, subtipoCombustible, fechaDesde, fechaHasta } = req.query;
      let whereClause: any = { choferId };

      if (tipo && typeof tipo === 'string' && tipo !== 'TODOS') {
        if (tipo === 'NAFTA_GASOIL') {
          whereClause.tipo = 'COMBUSTIBLE';
          whereClause.subtipoCombustible = 'NAFTA_GASOIL';
        } else if (tipo === 'GNC') {
          whereClause.tipo = 'COMBUSTIBLE';
          whereClause.subtipoCombustible = 'GNC';
        } else {
          whereClause.tipo = tipo;
        }
      }

      if (subtipoCombustible && typeof subtipoCombustible === 'string') {
        whereClause.subtipoCombustible = subtipoCombustible;
      }

      if (fechaDesde || fechaHasta) {
        whereClause.fecha = {};
        if (fechaDesde) whereClause.fecha.gte = new Date(fechaDesde as string);
        if (fechaHasta) whereClause.fecha.lte = new Date(fechaHasta as string);
      }

      const gastos = await prisma.gastoChofer.findMany({
        where: whereClause,
        include: {
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
        orderBy: { fecha: 'desc' },
      });

      res.json({
        success: true,
        data: gastos,
      });
    } catch (error) {
      console.error('Error al obtener gastos del chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Registrar un nuevo gasto
  async crearGasto(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || req.body?.choferId;
      const { tipo, subtipoCombustible, monto, kilometraje, litros, descripcion, comprobanteUrl, fecha } = req.body;

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(401).json({
          success: false,
          message: 'No se pudo identificar al chofer',
        });
      }

      const tiposValidos = ['COMBUSTIBLE', 'REPARACION', 'MANTENIMIENTO', 'PEAJE', 'LAVADO', 'OTRO'];
      if (!tipo || !tiposValidos.includes(tipo)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de gasto inválido',
        });
      }

      const montoFloat = parseFloat(monto);
      if (isNaN(montoFloat) || montoFloat <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El monto debe ser un número mayor a 0',
        });
      }

      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
        select: { id: true, vehiculoId: true },
      });

      const kmFloat = kilometraje !== undefined && kilometraje !== '' ? parseFloat(kilometraje) : null;
      const litrosFloat = litros !== undefined && litros !== '' ? parseFloat(litros) : null;

      let subTipoVal: 'NAFTA_GASOIL' | 'GNC' | null = null;
      if (tipo === 'COMBUSTIBLE') {
        subTipoVal = subtipoCombustible === 'GNC' ? 'GNC' : 'NAFTA_GASOIL';
      }

      const gasto = await prisma.gastoChofer.create({
        data: {
          choferId,
          vehiculoId: chofer?.vehiculoId || null,
          tipo,
          subtipoCombustible: subTipoVal,
          monto: montoFloat,
          kilometraje: kmFloat !== null && !isNaN(kmFloat) ? kmFloat : null,
          litros: litrosFloat !== null && !isNaN(litrosFloat) ? litrosFloat : null,
          descripcion: descripcion || null,
          comprobanteUrl: comprobanteUrl || null,
          fecha: fecha ? new Date(fecha) : new Date(),
        },
        include: {
          vehiculo: {
            select: {
              patente: true,
              marca: true,
              modelo: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: gasto,
        message: 'Gasto registrado correctamente',
      });
    } catch (error) {
      console.error('Error al crear gasto del chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Eliminar un gasto
  async eliminarGasto(req: AuthenticatedRequest, res: Response) {
    try {
      const { gastoId } = req.params;
      let choferId = req.user?.chofer?.id || (req.query.choferId as string | undefined);

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      const gasto = await prisma.gastoChofer.findUnique({
        where: { id: gastoId },
      });

      if (!gasto) {
        return res.status(404).json({
          success: false,
          message: 'Gasto no encontrado',
        });
      }

      // Validar que pertenezca al chofer si no es DUENIO/ADMIN
      if (req.user?.rol === 'CHOFER' && gasto.choferId !== choferId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar este gasto',
        });
      }

      await prisma.gastoChofer.delete({
        where: { id: gastoId },
      });

      res.json({
        success: true,
        message: 'Gasto eliminado exitosamente',
      });
    } catch (error) {
      console.error('Error al eliminar gasto:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Resumen financiero y de métricas (Recaudación, Gastos, Ganancia Neta y Rendimiento Km)
  async getResumenFinanciero(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || (req.query.choferId as string | undefined);

      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { estado: 'ACTIVO' },
        });
        choferId = fallbackChofer?.id;
      }

      if (!choferId) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Rango de fechas: por defecto mes actual
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);

      const fechaDesde = req.query.fechaDesde ? new Date(req.query.fechaDesde as string) : inicioMes;
      const fechaHasta = req.query.fechaHasta ? new Date(req.query.fechaHasta as string) : finMes;

      // 1. Viajes completados en el período
      const viajes = await prisma.viaje.findMany({
        where: {
          choferId,
          estado: 'COMPLETADO',
          fecha: {
            gte: fechaDesde,
            lte: fechaHasta,
          },
        },
      });

      const totalRecaudado = viajes.reduce((sum, v) => sum + Number(v.precio || 0), 0);
      const comisionPorcentaje = chofer.comisionPorcentaje || 30;
      const gananciaChoferEstimada = (totalRecaudado * (100 - comisionPorcentaje)) / 100;

      // 2. Gastos en el período
      const gastos = await prisma.gastoChofer.findMany({
        where: {
          choferId,
          fecha: {
            gte: fechaDesde,
            lte: fechaHasta,
          },
        },
      });

      let totalCombustible = 0;
      let totalNaftaGasoil = 0;
      let totalLitrosNaftaGasoil = 0;
      let totalGNC = 0;
      let totalM3GNC = 0;
      let totalReparaciones = 0;
      let totalMantenimiento = 0;
      let totalOtros = 0;

      for (const g of gastos) {
        if (g.tipo === 'COMBUSTIBLE') {
          totalCombustible += g.monto;
          if (g.subtipoCombustible === 'GNC') {
            totalGNC += g.monto;
            if (g.litros) totalM3GNC += g.litros;
          } else {
            totalNaftaGasoil += g.monto;
            if (g.litros) totalLitrosNaftaGasoil += g.litros;
          }
        } else if (g.tipo === 'REPARACION') {
          totalReparaciones += g.monto;
        } else if (g.tipo === 'MANTENIMIENTO') {
          totalMantenimiento += g.monto;
        } else {
          totalOtros += g.monto;
        }
      }

      const totalGastos = totalCombustible + totalReparaciones + totalMantenimiento + totalOtros;
      const gananciaNetaReal = gananciaChoferEstimada - totalGastos;

      // 3. Turnos y Kilómetros en el período
      const turnos = await prisma.turnoChofer.findMany({
        where: {
          choferId,
          fechaInicio: {
            gte: fechaDesde,
            lte: fechaHasta,
          },
        },
      });

      const kmTotalConectado = turnos.reduce((sum, t) => sum + (t.kmTotalConectado || 0), 0);
      const kmConPasajero = turnos.reduce((sum, t) => sum + (t.kmConPasajero || 0), 0);
      const kmSinPasajero = turnos.reduce((sum, t) => sum + (t.kmSinPasajero || 0), 0);

      // Costo por kilómetro
      const costoPorKm = kmTotalConectado > 0 ? totalGastos / kmTotalConectado : 0;
      const totalVolumenCombustible = totalLitrosNaftaGasoil + totalM3GNC;
      const rendimientoCombustibleKmPorUnidad =
        totalVolumenCombustible > 0 && kmTotalConectado > 0
          ? kmTotalConectado / totalVolumenCombustible
          : null;

      res.json({
        success: true,
        data: {
          periodo: {
            desde: fechaDesde,
            hasta: fechaHasta,
          },
          ingresos: {
            totalViajes: viajes.length,
            totalRecaudado,
            gananciaChoferEstimada,
            comisionPorcentaje,
          },
          gastos: {
            totalGastos,
            totalCombustible,
            totalNaftaGasoil,
            totalLitrosNaftaGasoil,
            totalGNC,
            totalM3GNC,
            totalReparaciones,
            totalMantenimiento,
            totalOtros,
            cantidadRegistros: gastos.length,
          },
          balance: {
            gananciaNetaReal,
          },
          kilometraje: {
            kmTotalConectado: Number(kmTotalConectado.toFixed(1)),
            kmConPasajero: Number(kmConPasajero.toFixed(1)),
            kmSinPasajero: Number(kmSinPasajero.toFixed(1)),
            porcentajeOcupado:
              kmTotalConectado > 0
                ? Number(((kmConPasajero / kmTotalConectado) * 100).toFixed(1))
                : 0,
            costoPorKm: Number(costoPorKm.toFixed(2)),
            rendimientoKmPorLitro: rendimientoCombustibleKmPorUnidad
              ? Number(rendimientoCombustibleKmPorUnidad.toFixed(2))
              : null,
          },
        },
      });
    } catch (error) {
      console.error('Error al obtener resumen financiero del chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // ==========================================
  // AUTO-REGISTRO Y APROBACIÓN DE CHOFERES
  // ==========================================

  // Registro público para que un chofer cree su propia cuenta (queda PENDIENTE_APROBACION)
  async registroPublico(req: any, res: Response) {
    try {
      const {
        nombre,
        apellido,
        dni,
        telefono,
        email,
        password,
        direccion,
        categoriaLicencia,
        vtoLicencia,
        remiseriaId,
        esPropietario,
        observaciones,
        fotoUrl,
      } = req.body;

      // Validar campos obligatorios
      // Si no se proporcionó remiseriaId, asignar la remisería activa (Remises Bruno)
      let targetRemiseriaId = remiseriaId;
      if (!targetRemiseriaId) {
        const activeRem = await prisma.remiseria.findFirst({ where: { estado: true } });
        targetRemiseriaId = activeRem?.id;
      }

      if (
        !nombre ||
        !apellido ||
        !dni ||
        !telefono ||
        !email ||
        !password ||
        !categoriaLicencia ||
        !vtoLicencia ||
        !targetRemiseriaId
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Todos los campos obligatorios deben completarse (Nombre, Apellido, DNI, Teléfono, Email, Contraseña, Categoría y Vencimiento de Licencia).',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres.',
        });
      }

      // Verificar que el email no exista en User
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'El correo electrónico ya se encuentra registrado en el sistema.',
        });
      }

      // Verificar que el DNI no exista en Chofer
      const existingChoferDni = await prisma.chofer.findUnique({
        where: { dni: dni.trim() },
      });
      if (existingChoferDni) {
        return res.status(400).json({
          success: false,
          message: 'El DNI ya se encuentra registrado en el sistema.',
        });
      }

      // Verificar que la remisería exista y esté activa
      const remiseria = await prisma.remiseria.findUnique({
        where: { id: targetRemiseriaId },
      });
      if (!remiseria || !remiseria.estado) {
        return res.status(400).json({
          success: false,
          message: 'La remisería seleccionada no está disponible o no existe.',
        });
      }

      // Generar número de chofer único
      const count = await prisma.chofer.count({ where: { remiseriaId } });
      let numeroChofer = `CH-${String(count + 1).padStart(3, '0')}`;
      let existeNum = await prisma.chofer.findUnique({ where: { numeroChofer } });
      if (existeNum) {
        numeroChofer = `CH-${Date.now().toString().slice(-4)}`;
      }

      // Encriptar contraseña
      const passwordHash = await bcrypt.hash(password, 10);

      // Transacción para crear User y Chofer
      const resultado = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: email.toLowerCase().trim(),
            passwordHash,
            rol: 'CHOFER',
            activo: true, // Puede loguearse para ver su estado
          },
        });

        const chofer = await tx.chofer.create({
          data: {
            userId: user.id,
            remiseriaId,
            numeroChofer,
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            dni: dni.trim(),
            telefono: telefono.trim(),
            email: email.toLowerCase().trim(),
            direccion: direccion ? direccion.trim() : null,
            categoriaLicencia: categoriaLicencia.trim(),
            vtoLicencia: new Date(vtoLicencia),
            esPropietario: Boolean(esPropietario),
            comisionPorcentaje: remiseria.comisionPorcentaje || 30.0,
            observaciones: observaciones ? observaciones.trim() : null,
            fotoUrl: fotoUrl || null,
            estado: 'PENDIENTE_APROBACION',
            isOnline: false,
          },
          include: {
            remiseria: {
              select: {
                id: true,
                nombreFantasia: true,
              },
            },
          },
        });

        return { user, chofer };
      });

      res.status(201).json({
        success: true,
        data: resultado.chofer,
        message:
          '¡Solicitud enviada con éxito! El dueño de la remisería revisará tu documentación y te habilitará para comenzar a operar.',
      });
    } catch (error) {
      console.error('Error en registro público de chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al procesar el registro.',
      });
    }
  },

  // Obtener remiserías activas para el select del registro público de choferes
  async getRemiseriasDisponibles(req: any, res: Response) {
    try {
      const remiserias = await prisma.remiseria.findMany({
        where: { estado: true },
        select: {
          id: true,
          nombreFantasia: true,
          direccion: true,
          telefono: true,
        },
        orderBy: { nombreFantasia: 'asc' },
      });

      res.json({
        success: true,
        data: remiserias,
      });
    } catch (error) {
      console.error('Error al obtener remiserías disponibles:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Aprobar chofer por parte del Dueño o Coordinador
  async aprobarChofer(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { comisionPorcentaje, vehiculoId, numeroChofer } = req.body;
      const { rol, id: userId } = req.user!;

      const chofer = await prisma.chofer.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Validar permisos del dueño/coordinador sobre esta remisería
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } },
        });
        const remiseriaIds = duenio?.remiserias.map((r) => r.remiseriaId) || [];
        if (!remiseriaIds.includes(chofer.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos sobre esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId },
        });
        if (coordinador?.remiseriaId !== chofer.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos sobre esta remisería',
          });
        }
      }

      const updateData: any = {
        estado: 'ACTIVO',
        motivoRechazo: null,
      };

      if (comisionPorcentaje !== undefined && !isNaN(parseFloat(comisionPorcentaje))) {
        updateData.comisionPorcentaje = parseFloat(comisionPorcentaje);
      }
      if (vehiculoId !== undefined) {
        updateData.vehiculoId = vehiculoId || null;
      }
      if (numeroChofer && numeroChofer.trim()) {
        updateData.numeroChofer = numeroChofer.trim();
      }

      const updatedChofer = await prisma.chofer.update({
        where: { id },
        data: updateData,
        include: {
          remiseria: { select: { nombreFantasia: true } },
          vehiculo: { select: { patente: true, marca: true, modelo: true } },
        },
      });

      // Asegurar que el usuario esté activo
      if (chofer.userId) {
        await prisma.user.update({
          where: { id: chofer.userId },
          data: { activo: true },
        });
      }

      res.json({
        success: true,
        data: updatedChofer,
        message: `Chofer ${updatedChofer.nombre} ${updatedChofer.apellido} aprobado exitosamente.`,
      });
    } catch (error) {
      console.error('Error al aprobar chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al aprobar chofer',
      });
    }
  },

  // Rechazar chofer por parte del Dueño o Coordinador
  async rechazarChofer(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { motivoRechazo } = req.body;
      const { rol, id: userId } = req.user!;

      const chofer = await prisma.chofer.findUnique({
        where: { id },
      });

      if (!chofer) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      // Validar permisos
      if (rol === 'DUENIO') {
        const duenio = await prisma.duenio.findUnique({
          where: { userId },
          include: { remiserias: { select: { remiseriaId: true } } },
        });
        const remiseriaIds = duenio?.remiserias.map((r) => r.remiseriaId) || [];
        if (!remiseriaIds.includes(chofer.remiseriaId)) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos sobre esta remisería',
          });
        }
      } else if (rol === 'COORDINADOR') {
        const coordinador = await prisma.coordinador.findFirst({
          where: { userId },
        });
        if (coordinador?.remiseriaId !== chofer.remiseriaId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos sobre esta remisería',
          });
        }
      }

      const updatedChofer = await prisma.chofer.update({
        where: { id },
        data: {
          estado: 'RECHAZADO',
          motivoRechazo: motivoRechazo || 'Solicitud rechazada por la administración de la remisería',
          isOnline: false,
        },
      });

      res.json({
        success: true,
        data: updatedChofer,
        message: `Solicitud de chofer rechazada.`,
      });
    } catch (error) {
      console.error('Error al rechazar chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor al rechazar chofer',
      });
    }
  },

  // Obtener vehículos disponibles para que el chofer pueda seleccionar/cambiar su unidad
  async getVehiculosDisponibles(req: AuthenticatedRequest, res: Response) {
    try {
      const { chofer, rol, id: userId } = req.user!;
      let remiseriaId = chofer?.remiseriaId;

      if (!remiseriaId) {
        if (rol === 'CHOFER') {
          const ch = await prisma.chofer.findFirst({ where: { userId } });
          remiseriaId = ch?.remiseriaId;
        }
      }

      if (!remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo determinar la remisería del chofer',
        });
      }

      const vehiculos = await prisma.vehiculo.findMany({
        where: {
          remiseriaId,
          estado: 'ACTIVO',
        },
        select: {
          id: true,
          patente: true,
          marca: true,
          modelo: true,
          anio: true,
          color: true,
          tipo: true,
          capacidad: true,
          estado: true,
        },
        orderBy: {
          patente: 'asc',
        },
      });

      res.json({
        success: true,
        data: vehiculos,
      });
    } catch (error) {
      console.error('Error al obtener vehículos disponibles para chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Permitir al chofer actualizar su perfil (vehículo asignado, foto de perfil)
  async updateMiPerfil(req: AuthenticatedRequest, res: Response) {
    try {
      const { chofer: reqChofer, id: userId } = req.user!;
      const { vehiculoId, fotoUrl } = req.body;

      let choferId = reqChofer?.id;
      if (!choferId) {
        const ch = await prisma.chofer.findFirst({ where: { userId } });
        choferId = ch?.id;
      }

      if (!choferId) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      const choferActual = await prisma.chofer.findUnique({
        where: { id: choferId },
        include: { vehiculo: true },
      });

      if (!choferActual) {
        return res.status(404).json({
          success: false,
          message: 'Chofer no encontrado',
        });
      }

      const dataToUpdate: any = {};

      if (vehiculoId !== undefined) {
        if (vehiculoId === null || vehiculoId === '') {
          dataToUpdate.vehiculoId = null;
        } else {
          const vehiculo = await prisma.vehiculo.findFirst({
            where: {
              id: vehiculoId,
              remiseriaId: choferActual.remiseriaId,
            },
          });

          if (!vehiculo) {
            return res.status(400).json({
              success: false,
              message: 'El vehículo seleccionado no es válido para su agencia',
            });
          }

          dataToUpdate.vehiculoId = vehiculoId;
        }
      }

      if (fotoUrl !== undefined) {
        dataToUpdate.fotoUrl = fotoUrl;
      }

      const choferActualizado = await prisma.chofer.update({
        where: { id: choferId },
        data: dataToUpdate,
        include: {
          vehiculo: true,
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
              direccion: true,
              latitud: true,
              longitud: true,
            },
          },
        },
      });

      // Si cambió de vehículo y tiene un turno activo, actualizar también el turno activo
      if (vehiculoId !== undefined) {
        await prisma.turnoChofer.updateMany({
          where: { choferId, activo: true },
          data: { vehiculoId: dataToUpdate.vehiculoId || null },
        });

        // Y si tiene un viaje en curso o aceptado, actualizar también el vehículo del viaje
        await prisma.viaje.updateMany({
          where: {
            choferId,
            estado: { in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] },
          },
          data: { vehiculoId: dataToUpdate.vehiculoId || null },
        });
      }

      res.json({
        success: true,
        data: choferActualizado,
        message: 'Perfil de chofer actualizado correctamente',
      });
    } catch (error) {
      console.error('Error actualizando perfil del chofer:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Helper interno para cálculo de Arqueo y Cierre de Turno
  async calcularArqueoInterno(choferId: string, turnoId?: string) {
    const chofer = await prisma.chofer.findUnique({
      where: { id: choferId },
      include: { remiseria: true, vehiculo: true },
    });
    if (!chofer) return null;

    let turno = null;
    if (turnoId) {
      turno = await prisma.turnoChofer.findUnique({
        where: { id: turnoId },
        include: { vehiculo: true },
      });
    }
    if (!turno) {
      turno = await prisma.turnoChofer.findFirst({
        where: { choferId, activo: true },
        orderBy: { fechaInicio: 'desc' },
        include: { vehiculo: true },
      });
    }
    if (!turno) {
      turno = await prisma.turnoChofer.findFirst({
        where: { choferId },
        orderBy: { fechaInicio: 'desc' },
        include: { vehiculo: true },
      });
    }

    const inicioTurno = turno?.fechaInicio || new Date(new Date().setHours(0, 0, 0, 0));
    const finTurno = turno?.fechaFin || new Date();

    const viajes = await prisma.viaje.findMany({
      where: {
        choferId,
        estado: 'COMPLETADO',
        fecha: { gte: inicioTurno, lte: finTurno },
      },
      orderBy: { fecha: 'asc' },
    });

    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalOtros = 0;

    for (const v of viajes) {
      const monto = Number(v.precio || 0);
      if (v.metodoPago === 'EFECTIVO') {
        totalEfectivo += monto;
      } else if (v.metodoPago === 'TRANSFERENCIA') {
        totalTransferencia += monto;
      } else {
        totalOtros += monto;
      }
    }

    const totalBruto = totalEfectivo + totalTransferencia + totalOtros;

    const gastos = await prisma.gastoChofer.findMany({
      where: {
        choferId,
        fecha: { gte: inicioTurno, lte: finTurno },
      },
      orderBy: { fecha: 'desc' },
    });

    const totalGastos = gastos.reduce((sum, g) => sum + Number(g.monto || 0), 0);
    const comisionPorcentaje = Number(chofer.comisionPorcentaje || chofer.remiseria?.comisionPorcentaje || 20);
    const comisionRemiseria = (totalBruto * comisionPorcentaje) / 100;
    const gananciaNetaChofer = totalBruto - comisionRemiseria - totalGastos;
    const saldoEfectivoEnMano = totalEfectivo - totalGastos;
    const aRendirCentral = comisionRemiseria;

    return {
      turno: {
        id: turno?.id || 'sin-turno',
        activo: turno?.activo ?? false,
        fechaInicio: inicioTurno,
        fechaFin: turno?.fechaFin || null,
        kmTotalConectado: Number((turno?.kmTotalConectado || 0).toFixed(1)),
        kmConPasajero: Number((turno?.kmConPasajero || 0).toFixed(1)),
        kmSinPasajero: Number((turno?.kmSinPasajero || 0).toFixed(1)),
        odometroInicio: turno?.odometroInicio || null,
        odometroFin: turno?.odometroFin || null,
      },
      viajes: {
        total: viajes.length,
        totalEfectivo,
        totalTransferencia,
        totalOtros,
        totalBruto,
        lista: viajes.map((v) => ({
          id: v.id,
          origen: v.origen,
          destino: v.destino,
          precio: Number(v.precio),
          metodoPago: v.metodoPago,
          fecha: v.fecha,
          esViajeCalle: v.esViajeCalle,
        })),
      },
      gastos: {
        total: totalGastos,
        items: gastos.map((g) => ({
          id: g.id,
          tipo: g.tipo,
          monto: Number(g.monto),
          descripcion: g.descripcion,
          fecha: g.fecha,
        })),
      },
      liquidacion: {
        comisionPorcentaje,
        comisionRemiseria,
        gananciaNetaChofer,
        saldoEfectivoEnMano,
        aRendirCentral,
      },
    };
  },

  // Obtener Resumen de Arqueo y Cierre de Turno del Chofer
  async getResumenCierreTurno(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId: string | undefined = req.user?.chofer?.id || (req.query?.choferId as string | undefined);
      if (!choferId) {
        const fallbackChofer = await prisma.chofer.findFirst({
          where: { userId: req.user?.id },
        });
        choferId = fallbackChofer?.id;
      }
      if (!choferId) {
        return res.status(401).json({ success: false, message: 'No se pudo identificar al chofer' });
      }

      const turnoId = req.query?.turnoId as string | undefined;
      const resumen = await choferController.calcularArqueoInterno(choferId, turnoId);

      if (!resumen) {
        return res.status(404).json({ success: false, message: 'No se encontraron datos para el arqueo' });
      }

      return res.json({ success: true, data: resumen });
    } catch (error) {
      console.error('Error al obtener resumen de cierre de turno:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Calificar al Pasajero desde la app del chofer
  async calificarPasajero(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const { estrellas, tags, comentario, pasajeroConflictivo } = req.body;
      let choferId = req.user?.chofer?.id;

      if (!choferId) {
        const chofer = await prisma.chofer.findFirst({ where: { userId: req.user?.id } });
        choferId = chofer?.id;
      }

      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
        include: { cliente: true },
      });

      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      if (viaje.choferId && choferId && viaje.choferId !== choferId) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para calificar este viaje' });
      }

      const viajeActualizado = await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          calificacionClienteEstrellas: estrellas ? Number(estrellas) : 5,
          calificacionClienteTags: tags ? JSON.stringify(tags) : null,
          calificacionClienteComentario: comentario || null,
          pasajeroConflictivo: Boolean(pasajeroConflictivo),
        },
      });

      // Si tiene cliente registrado y fue marcado conflictivo, actualizar registro del cliente
      if (viaje.clienteId && pasajeroConflictivo) {
        const cliente = await prisma.cliente.findUnique({ where: { id: viaje.clienteId } });
        if (cliente) {
          let obsObj: any = {};
          try {
            if (cliente.observaciones && cliente.observaciones.startsWith('{')) {
              obsObj = JSON.parse(cliente.observaciones);
            }
          } catch {}
          obsObj.conflictivo = true;
          obsObj.motivoConflictivo = comentario || 'Marcado como conflictivo por chofer';
          obsObj.fechaConflictivo = new Date().toISOString();
          await prisma.cliente.update({
            where: { id: viaje.clienteId },
            data: { observaciones: JSON.stringify(obsObj) },
          });
        }
      }

      return res.json({
        success: true,
        message: 'Calificación del pasajero registrada correctamente',
        data: viajeActualizado,
      });
    } catch (error) {
      console.error('Error al calificar pasajero:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Anotarse en Parada Virtual de Base (Turnero)
  async anotarseParadaVirtual(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id || req.body?.choferId;
      if (!choferId) {
        const chofer = await prisma.chofer.findFirst({ where: { userId: req.user?.id } });
        choferId = chofer?.id || (await resolverChoferFallbackId());
      }
      if (!choferId) return res.status(401).json({ success: false, message: 'Chofer no autenticado' });

      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
        include: { vehiculo: true, remiseria: true },
      });
      if (!chofer) return res.status(404).json({ success: false, message: 'Chofer no encontrado' });

      // Si el chofer ya tiene un viaje activo asignado, no debe anotarse en la Tabla
      const viajeEnCurso = await prisma.viaje.findFirst({
        where: {
          choferId,
          estado: { in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] },
        },
        select: { id: true },
      });
      if (viajeEnCurso) {
        return res.json({
          success: true,
          message: 'Chofer en viaje activo',
          data: {
            enParadaVirtual: false,
            puesto: null,
            totalEnCola: 0,
            cola: [],
          },
        });
      }

      await prisma.chofer.update({
        where: { id: choferId },
        data: {
          enParadaVirtual: true,
          paradaVirtualIngreso: new Date(),
        },
      });

      // Notificar a la sala de la remisería
      try {
        const { getIO, invalidarChoferCache } = await import('../lib/socket');
        invalidarChoferCache(chofer.id);
        const io = getIO();
        if (io && chofer.remiseriaId) {
          io.to(chofer.remiseriaId).emit('parada_virtual_actualizada', {
            choferId,
            accion: 'INGRESO',
            chofer: {
              id: chofer.id,
              nombre: `${chofer.nombre} ${chofer.apellido}`,
              numeroChofer: chofer.numeroChofer,
              vehiculo: chofer.vehiculo?.patente || 'Auto Propio',
            },
          });
        }
      } catch {}

      const cola = await prisma.chofer.findMany({
        where: {
          remiseriaId: chofer.remiseriaId,
          enParadaVirtual: true,
          isOnline: true,
          estado: 'ACTIVO',
        },
        orderBy: { paradaVirtualIngreso: 'asc' },
        include: { vehiculo: true },
      });

      const puesto = cola.findIndex((c) => c.id === choferId) + 1;

      return res.json({
        success: true,
        message: `¡Anotado en Parada Central! Puesto #${puesto} en la cola.`,
        data: {
          enParadaVirtual: true,
          puesto,
          totalEnCola: cola.length,
          cola: cola.map((c, i) => ({
            puesto: i + 1,
            id: c.id,
            nombre: `${c.nombre} ${c.apellido}`,
            numeroChofer: c.numeroChofer,
            patente: c.vehiculo?.patente || 'S/D',
            ingreso: c.paradaVirtualIngreso,
          })),
        },
      });
    } catch (error) {
      console.error('Error al anotarse en parada virtual:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Salir de Parada Virtual de Base
  async salirParadaVirtual(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id;
      if (!choferId) {
        const chofer = await prisma.chofer.findFirst({ where: { userId: req.user?.id } });
        choferId = chofer?.id;
      }
      if (!choferId) return res.status(401).json({ success: false, message: 'Chofer no autenticado' });

      const chofer = await prisma.chofer.findUnique({ where: { id: choferId } });
      if (!chofer) return res.status(404).json({ success: false, message: 'Chofer no encontrado' });

      await prisma.chofer.update({
        where: { id: choferId },
        data: {
          enParadaVirtual: false,
          paradaVirtualIngreso: null,
        },
      });

      // Notificar por WebSocket
      try {
        const { getIO, invalidarChoferCache } = await import('../lib/socket');
        invalidarChoferCache(chofer.id);
        const io = getIO();
        if (io && chofer.remiseriaId) {
          io.to(chofer.remiseriaId).emit('parada_virtual_actualizada', {
            choferId,
            accion: 'SALIDA',
          });
        }
      } catch {}

      return res.json({
        success: true,
        message: 'Has salido de la parada virtual.',
        data: { enParadaVirtual: false },
      });
    } catch (error) {
      console.error('Error al salir de parada virtual:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Obtener estado y posición en la Parada Virtual
  async getEstadoParadaVirtual(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id;
      if (!choferId) {
        const chofer = await prisma.chofer.findFirst({ where: { userId: req.user?.id } });
        choferId = chofer?.id;
      }
      if (!choferId) return res.status(401).json({ success: false, message: 'Chofer no autenticado' });

      const chofer = await prisma.chofer.findUnique({ where: { id: choferId } });
      if (!chofer) return res.status(404).json({ success: false, message: 'Chofer no encontrado' });

      const cola = await prisma.chofer.findMany({
        where: {
          remiseriaId: chofer.remiseriaId,
          enParadaVirtual: true,
          isOnline: true,
          estado: 'ACTIVO',
        },
        orderBy: { paradaVirtualIngreso: 'asc' },
        include: { vehiculo: true },
      });

      const puestoIndex = cola.findIndex((c) => c.id === choferId);
      const puesto = puestoIndex !== -1 ? puestoIndex + 1 : null;

      return res.json({
        success: true,
        data: {
          enParadaVirtual: Boolean(chofer.enParadaVirtual),
          puesto,
          totalEnCola: cola.length,
          ingreso: chofer.paradaVirtualIngreso,
          cola: cola.map((c, i) => ({
            puesto: i + 1,
            id: c.id,
            nombre: `${c.nombre} ${c.apellido}`,
            numeroChofer: c.numeroChofer,
            patente: c.vehiculo?.patente || 'S/D',
            ingreso: c.paradaVirtualIngreso,
          })),
        },
      });
    } catch (error) {
      console.error('Error al obtener estado de parada virtual:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Iniciar Viaje Espontáneo de Calle / Encadenado con Taxímetro Digital
  async crearViajeCalle(req: AuthenticatedRequest, res: Response) {
    try {
      let choferId = req.user?.chofer?.id;
      if (!choferId) {
        const chofer = await prisma.chofer.findFirst({ where: { userId: req.user?.id } });
        choferId = chofer?.id;
      }
      if (!choferId) return res.status(401).json({ success: false, message: 'Chofer no autenticado' });

      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
        include: { vehiculo: true, remiseria: true },
      });
      if (!chofer) return res.status(404).json({ success: false, message: 'Chofer no encontrado' });

      // Verificar si ya tiene viaje en curso
      const viajeExistente = await prisma.viaje.findFirst({
        where: {
          choferId,
          estado: { in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] },
        },
      });
      if (viajeExistente) {
        return res.status(400).json({
          success: false,
          message: 'Ya tienes un viaje activo. Finalízalo antes de tomar otro pasajero.',
        });
      }

      const {
        origen,
        destino,
        origenDetallado,
        destinoDetallado,
        clienteNombre,
        clienteTelefono,
        pinPasajero,
        precioInicial,
      } = req.body;

      const bajadaBandera = Number(chofer.remiseria?.bajadaBandera || 3500);
      const precioBase = precioInicial !== undefined ? Number(precioInicial) : bajadaBandera;

      // Buscar si el cliente ingresó un PIN o teléfono registrado
      let clienteId: string | null = null;
      let nombreFinal = clienteNombre || 'Pasajero de Calle';
      let telFinal = clienteTelefono || null;

      if (pinPasajero) {
        const clienteEncontrado = await prisma.cliente.findFirst({
          where: {
            remiseriaId: chofer.remiseriaId,
            OR: [
              { telefono: { contains: pinPasajero.trim() } },
              { dni: pinPasajero.trim() },
            ],
          },
        });
        if (clienteEncontrado) {
          clienteId = clienteEncontrado.id;
          nombreFinal = `${clienteEncontrado.nombre} ${clienteEncontrado.apellido}`;
          telFinal = clienteEncontrado.telefono;
        }
      }

      // Crear el viaje directamente EN_CURSO
      const nuevoViaje = await prisma.viaje.create({
        data: {
          remiseriaId: chofer.remiseriaId,
          choferId: chofer.id,
          vehiculoId: chofer.vehiculoId || null,
          clienteId,
          clienteNombre: nombreFinal,
          clienteTelefono: telFinal,
          origen: origen || 'Tomado en la calle / Parada',
          destino: destino || 'Destino a indicar por el pasajero (Taxímetro)',
          origenDetallado: origenDetallado || null,
          destinoDetallado: destinoDetallado || null,
          fecha: new Date(),
          estado: 'EN_CURSO',
          precio: precioBase,
          metodoPago: 'EFECTIVO',
          esViajeCalle: true,
          distanciaKmConPasajero: 0.0,
          distanciaKmSinPasajero: 0.0,
        },
        include: {
          chofer: true,
          vehiculo: true,
          remiseria: true,
          cliente: true,
        },
      });

      // Si estaba en parada virtual, liberarlo
      if (chofer.enParadaVirtual) {
        await prisma.chofer.update({
          where: { id: chofer.id },
          data: { enParadaVirtual: false, paradaVirtualIngreso: null },
        });
      }

      // Notificar por WebSocket al coordinador y a la remisería
      try {
        const { getIO, invalidarChoferCache } = await import('../lib/socket');
        invalidarChoferCache(chofer.id);
        const io = getIO();
        if (io && chofer.remiseriaId) {
          io.to(chofer.remiseriaId).emit('nuevo_viaje', nuevoViaje);
          io.to(chofer.remiseriaId).emit('vehiculo_movido', {
            id: chofer.vehiculoId || chofer.id,
            choferId: chofer.id,
            vehiculoId: chofer.vehiculoId,
            patente: chofer.vehiculo?.patente || 'Auto Propio',
            estado: 'en_viaje',
            choferNombre: `${chofer.nombre} ${chofer.apellido}`,
            viajeId: nuevoViaje.id,
          });
        }
      } catch {}

      return res.status(201).json({
        success: true,
        message: '¡Viaje de calle iniciado con éxito! Modo Taxímetro activo.',
        data: nuevoViaje,
      });
    } catch (error) {
      console.error('Error al crear viaje de calle:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },
}; 