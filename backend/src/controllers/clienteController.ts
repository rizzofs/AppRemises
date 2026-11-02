import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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

    // Buscar remisería activa (Remises Bruno)
    let targetRemiseriaId = req.body.remiseriaId;
    if (!targetRemiseriaId) {
      const activeRemiseria = await prisma.remiseria.findFirst({
        where: { estado: true }
      });
      targetRemiseriaId = activeRemiseria?.id || null;
    }

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
        userId: user.id,
        remiseriaId: targetRemiseriaId
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
      genero,
      fotoUrl,
      direccionesFrecuentes
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

    const updateData: any = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (apellido !== undefined) updateData.apellido = apellido;
    if (telefono !== undefined) updateData.telefono = telefono;
    if (direccion !== undefined) updateData.direccion = direccion;
    if (genero !== undefined) updateData.genero = genero;
    if (fotoUrl !== undefined) updateData.fotoUrl = fotoUrl;
    if (direccionesFrecuentes !== undefined) {
      updateData.direccionesFrecuentes =
        typeof direccionesFrecuentes === 'object'
          ? JSON.stringify(direccionesFrecuentes)
          : direccionesFrecuentes;
    }

    // Actualizar campos del cliente
    const updatedCliente = await prisma.cliente.update({
      where: { userId },
      data: updateData
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
        cliente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            telefono: true,
            fotoUrl: true,
          }
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
        cliente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            telefono: true,
            fotoUrl: true,
          }
        },
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
      longitudDestino,
      paradas,
      metodoPago,
      pagaCon
    } = req.body;

    if (!origen || !destino) {
      return res.status(400).json({
        success: false,
        error: 'Origen y destino son requeridos'
      });
    }

    // Obtener remisería del cliente o remisería activa
    const clienteActual = await prisma.cliente.findUnique({
      where: { id: clienteId }
    });

    let remiseria = null;
    if (clienteActual?.remiseriaId) {
      remiseria = await prisma.remiseria.findUnique({
        where: { id: clienteActual.remiseriaId }
      });
    }

    if (!remiseria) {
      remiseria =
        (await prisma.remiseria.findFirst({
          where: { estado: true, coordinadores: { some: { activo: true } } }
        })) ||
        (await prisma.remiseria.findFirst({ where: { estado: true } })) ||
        (await prisma.remiseria.findFirst());
    }

    if (!remiseria) {
      return res.status(400).json({
        success: false,
        error: 'No hay ninguna remisería registrada en el sistema'
      });
    }

    // Calcular precio considerando paradas intermedias
    const cotizacion = await calcularPrecioViaje(
      origen,
      destino,
      latitudOrigen ? parseFloat(latitudOrigen) : undefined,
      longitudOrigen ? parseFloat(longitudOrigen) : undefined,
      latitudDestino ? parseFloat(latitudDestino) : undefined,
      longitudDestino ? parseFloat(longitudDestino) : undefined,
      Array.isArray(paradas) ? paradas : undefined
    );
    const precio = cotizacion.precio;

    const clienteNombre = cliente
      ? `${cliente.nombre} ${cliente.apellido}`
      : undefined;

    // Generar trackingToken único para compartir el viaje
    const trackingToken = crypto.randomBytes(16).toString('hex');

    // Manejo de pago y cambio en efectivo
    const metodoPagoFinal = metodoPago === 'TRANSFERENCIA' ? 'TRANSFERENCIA' : 'EFECTIVO';
    let pagaConNum: number | null = null;
    let vueltoEstimadoNum: number | null = null;
    if (metodoPagoFinal === 'EFECTIVO' && pagaCon) {
      pagaConNum = parseFloat(pagaCon);
      if (!isNaN(pagaConNum) && pagaConNum > precio) {
        vueltoEstimadoNum = Math.round((pagaConNum - precio) * 100) / 100;
      }
    }

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
        remiseriaId: remiseria.id,
        origenDetallado: latitudOrigen && longitudOrigen ? `${latitudOrigen},${longitudOrigen}` : undefined,
        destinoDetallado: latitudDestino && longitudDestino ? `${latitudDestino},${longitudDestino}` : undefined,
        trackingToken,
        metodoPago: metodoPagoFinal,
        pagaCon: pagaConNum,
        vueltoEstimado: vueltoEstimadoNum,
        paradas: paradas ? (typeof paradas === 'string' ? paradas : JSON.stringify(paradas)) : null
      },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            telefono: true,
            fotoUrl: true,
          }
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

    // Notificar en tiempo real por sockets al coordinador y a los choferes
    try {
      const { getIO } = await import('../lib/socket');
      const io = getIO();
      io.to(remiseria.id).emit('nuevo_viaje_recibido', viaje);
    } catch (socketErr) {
      console.warn('Socket aviso nuevo viaje:', socketErr);
    }

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
    const { origen, destino, latitudOrigen, longitudOrigen, latitudDestino, longitudDestino, paradas } = req.body;

    if (!origen || !destino) {
      return res.status(400).json({
        success: false,
        error: 'Origen y destino son requeridos'
      });
    }

    // Buscar remisería activa (Remises Bruno)
    const remiseria = await prisma.remiseria.findFirst({ where: { estado: true } }) || await prisma.remiseria.findFirst();
    const bajadaBandera = remiseria?.bajadaBandera || 3500;
    const valorKm = remiseria?.valorKm || 1200;

    const cotizacion = await calcularPrecioViaje(
      origen,
      destino,
      latitudOrigen ? parseFloat(latitudOrigen) : undefined,
      longitudOrigen ? parseFloat(longitudOrigen) : undefined,
      latitudDestino ? parseFloat(latitudDestino) : undefined,
      longitudDestino ? parseFloat(longitudDestino) : undefined,
      Array.isArray(paradas) ? paradas : undefined
    );

    res.json({
      success: true,
      data: {
        origen,
        destino,
        precioEstimado: cotizacion.precio,
        distancia: cotizacion.distanciaKm,
        tiempoEstimado: cotizacion.tiempoEstimado,
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

// Cancelar viaje con motivo y verificación de proximidad (< 10 cuadras = cobro mínimo)
export const cancelarViaje = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clienteId = req.user?.cliente?.id;
    const { id } = req.params;
    const { motivo } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
        message: 'Usuario no autenticado'
      });
    }

    // Buscar el viaje
    const viaje = await prisma.viaje.findFirst({
      where: clienteId ? { id, clienteId } : { id },
      include: {
        vehiculo: true,
        chofer: {
          include: {
            vehiculo: true
          }
        },
        remiseria: true
      }
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

    if (viaje.estado === 'EN_CURSO') {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar el viaje una vez que el pasajero ya está a bordo',
        message: 'No se puede cancelar el viaje una vez que el pasajero ya está a bordo'
      });
    }

    // Verificar si el auto está a menos de 10 cuadras (1.0 km) del origen
    let debeAbonarMinimo = false;
    let costoCancelacion: number | null = null;
    let distanciaAlOrigenKm: number | null = null;

    if (viaje.estado === 'ACEPTADO' || viaje.estado === 'EN_CAMINO') {
      // Coordenadas del móvil
      const latMovil = viaje.vehiculo?.latitud || viaje.chofer?.vehiculo?.latitud;
      const lonMovil = viaje.vehiculo?.longitud || viaje.chofer?.vehiculo?.longitud;

      // Coordenadas de recogida
      let latOrigen: number | null = null;
      let lonOrigen: number | null = null;

      if (viaje.origenDetallado && viaje.origenDetallado.includes(',')) {
        const parts = viaje.origenDetallado.split(',');
        latOrigen = parseFloat(parts[0]);
        lonOrigen = parseFloat(parts[1]);
      }

      if (viaje.estado === 'EN_CAMINO') {
        // Si el chofer ya avisó que está en la puerta/llegando
        debeAbonarMinimo = true;
      } else if (latMovil && lonMovil && latOrigen && lonOrigen) {
        distanciaAlOrigenKm = calcularDistanciaHaversine(latMovil, lonMovil, latOrigen, lonOrigen);
        // 10 cuadras = 1.0 km
        if (distanciaAlOrigenKm <= 1.0) {
          debeAbonarMinimo = true;
        }
      }

      if (debeAbonarMinimo) {
        costoCancelacion = viaje.remiseria?.bajadaBandera || 3500;
      }
    }

    // Actualizar estado del viaje
    const updatedViaje = await prisma.viaje.update({
      where: { id },
      data: {
        estado: 'CANCELADO',
        motivoCancelacion: motivo || 'Cancelado por el cliente',
        canceladoPor: 'CLIENTE',
        debeAbonarMinimo,
        costoCancelacion
      },
      include: {
        cliente: true,
        chofer: true,
        vehiculo: true
      }
    });

    // Notificación sonora inmediata al chofer y al coordinador vía WebSockets
    try {
      const { getIO } = await import('../lib/socket');
      const io = getIO();
      io.to(viaje.remiseriaId).emit('viaje_cancelado', {
        viajeId: id,
        motivo: motivo || 'Cancelado por el cliente',
        canceladoPor: 'CLIENTE',
        debeAbonarMinimo,
        costoCancelacion,
        distanciaKm: distanciaAlOrigenKm ? Number(distanciaAlOrigenKm.toFixed(1)) : null,
        viaje: updatedViaje
      });
      io.to(viaje.remiseriaId).emit('viaje_estado_actualizado', {
        viajeId: id,
        estado: 'CANCELADO',
        mensaje: `Viaje cancelado por cliente: ${motivo || 'Sin motivo especificado'}`,
        viaje: updatedViaje
      });
    } catch (socketErr) {
      console.warn('Socket error notificando cancelación:', socketErr);
    }

    res.json({
      success: true,
      data: {
        viaje: updatedViaje,
        debeAbonarMinimo,
        costoCancelacion,
        distanciaKm: distanciaAlOrigenKm ? Number(distanciaAlOrigenKm.toFixed(1)) : null
      },
      message: debeAbonarMinimo
        ? `Viaje cancelado. El móvil se encontraba a menos de 10 cuadras de tu ubicación, por lo que deberás abonar el viaje mínimo ($${costoCancelacion}).`
        : 'Viaje cancelado exitosamente'
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

// Calificar viaje y vehículo (1 a 5 estrellas con tags y comentarios)
export const calificarViaje = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clienteId = req.user?.cliente?.id;
    const { id } = req.params;
    const { estrellasChofer, estrellasVehiculo, tags, comentario } = req.body;

    if (!clienteId) {
      return res.status(401).json({
        success: false,
        error: 'Cliente no autenticado'
      });
    }

    const viaje = await prisma.viaje.findFirst({
      where: { id, clienteId },
      include: { calificacion: true }
    });

    if (!viaje) {
      return res.status(404).json({
        success: false,
        error: 'Viaje no encontrado'
      });
    }

    if (viaje.estado !== 'COMPLETADO') {
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden calificar viajes que hayan sido completados'
      });
    }

    if (viaje.calificacion) {
      return res.status(400).json({
        success: false,
        error: 'Este viaje ya fue calificado'
      });
    }

    if (!viaje.choferId) {
      return res.status(400).json({
        success: false,
        error: 'El viaje no tiene un chofer asignado para calificar'
      });
    }

    const calificacion = await prisma.calificacionViaje.create({
      data: {
        viajeId: viaje.id,
        clienteId,
        choferId: viaje.choferId,
        estrellasChofer: Math.min(5, Math.max(1, parseInt(estrellasChofer || '5'))),
        estrellasVehiculo: Math.min(5, Math.max(1, parseInt(estrellasVehiculo || '5'))),
        tags: Array.isArray(tags) ? JSON.stringify(tags) : tags || null,
        comentario: comentario?.trim() || null
      }
    });

    try {
      const { getIO } = await import('../lib/socket');
      const io = getIO();
      io.to(viaje.remiseriaId).emit('viaje_calificado', {
        viajeId: viaje.id,
        choferId: viaje.choferId,
        calificacion
      });
    } catch {}

    res.json({
      success: true,
      data: calificacion,
      message: '¡Muchas gracias por calificar tu viaje!'
    });
  } catch (error) {
    console.error('Error al calificar viaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Agregar parada intermedia dinámicamente durante el viaje
export const agregarParadaEnCurso = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clienteId = req.user?.cliente?.id;
    const { id } = req.params;
    const { direccion, lat, lon } = req.body;

    if (!direccion) {
      return res.status(400).json({
        success: false,
        error: 'La dirección de la parada es requerida'
      });
    }

    const viaje = await prisma.viaje.findFirst({
      where: clienteId ? { id, clienteId } : { id }
    });

    if (!viaje) {
      return res.status(404).json({
        success: false,
        error: 'Viaje no encontrado'
      });
    }

    if (!['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO'].includes(viaje.estado)) {
      return res.status(400).json({
        success: false,
        error: 'No se pueden agregar paradas a un viaje finalizado o cancelado'
      });
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
      direccion,
      lat: lat ? parseFloat(lat) : undefined,
      lon: lon ? parseFloat(lon) : undefined,
      completada: false,
      orden: paradasActuales.length + 1
    };

    paradasActuales.push(nuevaParada);

    // Parsear coordenadas para recalcular el precio del viaje
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

    const remiseria = await prisma.remiseria.findFirst({ where: { estado: true } }) || await prisma.remiseria.findFirst();
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

    // El nuevo precio base debe reflejar el recorrido actualizado o sumar como mínimo la parada añadida
    const costoParadaAdicional = Math.round((valorKm * 1.5) / 100) * 100;
    const nuevoPrecioBase = Math.max(cotizacion.precio, precioBaseAnterior + costoParadaAdicional);
    const precioFinal = Math.round((nuevoPrecioBase + (viaje.costoEspera || 0)) / 100) * 100;

    const updatedViaje = await prisma.viaje.update({
      where: { id },
      data: {
        paradas: JSON.stringify(paradasActuales),
        precio: precioFinal
      },
      include: {
        chofer: true,
        vehiculo: true
      }
    });

    try {
      const { getIO } = await import('../lib/socket');
      const io = getIO();
      io.to(viaje.remiseriaId).emit('parada_agregada', {
        viajeId: id,
        nuevaParada,
        paradas: paradasActuales,
        nuevoPrecio: precioFinal,
        viaje: updatedViaje
      });
    } catch {}

    res.json({
      success: true,
      data: updatedViaje,
      message: 'Parada intermedia agregada exitosamente'
    });
  } catch (error) {
    console.error('Error al agregar parada intermedia:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Chat rápido / mensajería predefinida
export const enviarMensajeChat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;
    const user = req.user;

    if (!texto || !texto.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El texto del mensaje es requerido'
      });
    }

    const viaje = await prisma.viaje.findUnique({
      where: { id },
      include: {
        cliente: true,
        chofer: true
      }
    });

    if (!viaje) {
      return res.status(404).json({
        success: false,
        error: 'Viaje no encontrado'
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

    const esChofer = user?.rol === 'CHOFER';
    const remitente = esChofer ? 'CHOFER' : 'CLIENTE';
    const remitenteNombre = esChofer
      ? (viaje.chofer ? `${viaje.chofer.nombre} ${viaje.chofer.apellido || ''}`.trim() : 'Chofer')
      : (viaje.cliente ? `${viaje.cliente.nombre} ${viaje.cliente.apellido || ''}`.trim() : (viaje.clienteNombre || 'Pasajero'));

    const nuevoMensaje = {
      id: `msg-${Date.now()}`,
      remitente,
      remitenteNombre,
      texto: texto.trim(),
      timestamp: new Date().toISOString()
    };

    historial.push(nuevoMensaje);

    await prisma.viaje.update({
      where: { id },
      data: {
        mensajesChat: JSON.stringify(historial)
      }
    });

    try {
      const { getIO } = await import('../lib/socket');
      const io = getIO();
      io.to(viaje.remiseriaId).emit('mensaje_chat_recibido', {
        viajeId: id,
        mensaje: nuevoMensaje
      });
    } catch {}

    res.json({
      success: true,
      data: nuevoMensaje,
      message: 'Mensaje enviado'
    });
  } catch (error) {
    console.error('Error al enviar mensaje de chat:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Botón de emergencia / SOS
export const enviarAlertaSOS = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { lat, lon } = req.body;
    const cliente = req.user?.cliente;

    const viaje = await prisma.viaje.findUnique({
      where: { id },
      include: {
        remiseria: true,
        chofer: true,
        vehiculo: true
      }
    });

    if (!viaje) {
      return res.status(404).json({
        success: false,
        error: 'Viaje no encontrado'
      });
    }

    const coords = (lat && lon) ? { lat: parseFloat(lat), lon: parseFloat(lon) } : undefined;
    const clienteNombre = cliente ? `${cliente.nombre} ${cliente.apellido}` : (viaje.clienteNombre || 'Pasajero');
    const clienteTelefono = cliente?.telefono || viaje.clienteTelefono || 'Sin teléfono';

    try {
      const { getIO } = await import('../lib/socket');
      const io = getIO();
      io.to(viaje.remiseriaId).emit('alerta_sos_recibida', {
        viajeId: viaje.id,
        clienteNombre,
        clienteTelefono,
        coords,
        vehiculo: viaje.vehiculo ? `${viaje.vehiculo.marca} ${viaje.vehiculo.modelo} (${viaje.vehiculo.patente})` : 'Vehículo de agencia',
        chofer: viaje.chofer ? `${viaje.chofer.nombre} ${viaje.chofer.apellido}` : 'Chofer asignado',
        timestamp: new Date().toISOString()
      });
    } catch {}

    // Registro de auditoría
    try {
      await prisma.appUsage.create({
        data: {
          userId: req.user?.id || 'anonimo',
          userEmail: req.user?.email || 'anonimo@appremises.com',
          action: 'ALERTA_SOS',
          details: JSON.stringify({ viajeId: viaje.id, coords, clienteNombre, clienteTelefono }),
          ipAddress: req.ip
        }
      });
    } catch {}

    res.json({
      success: true,
      data: {
        telefonoCentral: viaje.remiseria?.telefono || '0800-REMISES',
        telefono911: '911'
      },
      message: 'Alerta SOS emitida a la central de la remisería'
    });
  } catch (error) {
    console.error('Error al emitir alerta SOS:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener datos públicos de tracking en tiempo real
export const getViajeTracking = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    const viaje = await prisma.viaje.findUnique({
      where: { trackingToken: token },
      include: {
        remiseria: {
          select: {
            nombreFantasia: true,
            telefono: true
          }
        },
        chofer: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
            telefono: true
          }
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
            ultimaUbicacion: true
          }
        }
      }
    });

    if (!viaje) {
      return res.status(404).json({
        success: false,
        error: 'Enlace de seguimiento no encontrado o vencido'
      });
    }

    let paradasList = [];
    if (viaje.paradas) {
      try {
        paradasList = JSON.parse(viaje.paradas);
      } catch {}
    }

    let coordsOrigen: { lat: number; lon: number } | null = null;
    let coordsDestino: { lat: number; lon: number } | null = null;

    if (viaje.origenDetallado?.includes(',')) {
      const parts = viaje.origenDetallado.split(',');
      coordsOrigen = { lat: parseFloat(parts[0]), lon: parseFloat(parts[1]) };
    }
    if (viaje.destinoDetallado?.includes(',')) {
      const parts = viaje.destinoDetallado.split(',');
      coordsDestino = { lat: parseFloat(parts[0]), lon: parseFloat(parts[1]) };
    }

    res.json({
      success: true,
      data: {
        id: viaje.id,
        origen: viaje.origen,
        destino: viaje.destino,
        coordsOrigen,
        coordsDestino,
        paradas: paradasList,
        estado: viaje.estado,
        precio: viaje.precio,
        fecha: viaje.fecha,
        remiseria: viaje.remiseria,
        chofer: viaje.chofer,
        vehiculo: viaje.vehiculo,
        tiempoEsperaSegundos: viaje.tiempoEsperaSegundos,
        costoEspera: viaje.costoEspera,
        enEspera: viaje.enEspera
      }
    });
  } catch (error) {
    console.error('Error al consultar tracking:', error);
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
      lat: -34.8957, // Chivilcoy, Buenos Aires
      lng: -60.0189,
      direccion: 'Chivilcoy, Buenos Aires (simulada)'
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

// Función para calcular distancia en km usando Haversine (10 cuadras = 1.0 km)
export function calcularDistanciaHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return R * c;
}

// Función auxiliar para calcular precio, distancia y tiempo de viaje con soporte a paradas intermedias
export async function calcularPrecioViaje(
  origen: string,
  destino: string,
  latitudOrigen?: number,
  longitudOrigen?: number,
  latitudDestino?: number,
  longitudDestino?: number,
  paradas?: Array<{ direccion?: string; lat?: number; lon?: number }>
): Promise<{ precio: number; distanciaKm: number; tiempoEstimado: number }> {
  const remiseria = await prisma.remiseria.findFirst({ where: { estado: true } }) || await prisma.remiseria.findFirst();
  const bajadaBandera = remiseria?.bajadaBandera || 3500;
  const valorKm = remiseria?.valorKm || 1200;

  let distanciaKm = 0;
  let tiempoEstimado = 10;
  let calculatedViaRoute = false;

  // Armar lista de coordenadas ordenadas: Origen -> Parada 1 -> Parada 2 -> ... -> Destino
  const puntosValidos: Array<{ lat: number; lon: number }> = [];
  if (latitudOrigen && longitudOrigen) {
    puntosValidos.push({ lat: latitudOrigen, lon: longitudOrigen });
  }

  if (Array.isArray(paradas)) {
    for (const p of paradas) {
      if (p.lat && p.lon) {
        puntosValidos.push({ lat: p.lat, lon: p.lon });
      }
    }
  }

  if (latitudDestino && longitudDestino) {
    puntosValidos.push({ lat: latitudDestino, lon: longitudDestino });
  }

  if (puntosValidos.length >= 2) {
    try {
      const coordsQuery = puntosValidos.map((pt) => `${pt.lon},${pt.lat}`).join(';');
      const url = `http://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=false`;
      const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
      const data = (await response.json()) as any;
      if (data.routes && data.routes.length > 0) {
        distanciaKm = data.routes[0].distance / 1000;
        distanciaKm = Math.round(distanciaKm * 10) / 10;
        tiempoEstimado = Math.max(5, Math.round(data.routes[0].duration / 60));
        calculatedViaRoute = true;
      }
    } catch (error) {
      console.warn('Fallo OSRM, calculando con Haversine acumulado por puntos:', error);
      // Fallback a suma Haversine punto a punto + 30% por trama urbana
      let distTotal = 0;
      for (let i = 0; i < puntosValidos.length - 1; i++) {
        distTotal += calcularDistanciaHaversine(
          puntosValidos[i].lat,
          puntosValidos[i].lon,
          puntosValidos[i + 1].lat,
          puntosValidos[i + 1].lon
        );
      }
      distanciaKm = Math.round(distTotal * 1.3 * 10) / 10;
      tiempoEstimado = Math.max(6, Math.round(distanciaKm * 2.5));
      calculatedViaRoute = true;
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
    const extraPorParada = (Array.isArray(paradas) ? paradas.length : 0) * 2.0;
    const estimatedDistance = baseDistance + ((absHash % 100) / 100) * maxDistanceRange + extraPorParada;
    distanciaKm = Math.round(estimatedDistance * 10) / 10;
    tiempoEstimado = Math.max(8, Math.round(distanciaKm * 2.8));
  }

  // Si hubo paradas que no tenían coordenadas en el ruteo OSRM, sumar su distancia estimada
  const paradasValidas = Array.isArray(paradas)
    ? paradas.filter((p) => p && typeof p.direccion === 'string' && p.direccion.trim().length > 0)
    : [];
  const cantidadParadas = paradasValidas.length;
  if (calculatedViaRoute && cantidadParadas > 0) {
    const paradasConCoords = puntosValidos.length - (latitudOrigen && longitudOrigen ? 1 : 0) - (latitudDestino && longitudDestino ? 1 : 0);
    const paradasSinCoords = Math.max(0, cantidadParadas - Math.max(0, paradasConCoords));
    if (paradasSinCoords > 0) {
      distanciaKm += paradasSinCoords * 2.0;
      distanciaKm = Math.round(distanciaKm * 10) / 10;
      tiempoEstimado += paradasSinCoords * 5;
    }
  }

  let precioEstimado = bajadaBandera;
  if (distanciaKm > 1) {
    precioEstimado += (distanciaKm - 1) * valorKm;
  }

  // Cada parada intermedia suma recargo por parada (detención/espera corta y desvío mínimo)
  if (cantidadParadas > 0) {
    const recargoParada = Math.round((valorKm * 1.5) / 100) * 100;
    precioEstimado += cantidadParadas * recargoParada;
  }

  // Redondear siempre en múltiplos de 100
  precioEstimado = Math.round(precioEstimado / 100) * 100;

  return {
    precio: precioEstimado,
    distanciaKm,
    tiempoEstimado
  };
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
