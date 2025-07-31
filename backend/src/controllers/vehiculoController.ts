import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const vehiculoController = {
  // Obtener todos los vehículos
  async getAll(req: Request, res: Response) {
    try {
      const vehiculos = await prisma.vehiculo.findMany({
        where: {
          // Removemos el filtro de estado para obtener todos
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: vehiculos,
      });
    } catch (error) {
      console.error('Error getting vehiculos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener vehículos por remisería
  async getByRemiseria(req: Request, res: Response) {
    try {
      const { remiseriaId } = req.params;

      const vehiculos = await prisma.vehiculo.findMany({
        where: {
          remiseriaId,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: vehiculos,
      });
    } catch (error) {
      console.error('Error getting vehiculos by remiseria:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Obtener vehículo por ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const vehiculo = await prisma.vehiculo.findFirst({
        where: {
          id,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
            },
          },
        },
      });

      if (!vehiculo) {
        return res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
      }

      res.json({
        success: true,
        data: vehiculo,
      });
    } catch (error) {
      console.error('Error getting vehiculo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Crear vehículo
  async create(req: Request, res: Response) {
    try {
      const { 
        patente, 
        marca, 
        modelo, 
        anio, 
        color, 
        tipo, 
        capacidad, 
        propietario, 
        vtoVtv, 
        vtoMatafuego, 
        vtoSeguro, 
        observaciones, 
        remiseriaId 
      } = req.body;

      // Validar campos requeridos
      if (!patente || !marca || !modelo || !anio || !color || !tipo || !capacidad || !propietario || !remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'Los campos patente, marca, modelo, año, color, tipo, capacidad, propietario y remisería son requeridos',
        });
      }

      // Verificar si la patente ya existe
      const existingVehiculo = await prisma.vehiculo.findFirst({
        where: {
          patente,
        },
      });

      if (existingVehiculo) {
        return res.status(400).json({
          success: false,
          message: 'La patente ya está registrada',
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

      const vehiculo = await prisma.vehiculo.create({
        data: {
          patente,
          marca,
          modelo,
          anio,
          color,
          tipo,
          capacidad,
          propietario,
          vtoVtv: vtoVtv ? new Date(vtoVtv) : null,
          vtoMatafuego: vtoMatafuego ? new Date(vtoMatafuego) : null,
          vtoSeguro: vtoSeguro ? new Date(vtoSeguro) : null,
          observaciones,
          remiseriaId,
        },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: vehiculo,
        message: 'Vehículo creado exitosamente',
      });
    } catch (error) {
      console.error('Error creating vehiculo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Actualizar vehículo
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { 
        patente, 
        marca, 
        modelo, 
        anio, 
        color, 
        tipo, 
        capacidad, 
        propietario, 
        vtoVtv, 
        vtoMatafuego, 
        vtoSeguro, 
        observaciones, 
        estado 
      } = req.body;

      // Verificar que el vehículo existe
      const existingVehiculo = await prisma.vehiculo.findFirst({
        where: {
          id,
        },
      });

      if (!existingVehiculo) {
        return res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
      }

      // Si se está cambiando la patente, verificar que no exista
      if (patente && patente !== existingVehiculo.patente) {
        const patenteExists = await prisma.vehiculo.findFirst({
          where: {
            patente,
            id: { not: id },
          },
        });

        if (patenteExists) {
          return res.status(400).json({
            success: false,
            message: 'La patente ya está registrada',
          });
        }
      }

      // Preparar datos de actualización
      const updateData: any = {};
      if (patente) updateData.patente = patente;
      if (marca) updateData.marca = marca;
      if (modelo) updateData.modelo = modelo;
      if (anio) updateData.anio = anio;
      if (color) updateData.color = color;
      if (tipo) updateData.tipo = tipo;
      if (capacidad) updateData.capacidad = capacidad;
      if (propietario) updateData.propietario = propietario;
      if (vtoVtv !== undefined) updateData.vtoVtv = vtoVtv ? new Date(vtoVtv) : null;
      if (vtoMatafuego !== undefined) updateData.vtoMatafuego = vtoMatafuego ? new Date(vtoMatafuego) : null;
      if (vtoSeguro !== undefined) updateData.vtoSeguro = vtoSeguro ? new Date(vtoSeguro) : null;
      if (observaciones !== undefined) updateData.observaciones = observaciones;
      if (estado) updateData.estado = estado;

      const vehiculo = await prisma.vehiculo.update({
        where: { id },
        data: updateData,
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: vehiculo,
        message: 'Vehículo actualizado exitosamente',
      });
    } catch (error) {
      console.error('Error updating vehiculo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Baja lógica del vehículo
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verificar que el vehículo existe
      const vehiculo = await prisma.vehiculo.findFirst({
        where: {
          id,
        },
      });

      if (!vehiculo) {
        return res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
      }

      // Baja lógica (marcar como inactivo)
      await prisma.vehiculo.update({
        where: { id },
        data: { estado: 'INACTIVO' },
      });

      res.json({
        success: true,
        message: 'Vehículo eliminado exitosamente',
      });
    } catch (error) {
      console.error('Error deleting vehiculo:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },

  // Cambiar estado del vehículo
  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      if (!estado || !['ACTIVO', 'MANTENIMIENTO', 'INACTIVO'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido. Debe ser ACTIVO, MANTENIMIENTO o INACTIVO',
        });
      }

      const vehiculo = await prisma.vehiculo.findUnique({
        where: { id },
      });

      if (!vehiculo) {
        return res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado',
        });
      }

      const updatedVehiculo = await prisma.vehiculo.update({
        where: { id },
        data: { estado },
        include: {
          remiseria: {
            select: {
              id: true,
              nombreFantasia: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: updatedVehiculo,
        message: `Vehículo ${estado.toLowerCase()} exitosamente`,
      });
    } catch (error) {
      console.error('Error updating vehiculo status:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  },
}; 