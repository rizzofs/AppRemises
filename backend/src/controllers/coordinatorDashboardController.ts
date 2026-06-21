import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';
import bcrypt from 'bcryptjs';


export const coordinatorDashboardController = {
  // Obtener viajes en curso
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
          estado: 'EN_CURSO'
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
          remiseriaId: coordinador.remiseriaId,
          estado: 'PENDIENTE',
          choferId: null
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
          remiseriaId: coordinador.remiseriaId,
          estado: 'PENDIENTE'
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

      const { valorKm, bajadaBandera } = coordinador.remiseria;

      let distanciaKm = 0;
      let calculatedViaRoute = false;

      // Intentar calcular distancia real usando OSRM si las coordenadas están presentes
      if (latOrigen && lonOrigen && latDestino && lonDestino) {
        try {
          const url = `http://router.project-osrm.org/route/v1/driving/${lonOrigen},${latOrigen};${lonDestino},${latDestino}?overview=false`;
          const response = await fetch(url);
          const data = await response.json() as any;
          if (data.routes && data.routes.length > 0) {
            distanciaKm = data.routes[0].distance / 1000;
            distanciaKm = Math.round(distanciaKm * 10) / 10;
            calculatedViaRoute = true;
          }
        } catch (error) {
          console.error('Error al consultar OSRM routing API:', error);
        }
      }

      // Si no hay coordenadas o falla el cálculo por ruta, usar la estimación determinista como fallback
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

      // Fórmula solicitada por el usuario:
      // Bajada de bandera incluye de 0 a 1 KM. 
      // Por cada KM restante se le suma valorKm.
      let precioEstimado = bajadaBandera;
      if (distanciaKm > 1) {
        precioEstimado += (distanciaKm - 1) * valorKm;
      }
      precioEstimado = Math.round(precioEstimado);

      res.json({
        success: true,
        data: {
          origen,
          destino,
          distanciaKm,
          precioEstimado,
          bajadaBandera,
          valorKm,
          calculatedViaRoute
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

  // Geocodificación de direcciones usando OpenStreetMap Nominatim
  async geocode(req: Request, res: Response) {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Query es requerido'
        });
      }

      const queryString = q as string;
      const hasCityConstraint = /,/g.test(queryString) || /chivilcoy|buenos\s+aires|caba|federal|ezeiza|retiro|lujan|mercedes/i.test(queryString);
      
      // Caja de límites aproximada para Chivilcoy para dar prioridad (viewbox bias)
      const viewboxParam = 'viewbox=-60.15,-34.83,-59.88,-34.96';
      
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString)}&countrycodes=ar&limit=5&addressdetails=1&${viewboxParam}&bounded=0`;
      
      if (!hasCityConstraint) {
        url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString + ', Chivilcoy')}&countrycodes=ar&limit=5&addressdetails=1&${viewboxParam}&bounded=0`;
      }

      let response = await fetch(url, {
        headers: {
          'User-Agent': 'AppRemises/1.0 (coordinacion@remises.com)'
        }
      });
      let data = await response.json() as any[];

      // Si no encontramos nada con la restricción local y el usuario no especificó una ciudad externa,
      // reintentamos una búsqueda general en Argentina sin el sufijo de Chivilcoy.
      if (!hasCityConstraint && (!data || data.length === 0)) {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString)}&countrycodes=ar&limit=5&addressdetails=1&${viewboxParam}&bounded=0`;
        const fallbackResponse = await fetch(fallbackUrl, {
          headers: {
            'User-Agent': 'AppRemises/1.0 (coordinacion@remises.com)'
          }
        });
        data = await fallbackResponse.json() as any[];
      }

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
              telefono: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: vehiculos
      });
    } catch (error) {
      console.error('Error getting vehiculos tiempo real:', error);
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

      const choferes = await prisma.chofer.findMany({
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
        }
      });

      res.json({
        success: true,
        data: choferes
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

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const [
        viajesEnCurso,
        viajesSinAsignar,
        reservasActivas,
        totalVehiculos,
        totalChoferes
      ] = await Promise.all([
        prisma.viaje.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'EN_CURSO'
          }
        }),
        prisma.viaje.count({
          where: {
            remiseriaId: coordinador.remiseriaId,
            estado: 'PENDIENTE',
            choferId: null
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
        })
      ]);

      res.json({
        success: true,
        data: {
          viajesEnCurso,
          viajesSinAsignar,
          reservasActivas,
          totalVehiculos,
          totalChoferes
        }
      });
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}; 