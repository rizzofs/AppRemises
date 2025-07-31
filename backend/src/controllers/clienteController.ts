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
      { expiresIn: '15m' }
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

    const cliente = await prisma.cliente.findUnique({
      where: { userId }
    });

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

    // Calcular precio (implementación básica)
    const precio = await calcularPrecioViaje(origen, destino);

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
        remiseriaId: '1', // Por ahora hardcodeado, luego se implementará selección de remisería
        choferId: '1', // Temporal
        vehiculoId: '1' // Temporal
      },
      include: {
        chofer: {
          select: {
            nombre: true,
            telefono: true,
            vehiculo: {
              select: {
                patente: true,
                marca: true,
                modelo: true
              }
            }
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
    const { origen, destino } = req.body;

    if (!origen || !destino) {
      return res.status(400).json({
        success: false,
        error: 'Origen y destino son requeridos'
      });
    }

    const precio = await calcularPrecioViaje(origen, destino);

    res.json({
      success: true,
      data: {
        origen,
        destino,
        precioEstimado: precio,
        tarifaBase: 500, // Tarifa base en pesos
        tarifaPorKm: 50, // Tarifa por km
        tarifaPorMinuto: 2 // Tarifa por minuto
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
        remiseriaId: '1' // Por ahora hardcodeado
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

    if (!clienteId) {
      return res.status(401).json({
        success: false,
        error: 'Cliente no autenticado'
      });
    }

    // Verificar que el viaje pertenece al cliente
    const viaje = await prisma.viaje.findFirst({
      where: {
        id,
        clienteId
      }
    });

    if (!viaje) {
      return res.status(404).json({
        success: false,
        error: 'Viaje no encontrado'
      });
    }

    if (viaje.estado === 'COMPLETADO' || viaje.estado === 'CANCELADO') {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar un viaje completado o ya cancelado'
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
      error: 'Error interno del servidor'
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
async function calcularPrecioViaje(origen: string, destino: string): Promise<number> {
  // Implementación básica de cálculo de precio
  // En producción, esto se integraría con APIs de mapas para calcular distancia real
  
  // Simulación: precio base + distancia estimada
  const tarifaBase = 500;
  const tarifaPorKm = 50;
  
  // Distancia estimada (en producción se calcularía con APIs de mapas)
  const distanciaEstimada = Math.random() * 20 + 5; // 5-25 km
  
  const precio = tarifaBase + (distanciaEstimada * tarifaPorKm);
  
  return Math.round(precio);
} 