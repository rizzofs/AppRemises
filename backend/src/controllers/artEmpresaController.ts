import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

async function resolveRemiseriaId(req: AuthenticatedRequest): Promise<string | null> {
  const userId = req.user?.id;
  const rol = req.user?.rol;

  if (req.query.remiseriaId && typeof req.query.remiseriaId === 'string') {
    return req.query.remiseriaId;
  }
  if (req.body?.remiseriaId && typeof req.body.remiseriaId === 'string') {
    return req.body.remiseriaId;
  }

  if (rol === 'DUENIO' && userId) {
    const duenio = await prisma.duenio.findFirst({
      where: { userId },
      include: {
        remiserias: {
          select: { remiseriaId: true }
        }
      }
    });
    if (duenio && duenio.remiserias.length > 0) {
      return duenio.remiserias[0].remiseriaId;
    }
  }

  if (rol === 'COORDINADOR' && userId) {
    const coord = await prisma.coordinador.findFirst({
      where: { userId },
      select: { remiseriaId: true }
    });
    if (coord) {
      return coord.remiseriaId;
    }
  }

  // Fallback a la primera remisería del sistema
  const first = await prisma.remiseria.findFirst({ select: { id: true } });
  return first?.id || null;
}

export const artEmpresaController = {
  // Listar todas las ART / Empresas asociadas a la remisería
  async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const remiseriaId = await resolveRemiseriaId(req);
      if (!remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró una remisería asociada'
        });
      }

      const soloActivas = req.query.activas === 'true';

      const whereClause: any = { remiseriaId };
      if (soloActivas) {
        whereClause.activo = true;
      }

      const listado = await prisma.artEmpresa.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { viajes: true }
          },
          viajes: {
            where: { estado: 'COMPLETADO' },
            select: {
              precio: true,
              precioArt: true,
              distanciaKmConPasajero: true,
              tiempoEsperaSegundos: true,
              costoEspera: true,
              fecha: true
            }
          }
        },
        orderBy: { nombre: 'asc' }
      });

      const esDuenioOAdmin = req.user?.rol === 'DUENIO' || req.user?.rol === 'ADMIN';

      const data = listado.map(art => {
        const viajesCompletados = art.viajes.length;
        
        // El precio facturado a la ART es el precioArt o calculado con la tarifa ART
        const totalFacturado = art.viajes.reduce((sum, v) => {
          if (v.precioArt && Number(v.precioArt) > 0) return sum + Number(v.precioArt);
          // Si no tiene precioArt explícito, calculamos según la tarifa de la ART
          const km = v.distanciaKmConPasajero || 1;
          let p = art.precioTramo || 0;
          if (km > 1 && art.valorKm > 0) p += (km - 1) * art.valorKm;
          return sum + p;
        }, 0);

        const totalPagaChofer = art.viajes.reduce((sum, v) => sum + Number(v.precio || 0), 0);
        const totalKm = art.viajes.reduce((sum, v) => sum + (v.distanciaKmConPasajero || 0), 0);
        const totalEsperaSeg = art.viajes.reduce((sum, v) => sum + (v.tiempoEsperaSegundos || 0), 0);
        const totalCostoEspera = art.viajes.reduce((sum, v) => sum + (v.costoEspera || 0), 0);

        const { viajes, _count, ...artData } = art;

        // PRIVACIDAD ESTRICTA: Choferes y Coordinadores NUNCA pueden ver las tarifas de facturación ni ganancias
        if (!esDuenioOAdmin) {
          return {
            id: artData.id,
            nombre: artData.nombre,
            activo: artData.activo,
            pagaChoferTipo: artData.pagaChoferTipo,
            choferValorKm: artData.choferValorKm,
            choferPrecioTramo: artData.choferPrecioTramo,
            choferValorHoraEspera: artData.choferValorHoraEspera
          };
        }

        return {
          ...artData,
          totalViajes: _count.viajes,
          viajesCompletados,
          totalFacturado: Math.round(totalFacturado),
          totalPagaChofer: Math.round(totalPagaChofer),
          gananciaEstimada: Math.round(totalFacturado - totalPagaChofer),
          totalKm: Math.round(totalKm * 10) / 10,
          totalEsperaMinutos: Math.round(totalEsperaSeg / 60),
          totalCostoEspera
        };
      });

      return res.json({
        success: true,
        data,
        message: 'ART y Empresas obtenidas exitosamente'
      });
    } catch (error) {
      console.error('Error al obtener ART y Empresas:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor al obtener las ART'
      });
    }
  },

  // Obtener detalle de una ART por ID
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const art = await prisma.artEmpresa.findUnique({
        where: { id },
        include: {
          remiseria: {
            select: { id: true, nombreFantasia: true }
          },
          viajes: {
            take: 20,
            orderBy: { fecha: 'desc' },
            include: {
              chofer: {
                select: { id: true, nombre: true, apellido: true, numeroChofer: true }
              },
              vehiculo: {
                select: { id: true, patente: true, modelo: true }
              }
            }
          }
        }
      });

      if (!art) {
        return res.status(404).json({
          success: false,
          message: 'ART o Empresa no encontrada'
        });
      }

      return res.json({
        success: true,
        data: art
      });
    } catch (error) {
      console.error('Error al obtener ART:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Crear una nueva ART / Empresa con sus tarifas
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const remiseriaId = await resolveRemiseriaId(req);
      if (!remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró la remisería a la cual asociar la ART'
        });
      }

      const {
        nombre,
        cuit,
        razonSocial,
        telefono,
        email,
        direccion,
        valorKm,
        precioTramo,
        valorHoraEspera,
        observaciones,
        activo,
        pagaChoferTipo,
        choferValorKm,
        choferPrecioTramo,
        choferValorHoraEspera
      } = req.body;

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre de la ART o Empresa es obligatorio'
        });
      }

      const parsedValorKm = parseFloat(valorKm) || 0;
      const parsedPrecioTramo = parseFloat(precioTramo) || 0;
      const parsedValorHoraEspera = parseFloat(valorHoraEspera) || 0;

      if (parsedValorKm < 0 || parsedPrecioTramo < 0 || parsedValorHoraEspera < 0) {
        return res.status(400).json({
          success: false,
          message: 'Los precios no pueden ser negativos'
        });
      }

      const nuevaArt = await prisma.artEmpresa.create({
        data: {
          nombre: nombre.trim(),
          cuit: cuit ? cuit.trim() : null,
          razonSocial: razonSocial ? razonSocial.trim() : null,
          telefono: telefono ? telefono.trim() : null,
          email: email ? email.trim() : null,
          direccion: direccion ? direccion.trim() : null,
          valorKm: parsedValorKm,
          precioTramo: parsedPrecioTramo,
          valorHoraEspera: parsedValorHoraEspera,
          pagaChoferTipo: pagaChoferTipo || 'LISTA_NORMAL',
          choferValorKm: choferValorKm !== undefined ? parseFloat(choferValorKm) || 0 : null,
          choferPrecioTramo: choferPrecioTramo !== undefined ? parseFloat(choferPrecioTramo) || 0 : null,
          choferValorHoraEspera: choferValorHoraEspera !== undefined ? parseFloat(choferValorHoraEspera) || 0 : null,
          observaciones: observaciones ? observaciones.trim() : null,
          activo: activo !== undefined ? Boolean(activo) : true,
          remiseriaId
        }
      });

      return res.status(201).json({
        success: true,
        data: nuevaArt,
        message: `ART "${nuevaArt.nombre}" creada exitosamente`
      });
    } catch (error) {
      console.error('Error al crear ART:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al registrar la ART'
      });
    }
  },

  // Modificar tarifas o datos de una ART
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        nombre,
        cuit,
        razonSocial,
        telefono,
        email,
        direccion,
        valorKm,
        precioTramo,
        valorHoraEspera,
        observaciones,
        activo,
        pagaChoferTipo,
        choferValorKm,
        choferPrecioTramo,
        choferValorHoraEspera
      } = req.body;

      const artExistente = await prisma.artEmpresa.findUnique({
        where: { id }
      });

      if (!artExistente) {
        return res.status(404).json({
          success: false,
          message: 'ART o Empresa no encontrada'
        });
      }

      const dataToUpdate: any = {};
      if (nombre !== undefined) dataToUpdate.nombre = nombre.trim();
      if (cuit !== undefined) dataToUpdate.cuit = cuit ? cuit.trim() : null;
      if (razonSocial !== undefined) dataToUpdate.razonSocial = razonSocial ? razonSocial.trim() : null;
      if (telefono !== undefined) dataToUpdate.telefono = telefono ? telefono.trim() : null;
      if (email !== undefined) dataToUpdate.email = email ? email.trim() : null;
      if (direccion !== undefined) dataToUpdate.direccion = direccion ? direccion.trim() : null;
      if (observaciones !== undefined) dataToUpdate.observaciones = observaciones ? observaciones.trim() : null;
      if (activo !== undefined) dataToUpdate.activo = Boolean(activo);

      if (valorKm !== undefined) {
        const vKm = parseFloat(valorKm);
        if (vKm < 0) return res.status(400).json({ success: false, message: 'El precio por km no puede ser negativo' });
        dataToUpdate.valorKm = vKm;
      }
      if (precioTramo !== undefined) {
        const pTramo = parseFloat(precioTramo);
        if (pTramo < 0) return res.status(400).json({ success: false, message: 'El precio por tramo no puede ser negativo' });
        dataToUpdate.precioTramo = pTramo;
      }
      if (valorHoraEspera !== undefined) {
        const vEspera = parseFloat(valorHoraEspera);
        if (vEspera < 0) return res.status(400).json({ success: false, message: 'El precio de hora de espera no puede ser negativo' });
        dataToUpdate.valorHoraEspera = vEspera;
      }

      if (pagaChoferTipo !== undefined) {
        dataToUpdate.pagaChoferTipo = pagaChoferTipo;
      }
      if (choferValorKm !== undefined) {
        dataToUpdate.choferValorKm = parseFloat(choferValorKm) || 0;
      }
      if (choferPrecioTramo !== undefined) {
        dataToUpdate.choferPrecioTramo = parseFloat(choferPrecioTramo) || 0;
      }
      if (choferValorHoraEspera !== undefined) {
        dataToUpdate.choferValorHoraEspera = parseFloat(choferValorHoraEspera) || 0;
      }

      const artActualizada = await prisma.artEmpresa.update({
        where: { id },
        data: dataToUpdate
      });

      return res.json({
        success: true,
        data: artActualizada,
        message: 'ART actualizada exitosamente'
      });
    } catch (error) {
      console.error('Error al actualizar ART:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al actualizar la ART'
      });
    }
  },

  // Cambiar estado activo/inactivo
  async toggleActivo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const art = await prisma.artEmpresa.findUnique({ where: { id } });
      if (!art) {
        return res.status(404).json({ success: false, message: 'ART no encontrada' });
      }

      const actualizada = await prisma.artEmpresa.update({
        where: { id },
        data: { activo: !art.activo }
      });

      return res.json({
        success: true,
        data: actualizada,
        message: `ART ${actualizada.activo ? 'activada' : 'desactivada'} exitosamente`
      });
    } catch (error) {
      console.error('Error al alternar estado de ART:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Eliminar ART (o desactivar si tiene viajes históricos)
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const tieneViajes = await prisma.viaje.count({ where: { artEmpresaId: id } });

      if (tieneViajes > 0) {
        // En lugar de borrar y perder historial contable, desactivamos
        await prisma.artEmpresa.update({
          where: { id },
          data: { activo: false }
        });
        return res.json({
          success: true,
          message: `La ART tiene ${tieneViajes} viajes registrados. Se ha desactivado para conservar el historial de facturación.`
        });
      }

      await prisma.artEmpresa.delete({ where: { id } });

      return res.json({
        success: true,
        message: 'ART eliminada correctamente'
      });
    } catch (error) {
      console.error('Error al eliminar ART:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al eliminar la ART'
      });
    }
  },

  // Reporte detallado de FACTURACIÓN por ART
  async getFacturacion(req: AuthenticatedRequest, res: Response) {
    try {
      const remiseriaId = await resolveRemiseriaId(req);
      if (!remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró la remisería asociada'
        });
      }

      const { artEmpresaId, desde, hasta, estado } = req.query;

      const whereClause: any = {
        remiseriaId,
        artEmpresaId: { not: null }
      };

      if (artEmpresaId && artEmpresaId !== 'all') {
        whereClause.artEmpresaId = artEmpresaId as string;
      }

      if (estado && estado !== 'TODOS') {
        whereClause.estado = estado as string;
      } else if (!estado) {
        // Por defecto en facturación, viajes COMPLETADOS
        whereClause.estado = 'COMPLETADO';
      }

      if (desde || hasta) {
        whereClause.fecha = {};
        if (desde && typeof desde === 'string') {
          const d = new Date(desde);
          d.setHours(0, 0, 0, 0);
          whereClause.fecha.gte = d;
        }
        if (hasta && typeof hasta === 'string') {
          const h = new Date(hasta);
          h.setHours(23, 59, 59, 999);
          whereClause.fecha.lte = h;
        }
      }

      const viajes = await prisma.viaje.findMany({
        where: whereClause,
        include: {
          artEmpresa: {
            select: {
              id: true,
              nombre: true,
              cuit: true,
              razonSocial: true,
              valorKm: true,
              precioTramo: true,
              valorHoraEspera: true
            }
          },
          chofer: {
            select: {
              id: true,
              numeroChofer: true,
              nombre: true,
              apellido: true
            }
          },
          vehiculo: {
            select: {
              id: true,
              patente: true,
              marca: true,
              modelo: true
            }
          },
          cliente: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              dni: true
            }
          }
        },
        orderBy: { fecha: 'desc' }
      });

      // Mapear cada viaje calculando la tarifa ART vs paga chofer
      const viajesMapeados = viajes.map((v: any) => {
        let precioFacturaArt = v.precioArt ? Number(v.precioArt) : 0;
        if (!precioFacturaArt && v.artEmpresa) {
          const km = v.distanciaKmConPasajero || 1;
          let p = v.artEmpresa.precioTramo || 0;
          if (km > 1 && v.artEmpresa.valorKm > 0) {
            p += (km - 1) * v.artEmpresa.valorKm;
          }
          if (v.costoEspera && v.costoEspera > 0) {
            p += v.costoEspera;
          } else if (v.tiempoEsperaSegundos > 0 && v.artEmpresa.valorHoraEspera > 0) {
            p += (v.tiempoEsperaSegundos / 3600) * v.artEmpresa.valorHoraEspera;
          }
          precioFacturaArt = Math.round(p / 50) * 50;
        }

        const pagaChofer = Number(v.precio || 0);
        const gananciaNeta = Math.max(0, precioFacturaArt - pagaChofer);

        return {
          ...v,
          precioFacturaArt,
          pagaChofer,
          gananciaNeta
        };
      });

      // Calcular métricas globales
      const totalViajes = viajesMapeados.length;
      const totalFacturado = viajesMapeados.reduce((sum, v) => sum + v.precioFacturaArt, 0);
      const totalPagaChofer = viajesMapeados.reduce((sum, v) => sum + v.pagaChofer, 0);
      const totalGanancia = Math.max(0, totalFacturado - totalPagaChofer);
      const totalKm = viajesMapeados.reduce((sum, v) => sum + (v.distanciaKmConPasajero || 0), 0);
      const totalEsperaSegundos = viajesMapeados.reduce((sum, v) => sum + (v.tiempoEsperaSegundos || 0), 0);
      const totalCostoEspera = viajesMapeados.reduce((sum, v) => sum + (v.costoEspera || 0), 0);

      // Agrupar por ART
      const porArtMap = new Map<string, {
        artEmpresa: any;
        totalViajes: number;
        totalFacturado: number;
        totalPagaChofer: number;
        totalGanancia: number;
        totalKm: number;
        totalEsperaMinutos: number;
        totalCostoEspera: number;
        viajes: any[];
      }>();

      for (const v of viajesMapeados) {
        if (!v.artEmpresa) continue;
        const artId = v.artEmpresa.id;
        if (!porArtMap.has(artId)) {
          porArtMap.set(artId, {
            artEmpresa: v.artEmpresa,
            totalViajes: 0,
            totalFacturado: 0,
            totalPagaChofer: 0,
            totalGanancia: 0,
            totalKm: 0,
            totalEsperaMinutos: 0,
            totalCostoEspera: 0,
            viajes: []
          });
        }
        const item = porArtMap.get(artId)!;
        item.totalViajes += 1;
        item.totalFacturado += v.precioFacturaArt;
        item.totalPagaChofer += v.pagaChofer;
        item.totalGanancia += v.gananciaNeta;
        item.totalKm += v.distanciaKmConPasajero || 0;
        item.totalEsperaMinutos += Math.round((v.tiempoEsperaSegundos || 0) / 60);
        item.totalCostoEspera += v.costoEspera || 0;
        item.viajes.push(v);
      }

      const porArt = Array.from(porArtMap.values()).map(a => ({
        ...a,
        totalKm: Math.round(a.totalKm * 10) / 10
      }));

      return res.json({
        success: true,
        data: {
          resumen: {
            totalViajes,
            totalFacturado: Math.round(totalFacturado),
            totalPagaChofer: Math.round(totalPagaChofer),
            totalGanancia: Math.round(totalGanancia),
            totalKm: Math.round(totalKm * 10) / 10,
            totalEsperaMinutos: Math.round(totalEsperaSegundos / 60),
            totalCostoEspera,
            promedioPorViaje: totalViajes > 0 ? Math.round(totalFacturado / totalViajes) : 0
          },
          porArt,
          viajes: viajesMapeados
        },
        message: 'Datos de facturación de ART obtenidos con éxito'
      });
    } catch (error) {
      console.error('Error al generar facturación ART:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al generar la facturación de ART'
      });
    }
  },

  // Asignar o cambiar ART de un viaje existente
  async asignarViajeArt(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const { artEmpresaId, numeroSiniestro, recalcularTarifa } = req.body;

      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
        include: { artEmpresa: true }
      });

      if (!viaje) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado'
        });
      }

      let precioActualizado = viaje.precio;

      if (artEmpresaId) {
        const art = await prisma.artEmpresa.findUnique({ where: { id: artEmpresaId } });
        if (!art) {
          return res.status(404).json({ success: false, message: 'ART no encontrada' });
        }

        // Si se solicita recalcular la tarifa según los valores de la ART
        if (recalcularTarifa && (art.precioTramo > 0 || art.valorKm > 0)) {
          const km = viaje.distanciaKmConPasajero || 1;
          let nuevoPrecio = art.precioTramo;
          if (km > 1 && art.valorKm > 0) {
            nuevoPrecio += (km - 1) * art.valorKm;
          }
          if (viaje.tiempoEsperaSegundos > 0 && art.valorHoraEspera > 0) {
            const horas = viaje.tiempoEsperaSegundos / 3600;
            nuevoPrecio += horas * art.valorHoraEspera;
          }
          // Redondear a múltiplos de 50
          nuevoPrecio = Math.round(nuevoPrecio / 50) * 50;
          if (nuevoPrecio > 0) {
            precioActualizado = nuevoPrecio as any;
          }
        }
      }

      const viajeModificado = await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          artEmpresaId: artEmpresaId || null,
          numeroSiniestro: numeroSiniestro !== undefined ? numeroSiniestro : viaje.numeroSiniestro,
          precio: precioActualizado
        },
        include: {
          artEmpresa: true,
          chofer: true,
          vehiculo: true
        }
      });

      return res.json({
        success: true,
        data: viajeModificado,
        message: artEmpresaId 
          ? `Viaje asignado a ART exitosamente` 
          : 'Asignación de ART removida del viaje'
      });
    } catch (error) {
      console.error('Error al asignar ART al viaje:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al actualizar la asignación de ART'
      });
    }
  }
};
