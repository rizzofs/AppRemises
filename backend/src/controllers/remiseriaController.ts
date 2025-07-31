import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { CreateRemiseriaRequest, UpdateRemiseriaRequest, AuthenticatedRequest, ApiResponse } from '../types';

export const getAllRemiserias = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rol, id: userId } = req.user!;

    let remiserias;

    if (rol === 'ADMIN') {
      // Admin ve todas las remiserías
      remiserias = await prisma.remiseria.findMany({
        include: {
          duenios: {
            include: {
              duenio: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      activo: true
                    }
                  }
                }
              }
            }
          },
          coordinadores: {
            select: {
              id: true,
              nombre: true,
              email: true,
              activo: true
            }
          },
          choferes: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true,
              estado: true
            }
          },
          vehiculos: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true,
              estado: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } else {
      // Dueño ve solo sus remiserías
      const duenio = await prisma.duenio.findUnique({
        where: { userId },
        include: {
          remiserias: {
            include: {
              remiseria: {
                include: {
                  duenios: {
                    include: {
                      duenio: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              email: true,
                              activo: true
                            }
                          }
                        }
                      }
                    }
                  },
                  coordinadores: {
                    select: {
                      id: true,
                      nombre: true,
                      email: true,
                      activo: true
                    }
                  },
                  choferes: {
                    select: {
                      id: true,
                      numeroChofer: true,
                      nombre: true,
                      apellido: true,
                      estado: true
                    }
                  },
                  vehiculos: {
                    select: {
                      id: true,
                      patente: true,
                      marca: true,
                      modelo: true,
                      estado: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      remiserias = duenio?.remiserias.map(rd => rd.remiseria) || [];
    }

    const response: ApiResponse = {
      success: true,
      data: remiserias
    };

    res.json(response);
  } catch (error) {
    console.error('Error al obtener remiserías:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const getRemiseriaById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rol, id: userId } = req.user!;

    let remiseria;

    if (rol === 'ADMIN') {
      remiseria = await prisma.remiseria.findUnique({
        where: { id },
        include: {
          duenios: {
            include: {
              duenio: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      activo: true
                    }
                  }
                }
              }
            }
          }
        }
      });
    } else {
      // Verificar que el dueño tiene acceso a esta remisería
      const duenio = await prisma.duenio.findUnique({
        where: { userId },
        include: {
          remiserias: {
            where: {
              remiseriaId: id
            },
            include: {
              remiseria: {
                include: {
                  duenios: {
                    include: {
                      duenio: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              email: true,
                              activo: true
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      remiseria = duenio?.remiserias[0]?.remiseria;
    }

    if (!remiseria) {
      return res.status(404).json({
        success: false,
        error: 'Remisería no encontrada'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: remiseria
    };

    res.json(response);
  } catch (error) {
    console.error('Error al obtener remisería:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const createRemiseria = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nombreFantasia, razonSocial, cuit, direccion, telefono, duenioIds }: CreateRemiseriaRequest = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Crear la remisería
      const remiseria = await tx.remiseria.create({
        data: {
          nombreFantasia,
          razonSocial,
          cuit,
          direccion,
          telefono
        }
      });

      // Asociar dueños si se proporcionan
      if (duenioIds && duenioIds.length > 0) {
        await tx.remiseriaDuenio.createMany({
          data: duenioIds.map(duenioId => ({
            remiseriaId: remiseria.id,
            duenioId
          }))
        });
      }

      return remiseria;
    });

    // Track creation if user is authenticated
    if (req.user) {
      await prisma.appUsage.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'CREATE_REMISERIA',
          details: JSON.stringify({ remiseriaId: result.id, nombreFantasia }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        }
      });
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Remisería creada exitosamente'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error al crear remisería:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const updateRemiseria = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rol, id: userId } = req.user!;
    const { nombreFantasia, razonSocial, cuit, direccion, telefono, estado, duenioIds }: UpdateRemiseriaRequest = req.body;

    // Verificar acceso
    if (rol === 'DUENIO') {
      const duenio = await prisma.duenio.findUnique({
        where: { userId },
        include: {
          remiserias: {
            where: {
              remiseriaId: id
            }
          }
        }
      });

      if (!duenio || duenio.remiserias.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permisos para modificar esta remisería'
        });
      }

      // Dueños NO pueden modificar: nombreFantasia, razonSocial, cuit, estado, duenioIds
      if (nombreFantasia !== undefined || razonSocial !== undefined || cuit !== undefined || 
          estado !== undefined || duenioIds !== undefined) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permisos para modificar nombre, razón social, CUIT, estado o dueños'
        });
      }
    }

    // Construir datos de actualización según permisos
    const updateData: any = {};
    
    // Solo admin puede modificar estos campos
    if (rol === 'ADMIN') {
      if (nombreFantasia !== undefined) updateData.nombreFantasia = nombreFantasia;
      if (razonSocial !== undefined) updateData.razonSocial = razonSocial;
      if (cuit !== undefined) updateData.cuit = cuit;
      if (estado !== undefined) updateData.estado = estado;
    }
    
    // Ambos pueden modificar dirección y teléfono
    if (direccion !== undefined) updateData.direccion = direccion;
    if (telefono !== undefined) updateData.telefono = telefono;

    const remiseria = await prisma.remiseria.update({
      where: { id },
      data: updateData
    });

    // Solo admin puede modificar dueños asociados
    if (duenioIds !== undefined && rol === 'ADMIN') {
      // Eliminar asociaciones actuales
      await prisma.remiseriaDuenio.deleteMany({
        where: { remiseriaId: id }
      });

      // Crear nuevas asociaciones
      if (duenioIds.length > 0) {
        await prisma.remiseriaDuenio.createMany({
          data: duenioIds.map(duenioId => ({
            remiseriaId: id,
            duenioId
          }))
        });
      }
    }

    // Track update
    await prisma.appUsage.create({
      data: {
        userId,
        userEmail: req.user!.email,
        action: 'UPDATE_REMISERIA',
        details: JSON.stringify({ remiseriaId: id, changes: updateData }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      }
    });

    const response: ApiResponse = {
      success: true,
      data: remiseria,
      message: 'Remisería actualizada exitosamente'
    };

    res.json(response);
  } catch (error) {
    console.error('Error al actualizar remisería:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

export const deleteRemiseria = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { id: userId, email } = req.user!;

    await prisma.remiseria.delete({
      where: { id }
    });

    // Track deletion
    await prisma.appUsage.create({
      data: {
        userId,
        userEmail: email,
        action: 'DELETE_REMISERIA',
        details: JSON.stringify({ remiseriaId: id }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      }
    });

    const response: ApiResponse = {
      success: true,
      message: 'Remisería eliminada exitosamente'
    };

    res.json(response);
  } catch (error) {
    console.error('Error al eliminar remisería:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}; 