import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

export const registerCliente = async (req: Request, res: Response) => {
  try {
    const {
      nombre,
      apellido,
      dni,
      telefono,
      email,
      password,
      direccion,
      fechaNacimiento,
      genero
    } = req.body;

    // Validar campos requeridos
    if (!nombre || !apellido || !dni || !telefono || !email || !password || !direccion || !fechaNacimiento) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos'
      });
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }

    // Verificar si el DNI ya existe
    const existingCliente = await prisma.cliente.findUnique({
      where: { dni }
    });

    if (existingCliente) {
      return res.status(400).json({
        success: false,
        error: 'El DNI ya está registrado'
      });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        rol: 'CLIENTE',
        activo: true
      }
    });

    // Crear cliente
    const cliente = await prisma.cliente.create({
      data: {
        nombre,
        apellido,
        dni,
        telefono,
        email,
        direccion,
        fechaNacimiento: new Date(fechaNacimiento),
        genero,
        activo: true,
        userId: user.id
      }
    });

    // Generar tokens
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!jwtSecret || !jwtRefreshSecret) {
      console.error('JWT secrets not configured');
      return res.status(500).json({
        success: false,
        error: 'Error de configuración del servidor'
      });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      jwtSecret,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    // Track registration
    await prisma.appUsage.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'CLIENTE_REGISTER',
        details: JSON.stringify({ clienteId: cliente.id }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      }
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          rol: user.rol,
          cliente: {
            id: cliente.id,
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            dni: cliente.dni,
            telefono: cliente.telefono,
            email: cliente.email,
            direccion: cliente.direccion,
            fechaNacimiento: cliente.fechaNacimiento,
            genero: cliente.genero
          }
        },
        accessToken,
        refreshToken
      },
      message: 'Cliente registrado exitosamente'
    });
  } catch (error) {
    console.error('Error en registro de cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const getClienteProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            activo: true,
            createdAt: true
          }
        }
      }
    });

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    res.json({
      success: true,
      data: cliente
    });
  } catch (error) {
    console.error('Error obteniendo perfil de cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const updateClienteProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      nombre,
      apellido,
      telefono,
      direccion,
      genero
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { userId }
    });

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Actualizar solo los campos permitidos
    const updatedCliente = await prisma.cliente.update({
      where: { userId },
      data: {
        nombre: nombre || cliente.nombre,
        apellido: apellido || cliente.apellido,
        telefono: telefono || cliente.telefono,
        direccion: direccion || cliente.direccion,
        genero: genero || cliente.genero
      }
    });

    // Track the action
    await prisma.appUsage.create({
      data: {
        userId,
        userEmail: cliente.email,
        action: 'CLIENTE_UPDATE_PROFILE',
        details: JSON.stringify({ clienteId: cliente.id }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      }
    });

    res.json({
      success: true,
      data: updatedCliente,
      message: 'Perfil actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando perfil de cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const getClienteViajes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const queryClienteId = req.query.clienteId as string | undefined;

    let cliente = await prisma.cliente.findUnique({
      where: { userId }
    });

    if (!cliente && queryClienteId) {
      cliente = await prisma.cliente.findUnique({
        where: { id: queryClienteId }
      });
    }

    if (!cliente) {
      cliente = await prisma.cliente.findFirst({
        where: { activo: true }
      });
    }

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    const viajes = await prisma.viaje.findMany({
      where: { clienteId: cliente.id },
      include: {
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
    console.error('Error obteniendo viajes del cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const getClienteReservas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { userId }
    });

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    const reservas = await prisma.reserva.findMany({
      where: { clienteId: cliente.id },
      include: {
        chofer: {
          select: {
            nombre: true,
            apellido: true,
            telefono: true
          }
        },
        vehiculo: {
          select: {
            patente: true,
            marca: true,
            modelo: true
          }
        }
      },
      orderBy: {
        fechaInicio: 'desc'
      }
    });

    res.json({
      success: true,
      data: reservas
    });
  } catch (error) {
    console.error('Error obteniendo reservas del cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Solicitar viaje
export const solicitarViaje = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cliente: {
      id: string;
      nombre: string;
      apellido: string;
      telefono?: string | null;
      email?: string | null;
    } | null | undefined =
      req.user?.cliente || (await prisma.cliente.findFirst({ where: { activo: true } }));
    const clienteId = cliente?.id;
    if (!clienteId) {
      return res.status(401).json({
        success: false,
        error: 'Cliente no autenticado'
      });
    }

    const {
      origen,
      destino,
      fechaHora,
      observaciones,
      usarUbicacionActual,
      latitudOrigen,
      longitudOrigen,
      latitudDestino,
      longitudDestino
    } = req.body;

    if (!origen || !destino) {
      return res.status(400).json({
        success: false,
        error: 'Origen y destino son requeridos'
      });
    }

    // Obtener remisería (priorizando aquella que tenga coordinadores activos)
    const remiseria =
      (await prisma.remiseria.findFirst({
        where: { estado: true, coordinadores: { some: { activo: true } } }
      })) ||
      (await prisma.remiseria.findFirst({ where: { estado: true } })) ||
      (await prisma.remiseria.findFirst());

    if (!remiseria) {
      return res.status(400).json({
        success: false,
        error: 'No hay ninguna remisería registrada en el sistema'
      });
    }

    // Calcular precio
    const precio = await calcularPrecioViaje(
      origen,
      destino,
      latitudOrigen ? parseFloat(latitudOrigen) : undefined,
      longitudOrigen ? parseFloat(longitudOrigen) : undefined,
      latitudDestino ? parseFloat(latitudDestino) : undefined,
      longitudDestino ? parseFloat(longitudDestino) : undefined
    );

    const clienteNombre = cliente
      ? `${cliente.nombre} ${cliente.apellido}`
      : undefined;

    // Crear viaje
    const viaje = await prisma.viaje.create({
      data: {
        origen,
        destino,
        precio,
        fecha: fechaHora ? new Date(fechaHora) : new Date(),
        estado: 'PENDIENTE',
        observaciones,
        clienteId,
        clienteNombre,
        clienteTelefono: cliente?.telefono,
        clienteEmail: cliente?.email,
        remiseriaId: remiseria.id
      },
      include: {
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
        },
        remiseria: {
          select: {
            nombreFantasia: true,
            telefono: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: viaje,
      message: 'Viaje solicitado exitosamente'
    });
  } catch (error) {
    console.error('Error al solicitar viaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Calcular precio de viaje
export const calcularPrecio = async (req: Request, res: Response) => {
  try {
    const { origen, destino, latitudOrigen, longitudOrigen, latitudDestino, longitudDestino } = req.body;

    if (!origen || !destino) {
      return res.status(400).json({
        success: false,
        error: 'Origen y destino son requeridos'
      });
    }

    const remiseria = await prisma.remiseria.findFirst();
    const bajadaBandera = remiseria?.bajadaBandera || 3500;
    const valorKm = remiseria?.valorKm || 1200;

    const precio = await calcularPrecioViaje(
      origen,
      destino,
      latitudOrigen ? parseFloat(latitudOrigen) : undefined,
      longitudOrigen ? parseFloat(longitudOrigen) : undefined,
      latitudDestino ? parseFloat(latitudDestino) : undefined,
      longitudDestino ? parseFloat(longitudDestino) : undefined
    );

    res.json({
      success: true,
      data: {
        origen,
        destino,
        precioEstimado: precio,
        tarifaBase: bajadaBandera,
        tarifaPorKm: valorKm,
        tarifaPorMinuto: 0
      }
    });
  } catch (error) {
    console.error('Error al calcular precio:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Crear reserva
export const crearReserva = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clienteId = req.user?.cliente?.id;
    if (!clienteId) {
      return res.status(401).json({
        success: false,
        error: 'Cliente no autenticado'
      });
    }

    const {
      origen,
      destino,
      fechaInicio,
      horaInicio,
      tipoReserva,
      fechaFin,
      diasSemana,
      horaFin,
      observaciones,
      latitudOrigen,
      longitudOrigen,
      latitudDestino,
      longitudDestino
    } = req.body;

    if (!origen || !destino || !fechaInicio || !horaInicio || !tipoReserva) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos faltantes'
      });
    }

    // Obtener remisería
    const remiseria =
      (await prisma.remiseria.findFirst({
        where: { estado: true, coordinadores: { some: { activo: true } } }
      })) ||
      (await prisma.remiseria.findFirst({ where: { estado: true } })) ||
      (await prisma.remiseria.findFirst());

    if (!remiseria) {
      return res.status(400).json({
        success: false,
        error: 'No hay ninguna remisería registrada en el sistema'
      });
    }

    // Crear reserva
    const reserva = await prisma.reserva.create({
      data: {
        clienteNombre: `${req.user?.cliente?.nombre} ${req.user?.cliente?.apellido}`,
        clienteTelefono: req.user?.cliente?.telefono || '',
        clienteEmail: req.user?.cliente?.email || '',
        origen,
        destino,
        fechaInicio: new Date(fechaInicio),
        horaInicio,
        tipo: tipoReserva === 'unica' ? 'UNICA' : 'PERIODICA',
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        diasSemana: diasSemana ? diasSemana.join(',') : null,
        horaFin,
        estado: 'ACTIVA',
        observaciones,
        clienteId,
        remiseriaId: remiseria.id
      }
    });

    res.json({
      success: true,
      data: reserva,
      message: 'Reserva creada exitosamente'
    });
  } catch (error) {
    console.error('Error al crear reserva:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Cancelar viaje
export const cancelarViaje = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clienteId = req.user?.cliente?.id;
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
        message: 'Usuario no autenticado'
      });
    }

    // Buscar el viaje (si es cliente autenticado valida pertenencia, o permite cancelar si es el viaje activo en sesión compartida)
    const viaje = await prisma.viaje.findFirst({
      where: clienteId ? { id, clienteId } : { id }
    });

    if (!viaje) {
      return res.status(404).json({
        success: false,
        error: 'Viaje no encontrado',
        message: 'Viaje no encontrado'
      });
    }

    if (viaje.estado === 'COMPLETADO' || viaje.estado === 'CANCELADO') {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar un viaje completado o ya cancelado',
        message: 'No se puede cancelar un viaje completado o ya cancelado'
      });
    }

    // Actualizar estado del viaje
    await prisma.viaje.update({
      where: { id },
      data: { estado: 'CANCELADO' }
    });

    res.json({
      success: true,
      message: 'Viaje cancelado exitosamente'
    });
  } catch (error) {
    console.error('Error al cancelar viaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: 'Error interno del servidor'
    });
  }
};

// Cancelar reserva
export const cancelarReserva = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clienteId = req.user?.cliente?.id;
    const { id } = req.params;

    if (!clienteId) {
      return res.status(401).json({
        success: false,
        error: 'Cliente no autenticado'
      });
    }

    // Verificar que la reserva pertenece al cliente
    const reserva = await prisma.reserva.findFirst({
      where: {
        id,
        clienteId
      }
    });

    if (!reserva) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada'
      });
    }

    if (reserva.estado === 'COMPLETADA' || reserva.estado === 'CANCELADA') {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar una reserva completada o ya cancelada'
      });
    }

    // Actualizar estado de la reserva
    await prisma.reserva.update({
      where: { id },
      data: { estado: 'CANCELADA' }
    });

    res.json({
      success: true,
      message: 'Reserva cancelada exitosamente'
    });
  } catch (error) {
    console.error('Error al cancelar reserva:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener ubicación actual (simulado)
export const getUbicacionActual = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Por ahora retornamos una ubicación simulada
    // En producción, esto se obtendría del GPS del dispositivo
    const ubicacion = {
      lat: -34.6037, // Buenos Aires
      lng: -58.3816,
      direccion: 'Ubicación actual (simulada)'
    };

    res.json({
      success: true,
      data: ubicacion
    });
  } catch (error) {
    console.error('Error al obtener ubicación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Función auxiliar para calcular precio
async function calcularPrecioViaje(
  origen: string,
  destino: string,
  latitudOrigen?: number,
  longitudOrigen?: number,
  latitudDestino?: number,
  longitudDestino?: number
): Promise<number> {
  const remiseria = await prisma.remiseria.findFirst();
  const bajadaBandera = remiseria?.bajadaBandera || 3500;
  const valorKm = remiseria?.valorKm || 1200;

  let distanciaKm = 0;
  let calculatedViaRoute = false;

  if (latitudOrigen && longitudOrigen && latitudDestino && longitudDestino) {
    try {
      const url = `http://router.project-osrm.org/route/v1/driving/${longitudOrigen},${latitudOrigen};${longitudDestino},${latitudDestino}?overview=false`;
      const response = await fetch(url);
      const data = await response.json() as any;
      if (data.routes && data.routes.length > 0) {
        distanciaKm = data.routes[0].distance / 1000;
        distanciaKm = Math.round(distanciaKm * 10) / 10;
        calculatedViaRoute = true;
      }
    } catch (error) {
      console.error('Error al calcular distancia OSRM:', error);
    }
  }

  if (!calculatedViaRoute) {
    const str = (origen + destino).toLowerCase().replace(/\s/g, '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);
    const baseDistance = 1.5;
    const maxDistanceRange = 11.0;
    const estimatedDistance = baseDistance + (absHash % 100) / 100 * maxDistanceRange;
    distanciaKm = Math.round(estimatedDistance * 10) / 10;
  }

  let precioEstimado = bajadaBandera;
  if (distanciaKm > 1) {
    precioEstimado += (distanciaKm - 1) * valorKm;
  }
  return Math.round(precioEstimado);
} 
// Buscar cliente por DNI
export const buscarClientePorDni = async (req: Request, res: Response) => {
  try {
    const { dni } = req.params;

    if (!dni) {
      return res.status(400).json({
        success: false,
        error: 'DNI es requerido'
      });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { dni },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        email: true,
        direccion: true
      }
    });

    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Buscar viajes del cliente para obtener direcciones frecuentes
    const pastVoyages = await prisma.viaje.findMany({
      where: { clienteId: cliente.id },
      select: {
        origen: true,
        destino: true
      },
      orderBy: {
        fecha: 'desc'
      },
      take: 20
    });

    const uniqueOrigins = Array.from(new Set(pastVoyages.map(v => v.origen).filter(Boolean)));
    const uniqueDestinations = Array.from(new Set(pastVoyages.map(v => v.destino).filter(Boolean)));

    res.json({
      success: true,
      data: {
        ...cliente,
        direccionesFrecuentes: {
          origenes: uniqueOrigins,
          destinos: uniqueDestinations
        }
      },
      message: 'Cliente encontrado'
    });
  } catch (error) {
    console.error('Error buscando cliente por DNI:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener disponibilidad de vehículos y demora estimada en tiempo real para el cliente
export const getDisponibilidad = async (req: Request, res: Response) => {
  try {
    const [choferesOnline, viajesActivos, viajesPendientes, totalVehiculosActivos] = await Promise.all([
      prisma.chofer.findMany({
        where: {
          estado: 'ACTIVO',
          isOnline: true
        },
        select: {
          id: true,
          nombre: true,
          vehiculoId: true
        }
      }),
      prisma.viaje.findMany({
        where: {
          estado: {
            in: ['ACEPTADO', 'EN_CAMINO', 'EN_CURSO']
          }
        },
        select: {
          id: true,
          estado: true,
          choferId: true
        }
      }),
      prisma.viaje.count({
        where: {
          estado: 'PENDIENTE'
        }
      }),
      prisma.vehiculo.count({
        where: {
          estado: 'ACTIVO'
        }
      })
    ]);

    const choferesOcupadosIds = new Set(
      viajesActivos.map((v) => v.choferId).filter((id): id is string => Boolean(id))
    );

    const autosLibresOnline = choferesOnline.filter(
      (c) => !choferesOcupadosIds.has(c.id)
    ).length;

    const autosEnViaje = viajesActivos.length;
    const hayAutosDisponibles = autosLibresOnline > 0;
    const todosOcupados = !hayAutosDisponibles && (autosEnViaje > 0 || choferesOnline.length > 0);

    // Calcular demora aproximada en minutos
    let demoraMin = 3;
    let demoraMax = 6;

    if (!hayAutosDisponibles) {
      if (viajesActivos.length > 0) {
        // Estimar cuándo se libera el vehículo más próximo a terminar su viaje
        const tiemposRestantes = viajesActivos.map((v) => {
          if (v.estado === 'EN_CURSO') return 8;
          if (v.estado === 'EN_CAMINO') return 12;
          return 15; // ACEPTADO
        });
        const proximoEnLiberarse = Math.min(...tiemposRestantes);
        demoraMin = proximoEnLiberarse + viajesPendientes * 8;
        demoraMax = demoraMin + 5;
      } else {
        // Sin choferes online en la app, asignación por base/coordinador
        demoraMin = 10 + viajesPendientes * 8;
        demoraMax = demoraMin + 5;
      }
    }

    res.json({
      success: true,
      data: {
        hayAutosDisponibles,
        autosDisponibles: autosLibresOnline,
        autosEnViaje,
        choferesConectados: choferesOnline.length,
        totalVehiculosActivos,
        viajesPendientes,
        todosOcupados,
        demoraMin,
        demoraMax
      }
    });
  } catch (error) {
    console.error('Error obteniendo disponibilidad de vehículos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al consultar disponibilidad'
    });
  }
};
