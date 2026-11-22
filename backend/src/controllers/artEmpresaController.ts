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
        choferValorHoraEspera,
        periodoFacturacion,
        diaCorteFacturacion
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
          periodoFacturacion: ['SEMANAL', 'QUINCENAL', 'MENSUAL'].includes(periodoFacturacion) ? periodoFacturacion : 'MENSUAL',
          diaCorteFacturacion: diaCorteFacturacion !== undefined ? parseInt(diaCorteFacturacion, 10) || null : null,
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
        choferValorHoraEspera,
        periodoFacturacion,
        diaCorteFacturacion
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
      if (periodoFacturacion !== undefined && ['SEMANAL', 'QUINCENAL', 'MENSUAL'].includes(periodoFacturacion)) {
        dataToUpdate.periodoFacturacion = periodoFacturacion;
      }
      if (diaCorteFacturacion !== undefined) {
        dataToUpdate.diaCorteFacturacion = diaCorteFacturacion ? parseInt(diaCorteFacturacion, 10) : null;
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
        const peajes = Number(v.montoPeajes || 0);
        const precioFacturaArtTotal = precioFacturaArt + peajes;
        const pagaChoferTotal = pagaChofer + peajes;
        const gananciaNeta = Math.max(0, precioFacturaArt - pagaChofer); // El peaje es un reintegro directo (pass-through)

        return {
          ...v,
          precioFacturaArt,
          precioFacturaArtTotal,
          pagaChofer,
          pagaChoferTotal,
          peajes,
          gananciaNeta
        };
      });

      // Calcular métricas globales
      const totalViajes = viajesMapeados.length;
      const totalFacturado = viajesMapeados.reduce((sum, v) => sum + v.precioFacturaArt, 0);
      const totalPeajes = viajesMapeados.reduce((sum, v) => sum + (v.peajes || 0), 0);
      const totalFacturadoTotal = totalFacturado + totalPeajes;
      const totalPagaChofer = viajesMapeados.reduce((sum, v) => sum + v.pagaChofer, 0);
      const totalPagaChoferTotal = totalPagaChofer + totalPeajes;
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
            totalPeajes: Math.round(totalPeajes),
            totalFacturadoTotal: Math.round(totalFacturadoTotal),
            totalPagaChofer: Math.round(totalPagaChofer),
            totalPagaChoferTotal: Math.round(totalPagaChoferTotal),
            totalGanancia: Math.round(totalGanancia),
            totalKm: Math.round(totalKm * 10) / 10,
            totalEsperaMinutos: Math.round(totalEsperaSegundos / 60),
            totalCostoEspera,
            promedioPorViaje: totalViajes > 0 ? Math.round(totalFacturadoTotal / totalViajes) : 0
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
  },

  // Crear y asignar viaje de ART / Empresa a un chofer
  async crearViajeArt(req: AuthenticatedRequest, res: Response) {
    try {
      const remiseriaId = await resolveRemiseriaId(req);
      if (!remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró la remisería asociada'
        });
      }

      const {
        artEmpresaId,
        choferId,
        vehiculoId,
        clienteNombre,
        clienteTelefono,
        clienteDni,
        numeroSiniestro,
        origen,
        destino,
        fecha, // 'YYYY-MM-DD'
        horaSalidaChofer, // '08:00'
        horaTurno, // '10:00'
        distanciaKm,
        precio,
        precioArt,
        observaciones
      } = req.body;

      if (!artEmpresaId) {
        return res.status(400).json({ success: false, message: 'La ART o Empresa es requerida' });
      }
      if (!choferId) {
        return res.status(400).json({ success: false, message: 'Debe seleccionar un chofer para el viaje' });
      }
      if (!clienteNombre || !clienteNombre.trim()) {
        return res.status(400).json({ success: false, message: 'El nombre del pasajero es requerido' });
      }
      if (!origen || !origen.trim() || !destino || !destino.trim()) {
        return res.status(400).json({ success: false, message: 'Origen y Destino son obligatorios' });
      }
      if (!fecha) {
        return res.status(400).json({ success: false, message: 'La fecha del viaje es obligatoria' });
      }
      if (!horaSalidaChofer) {
        return res.status(400).json({ success: false, message: 'La hora de salida del chofer es obligatoria' });
      }

      // Validar existencia de ART
      const art = await prisma.artEmpresa.findUnique({ where: { id: artEmpresaId } });
      if (!art) {
        return res.status(404).json({ success: false, message: 'ART o Empresa no encontrada' });
      }

      // Validar chofer
      const chofer = await prisma.chofer.findUnique({
        where: { id: choferId },
        include: { vehiculo: true }
      });
      if (!chofer) {
        return res.status(404).json({ success: false, message: 'Chofer no encontrado' });
      }

      const vehiculoIdFinal = vehiculoId || chofer.vehiculoId || null;

      // Construir timestamp de fecha combinando fecha y horaSalidaChofer
      const fechaParts = fecha.split('-');
      const horaParts = (horaSalidaChofer || '08:00').split(':');
      const year = parseInt(fechaParts[0], 10);
      const month = parseInt(fechaParts[1], 10) - 1;
      const day = parseInt(fechaParts[2], 10);
      const hour = parseInt(horaParts[0] || '8', 10);
      const minute = parseInt(horaParts[1] || '0', 10);
      const fechaCalculada = new Date(year, month, day, hour, minute, 0);

      // Buscar o asociar cliente si se brindó teléfono o DNI
      let clienteId: string | null = null;
      if (clienteTelefono || clienteDni) {
        const clienteExistente = await prisma.cliente.findFirst({
          where: {
            remiseriaId,
            OR: [
              ...(clienteTelefono ? [{ telefono: clienteTelefono.trim() }] : []),
              ...(clienteDni ? [{ dni: clienteDni.trim() }] : [])
            ]
          }
        });
        if (clienteExistente) {
          clienteId = clienteExistente.id;
        }
      }

      const parsedPrecio = parseFloat(precio) || 0;
      const parsedPrecioArt = parseFloat(precioArt) || 0;
      const parsedDistancia = parseFloat(distanciaKm) || 0;

      const nuevoViaje = await prisma.viaje.create({
        data: {
          remiseriaId,
          artEmpresaId,
          choferId,
          vehiculoId: vehiculoIdFinal,
          clienteId,
          clienteNombre: clienteNombre.trim(),
          clienteTelefono: clienteTelefono ? clienteTelefono.trim() : null,
          origen: origen.trim(),
          destino: destino.trim(),
          fecha: fechaCalculada,
          horaSalidaChofer: horaSalidaChofer.trim(),
          horaTurno: horaTurno ? horaTurno.trim() : null,
          distanciaKmConPasajero: parsedDistancia,
          precio: parsedPrecio,
          precioArt: parsedPrecioArt,
          numeroSiniestro: numeroSiniestro ? String(numeroSiniestro).trim() : null,
          observaciones: observaciones ? String(observaciones).trim() : null,
          prioridad: 'ALTA',
          estado: 'ACEPTADO', // Directamente aceptado y asignado por el dueño
          motivoReasignacion: 'ASIGNADO_POR_DUENIO'
        },
        include: {
          artEmpresa: true,
          chofer: {
            include: { vehiculo: true }
          },
          vehiculo: true,
          cliente: true
        }
      });

      // Emitir sockets a la sala de la remisería
      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        if (io) {
          // 1. Notificación específica de viaje de ART asignado por Dueño (cola de espera programada)
          io.to(remiseriaId).emit('viaje_programado_art_asignado', {
            choferId,
            viajeId: nuevoViaje.id,
            artNombre: nuevoViaje.artEmpresa?.nombre,
            numeroSiniestro: nuevoViaje.numeroSiniestro,
            clienteNombre: nuevoViaje.clienteNombre,
            origen: nuevoViaje.origen,
            destino: nuevoViaje.destino,
            fecha: fechaCalculada.toISOString(),
            fechaStr: fecha,
            horaSalidaChofer: nuevoViaje.horaSalidaChofer,
            horaTurno: nuevoViaje.horaTurno,
            precioChofer: nuevoViaje.precio,
            precioArt: nuevoViaje.precioArt,
            observaciones: nuevoViaje.observaciones,
            viaje: nuevoViaje
          });

          // 2. Notificación a la pantalla del coordinador: Móvil con ART programado
          io.to(remiseriaId).emit('movil_no_disponible_programado', {
            choferId,
            vehiculoId: nuevoViaje.vehiculoId,
            choferNombre: `${nuevoViaje.chofer?.nombre} ${nuevoViaje.chofer?.apellido}`,
            numeroChofer: nuevoViaje.chofer?.numeroChofer,
            patente: nuevoViaje.vehiculo?.patente || nuevoViaje.chofer?.vehiculo?.patente,
            horaSalidaChofer: nuevoViaje.horaSalidaChofer,
            horaTurno: nuevoViaje.horaTurno,
            artNombre: nuevoViaje.artEmpresa?.nombre,
            viaje: nuevoViaje
          });

          // 3. Actualización de estado marcando que es un viaje programado de ART
          io.to(remiseriaId).emit('viaje_estado_actualizado', {
            viajeId: nuevoViaje.id,
            estado: 'ACEPTADO',
            esProgramadoArt: true,
            mensaje: `Viaje ART asignado por el Dueño a ${nuevoViaje.chofer?.nombre || 'Chofer'} (Salida ${nuevoViaje.horaSalidaChofer} hs / Turno ${nuevoViaje.horaTurno || ''} hs)`,
            viaje: nuevoViaje
          });
        }
      } catch (sockErr) {
        console.error('Error al emitir sockets de viaje ART:', sockErr);
      }

      return res.status(201).json({
        success: true,
        data: nuevoViaje,
        message: `Viaje de ART para ${nuevoViaje.clienteNombre} asignado exitosamente a ${chofer.nombre} ${chofer.apellido}`
      });
    } catch (error) {
      console.error('Error al crear viaje de ART:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al registrar y asignar el viaje de ART'
      });
    }
  },

  // Obtener viajes de ART programados / activos
  async getViajesArtProgramados(req: AuthenticatedRequest, res: Response) {
    try {
      const remiseriaId = await resolveRemiseriaId(req);
      if (!remiseriaId) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró la remisería asociada'
        });
      }

      const { estado, fechaDesde, choferId } = req.query;

      const whereClause: any = {
        remiseriaId,
        artEmpresaId: { not: null }
      };

      if (estado && estado !== 'TODOS') {
        whereClause.estado = estado as string;
      } else if (!estado) {
        whereClause.estado = { in: ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO'] };
      }

      if (choferId) {
        whereClause.choferId = choferId as string;
      }

      if (fechaDesde && typeof fechaDesde === 'string') {
        const d = new Date(fechaDesde);
        d.setHours(0, 0, 0, 0);
        whereClause.fecha = { gte: d };
      }

      const viajes = await prisma.viaje.findMany({
        where: whereClause,
        include: {
          artEmpresa: true,
          chofer: {
            include: { vehiculo: true }
          },
          vehiculo: true,
          cliente: true
        },
        orderBy: { fecha: 'asc' }
      });

      return res.json({
        success: true,
        data: viajes,
        message: 'Viajes de ART programados obtenidos exitosamente'
      });
    } catch (error) {
      console.error('Error al obtener viajes de ART programados:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener viajes de ART'
      });
    }
  },

  // 1. Reasignar viaje de ART a otro chofer por avería/rotura antes de salir
  async reasignarChoferViajeArt(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const { nuevoChoferId, motivo } = req.body;

      if (!nuevoChoferId) {
        return res.status(400).json({ success: false, message: 'Debe especificar el nuevo chofer' });
      }

      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
        include: { chofer: true, artEmpresa: true }
      });

      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      const nuevoChofer = await prisma.chofer.findUnique({
        where: { id: nuevoChoferId },
        include: { vehiculo: true }
      });

      if (!nuevoChofer) {
        return res.status(404).json({ success: false, message: 'Nuevo chofer no encontrado' });
      }

      const choferAnteriorId = viaje.choferId;
      const vehiculoIdFinal = nuevoChofer.vehiculoId || viaje.vehiculoId;
      const motivoFinal = motivo || 'Avería / rotura de vehículo antes de salir';

      const viajeActualizado = await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          choferAnteriorId,
          choferId: nuevoChoferId,
          vehiculoId: vehiculoIdFinal,
          motivoReasignacion: motivoFinal,
          estado: 'ACEPTADO'
        },
        include: {
          artEmpresa: true,
          chofer: { include: { vehiculo: true } },
          vehiculo: true,
          cliente: true
        }
      });

      // Notificaciones WebSocket
      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        if (io) {
          // Aviso al chofer anterior (se le retira el viaje de su cola)
          if (choferAnteriorId) {
            io.to(viaje.remiseriaId).emit('viaje_desasignado_art', {
              viajeId,
              choferId: choferAnteriorId,
              motivo: motivoFinal
            });
          }

          // Aviso al nuevo chofer asignado (aparece en su cola)
          io.to(viaje.remiseriaId).emit('viaje_programado_art_asignado', {
            choferId: nuevoChoferId,
            viajeId: viajeActualizado.id,
            artNombre: viajeActualizado.artEmpresa?.nombre,
            numeroSiniestro: viajeActualizado.numeroSiniestro,
            clienteNombre: viajeActualizado.clienteNombre,
            origen: viajeActualizado.origen,
            destino: viajeActualizado.destino,
            fecha: viajeActualizado.fecha.toISOString(),
            horaSalidaChofer: viajeActualizado.horaSalidaChofer,
            horaTurno: viajeActualizado.horaTurno,
            precioChofer: viajeActualizado.precio,
            precioArt: viajeActualizado.precioArt,
            observaciones: viajeActualizado.observaciones,
            viaje: viajeActualizado
          });

          io.to(viaje.remiseriaId).emit('viaje_estado_actualizado', {
            viajeId,
            estado: 'ACEPTADO',
            mensaje: `Viaje ART reasignado a ${nuevoChofer.nombre} ${nuevoChofer.apellido}`,
            viaje: viajeActualizado
          });
        }
      } catch (sockErr) {
        console.error('Error al emitir sockets en reasignación:', sockErr);
      }

      return res.json({
        success: true,
        data: viajeActualizado,
        message: `Viaje reasignado con éxito a ${nuevoChofer.nombre} ${nuevoChofer.apellido}`
      });
    } catch (error) {
      console.error('Error al reasignar chofer de viaje ART:', error);
      return res.status(500).json({ success: false, message: 'Error interno al reasignar viaje' });
    }
  },

  // 2. Auxilio mecánico y trasbordo en viaje (rotura durante el recorrido)
  async auxilioMecanicoTrasbordo(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const {
        nuevoChoferId,
        puntoTrasbordo,
        kmChoferInicial,
        pagaChoferInicial,
        observaciones
      } = req.body;

      if (!nuevoChoferId) {
        return res.status(400).json({ success: false, message: 'Debe indicar el chofer de auxilio/relevo' });
      }

      const viaje = await prisma.viaje.findUnique({
        where: { id: viajeId },
        include: { chofer: true, artEmpresa: true }
      });

      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      const nuevoChofer = await prisma.chofer.findUnique({
        where: { id: nuevoChoferId },
        include: { vehiculo: true }
      });

      if (!nuevoChofer) {
        return res.status(404).json({ success: false, message: 'Chofer de relevo no encontrado' });
      }

      const choferAnteriorId = viaje.choferId;
      const vehiculoIdFinal = nuevoChofer.vehiculoId || viaje.vehiculoId;
      const motivoFinal = `AUXILIO_MECANICO: ${observaciones || 'Avería durante el viaje. Trasbordo a Móvil ' + (nuevoChofer.numeroChofer || '')}`;

      const viajeActualizado = await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          choferAnteriorId,
          choferId: nuevoChoferId,
          vehiculoId: vehiculoIdFinal,
          auxilioMecanico: true,
          puntoTrasbordo: puntoTrasbordo || 'Ubicación actual en ruta',
          kmChoferInicial: kmChoferInicial ? parseFloat(kmChoferInicial) || 0 : 0,
          pagaChoferInicial: pagaChoferInicial ? parseFloat(pagaChoferInicial) || 0 : 0,
          motivoReasignacion: motivoFinal,
          // Si el paciente ya estaba a bordo se mantiene EN_CURSO, si estaba yendo a buscarlo pasa a EN_CAMINO
          estado: viaje.estado === 'EN_CURSO' ? 'EN_CURSO' : 'EN_CAMINO'
        },
        include: {
          artEmpresa: true,
          chofer: { include: { vehiculo: true } },
          vehiculo: true,
          cliente: true
        }
      });

      // WebSockets para auxilio
      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        if (io) {
          // Alerta sonora y visual de máxima prioridad al nuevo chofer de auxilio
          io.to(viaje.remiseriaId).emit('alerta_auxilio_trasbordo_art', {
            choferId: nuevoChoferId,
            viajeId,
            puntoTrasbordo: puntoTrasbordo || 'Ubicación en ruta',
            pasajeroNombre: viaje.clienteNombre,
            pasajeroTelefono: viaje.clienteTelefono,
            destino: viaje.destino,
            choferAveriadoNombre: `${viaje.chofer?.nombre || ''} ${viaje.chofer?.apellido || ''}`,
            viaje: viajeActualizado
          });

          // Notificación al chofer averiado
          if (choferAnteriorId) {
            io.to(viaje.remiseriaId).emit('viaje_relevado_auxilio', {
              choferId: choferAnteriorId,
              viajeId,
              mensaje: `El móvil #${nuevoChofer.numeroChofer} (${nuevoChofer.nombre}) ha tomado el relevo de tu traslado.`
            });
          }

          io.to(viaje.remiseriaId).emit('viaje_estado_actualizado', {
            viajeId,
            estado: viajeActualizado.estado,
            mensaje: `🚨 AUXILIO MECÁNICO: Móvil #${nuevoChofer.numeroChofer} en camino al punto de trasbordo`,
            viaje: viajeActualizado
          });
        }
      } catch (sockErr) {
        console.error('Error al emitir sockets de auxilio:', sockErr);
      }

      return res.json({
        success: true,
        data: viajeActualizado,
        message: `Auxilio registrado. El viaje fue transferido a ${nuevoChofer.nombre} ${nuevoChofer.apellido}`
      });
    } catch (error) {
      console.error('Error en auxilio mecánico y trasbordo:', error);
      return res.status(500).json({ success: false, message: 'Error al registrar auxilio mecánico' });
    }
  },

  // 3. Modificar número de siniestro por error de tipeo
  async modificarSiniestroArt(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const { nuevoNumeroSiniestro, motivo } = req.body;

      if (!nuevoNumeroSiniestro || !String(nuevoNumeroSiniestro).trim()) {
        return res.status(400).json({ success: false, message: 'Debe ingresar el nuevo número de siniestro' });
      }

      const viaje = await prisma.viaje.findUnique({ where: { id: viajeId } });
      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      const siniestroLimpio = String(nuevoNumeroSiniestro).trim();
      const siniestroAnterior = viaje.numeroSiniestro || 'S/N';
      const notaModif = `[Siniestro corregido de "${siniestroAnterior}" a "${siniestroLimpio}". Motivo: ${motivo || 'Error de tipeo de la ART'}]`;
      const obsFinal = viaje.observaciones ? `${viaje.observaciones} | ${notaModif}` : notaModif;

      const viajeActualizado = await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          numeroSiniestro: siniestroLimpio,
          observaciones: obsFinal
        },
        include: { artEmpresa: true, chofer: true }
      });

      return res.json({
        success: true,
        data: viajeActualizado,
        message: `Siniestro actualizado correctamente a "${siniestroLimpio}"`
      });
    } catch (error) {
      console.error('Error al modificar número de siniestro:', error);
      return res.status(500).json({ success: false, message: 'Error interno al actualizar siniestro' });
    }
  },

  // 3b. Anular viaje por siniestro anulado/reemplazado por la ART
  async anularViajeSiniestroArt(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const { motivo, numeroSiniestroNuevo } = req.body;

      const viaje = await prisma.viaje.findUnique({ where: { id: viajeId } });
      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      const motivoFinal = motivo || 'Siniestro anulado por la ART por error de emisión';
      const nota = numeroSiniestroNuevo ? ` (Reemplazado por nuevo siniestro: ${numeroSiniestroNuevo})` : '';

      const viajeCancelado = await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          estado: 'CANCELADO',
          canceladoPor: 'ART',
          motivoCancelacion: `${motivoFinal}${nota}`,
          canceladoEn: new Date()
        },
        include: { artEmpresa: true, chofer: true }
      });

      // Notificar a chofer para retirarlo de cola de espera si estaba asignado
      try {
        const { getIO } = await import('../lib/socket');
        const io = getIO();
        if (io && viaje.choferId) {
          io.to(viaje.remiseriaId).emit('viaje_desasignado_art', {
            viajeId,
            choferId: viaje.choferId,
            motivo: `Siniestro anulado por la ART: ${motivoFinal}`
          });
        }
      } catch {}

      return res.json({
        success: true,
        data: viajeCancelado,
        message: 'Viaje y siniestro anulados con éxito'
      });
    } catch (error) {
      console.error('Error al anular siniestro:', error);
      return res.status(500).json({ success: false, message: 'Error al anular siniestro' });
    }
  },

  // 4. Actualizar estado de coordinación y contacto con el paciente
  async actualizarCoordinacionPaciente(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const { estadoCoordinacion, motivoRechazo, observaciones } = req.body;

      const estadosValidos = ['PENDIENTE_CONTACTO', 'CONFIRMADO', 'RECHAZADO_POR_PACIENTE', 'NO_RESPONDE'];
      if (!estadoCoordinacion || !estadosValidos.includes(estadoCoordinacion)) {
        return res.status(400).json({ success: false, message: 'Estado de coordinación inválido' });
      }

      const viaje = await prisma.viaje.findUnique({ where: { id: viajeId } });
      if (!viaje) {
        return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
      }

      const dataUpdate: any = {
        estadoCoordinacion,
        motivoRechazoPaciente: motivoRechazo ? String(motivoRechazo).trim() : null
      };

      if (observaciones) {
        dataUpdate.observaciones = viaje.observaciones
          ? `${viaje.observaciones} | [Coordinación: ${observaciones}]`
          : `[Coordinación: ${observaciones}]`;
      }

      // Si el paciente rechazó viajar, cancelamos el viaje automáticamente
      if (estadoCoordinacion === 'RECHAZADO_POR_PACIENTE') {
        dataUpdate.estado = 'CANCELADO';
        dataUpdate.canceladoPor = 'CLIENTE';
        dataUpdate.motivoCancelacion = motivoRechazo || 'El paciente desistió del traslado / no desea viajar';
        dataUpdate.canceladoEn = new Date();

        // Notificar al chofer para liberarlo
        try {
          const { getIO } = await import('../lib/socket');
          const io = getIO();
          if (io && viaje.choferId) {
            io.to(viaje.remiseriaId).emit('viaje_desasignado_art', {
              viajeId,
              choferId: viaje.choferId,
              motivo: 'El paciente desistió del viaje'
            });
          }
        } catch {}
      }

      const viajeActualizado = await prisma.viaje.update({
        where: { id: viajeId },
        data: dataUpdate,
        include: { artEmpresa: true, chofer: true }
      });

      return res.json({
        success: true,
        data: viajeActualizado,
        message: estadoCoordinacion === 'RECHAZADO_POR_PACIENTE'
          ? 'Desistimiento del paciente registrado y viaje cancelado correctamente'
          : 'Coordinación con el paciente actualizada con éxito'
      });
    } catch (error) {
      console.error('Error al actualizar coordinación del paciente:', error);
      return res.status(500).json({ success: false, message: 'Error interno al actualizar coordinación' });
    }
  },

  // 5. Obtener período de cierre actual de una ART (Semanal, Quincenal o Mensual)
  async getPeriodoActualArt(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const art = await prisma.artEmpresa.findUnique({ where: { id } });
      if (!art) {
        return res.status(404).json({ success: false, message: 'ART no encontrada' });
      }

      const ahora = new Date();
      const tipo = art.periodoFacturacion || 'MENSUAL';
      let fechaDesde: Date;
      let fechaHasta: Date;

      if (tipo === 'SEMANAL') {
        const diaSemana = ahora.getDay(); // 0: domingo, 1: lunes...
        const diffLunes = ahora.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1);
        fechaDesde = new Date(ahora.setDate(diffLunes));
        fechaDesde.setHours(0, 0, 0, 0);
        fechaHasta = new Date(fechaDesde);
        fechaHasta.setDate(fechaDesde.getDate() + 6);
        fechaHasta.setHours(23, 59, 59, 999);
      } else if (tipo === 'QUINCENAL') {
        const dia = ahora.getDate();
        const year = ahora.getFullYear();
        const month = ahora.getMonth();
        if (dia <= 15) {
          fechaDesde = new Date(year, month, 1, 0, 0, 0);
          fechaHasta = new Date(year, month, 15, 23, 59, 59, 999);
        } else {
          fechaDesde = new Date(year, month, 16, 0, 0, 0);
          const ultimoDia = new Date(year, month + 1, 0).getDate();
          fechaHasta = new Date(year, month, ultimoDia, 23, 59, 59, 999);
        }
      } else {
        // MENSUAL
        const year = ahora.getFullYear();
        const month = ahora.getMonth();
        fechaDesde = new Date(year, month, 1, 0, 0, 0);
        const ultimoDia = new Date(year, month + 1, 0).getDate();
        fechaHasta = new Date(year, month, ultimoDia, 23, 59, 59, 999);
      }

      return res.json({
        success: true,
        data: {
          periodoTipo: tipo,
          diaCorteFacturacion: art.diaCorteFacturacion,
          fechaDesde: fechaDesde.toISOString().split('T')[0],
          fechaHasta: fechaHasta.toISOString().split('T')[0],
          artNombre: art.nombre
        }
      });
    } catch (error) {
      console.error('Error al calcular período de ART:', error);
      return res.status(500).json({ success: false, message: 'Error al calcular período' });
    }
  },

  // 6. Actualizar peajes de un viaje de ART
  async actualizarPeajesViajeArt(req: AuthenticatedRequest, res: Response) {
    try {
      const { viajeId } = req.params;
      const { montoPeajes, observacionesPeaje } = req.body;

      const p = parseFloat(montoPeajes) || 0;
      if (p < 0) {
        return res.status(400).json({ success: false, message: 'El peaje no puede ser negativo' });
      }

      const viajeActualizado = await prisma.viaje.update({
        where: { id: viajeId },
        data: {
          montoPeajes: p,
          observacionesPeaje: observacionesPeaje ? String(observacionesPeaje).trim() : null
        },
        include: { artEmpresa: true, chofer: true }
      });

      return res.json({
        success: true,
        data: viajeActualizado,
        message: `Peajes actualizados: $${p.toLocaleString('es-AR')}`
      });
    } catch (error) {
      console.error('Error al actualizar peajes:', error);
      return res.status(500).json({ success: false, message: 'Error al actualizar peajes' });
    }
  },

  // 7. Listar Cierres de Facturación de ART
  async getCierresFacturacion(req: AuthenticatedRequest, res: Response) {
    try {
      const remiseriaId = await resolveRemiseriaId(req);
      if (!remiseriaId) {
        return res.status(400).json({ success: false, message: 'Remisería no encontrada' });
      }

      const { artEmpresaId, estado } = req.query;
      const whereClause: any = { remiseriaId };

      if (artEmpresaId && artEmpresaId !== 'all') {
        whereClause.artEmpresaId = artEmpresaId as string;
      }
      if (estado && estado !== 'TODOS') {
        whereClause.estado = estado as string;
      }

      const cierres = await prisma.cierreFacturacionArt.findMany({
        where: whereClause,
        include: {
          artEmpresa: true,
          viajes: {
            select: {
              id: true,
              fecha: true,
              numeroSiniestro: true,
              clienteNombre: true,
              origen: true,
              destino: true,
              precio: true,
              precioArt: true,
              montoPeajes: true,
              chofer: {
                select: { id: true, nombre: true, apellido: true, numeroChofer: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({
        success: true,
        data: cierres,
        message: 'Cierres de facturación obtenidos exitosamente'
      });
    } catch (error) {
      console.error('Error al obtener cierres de facturación:', error);
      return res.status(500).json({ success: false, message: 'Error interno al consultar cierres' });
    }
  },

  // 7b. Generar Cierre de Facturación
  async generarCierreFacturacion(req: AuthenticatedRequest, res: Response) {
    try {
      const remiseriaId = await resolveRemiseriaId(req);
      if (!remiseriaId) {
        return res.status(400).json({ success: false, message: 'Remisería no encontrada' });
      }

      const {
        artEmpresaId,
        fechaDesde,
        fechaHasta,
        periodoTipo,
        observaciones
      } = req.body;

      if (!artEmpresaId || !fechaDesde || !fechaHasta) {
        return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos (ART, fecha desde y hasta)' });
      }

      const dDesde = new Date(fechaDesde);
      dDesde.setHours(0, 0, 0, 0);
      const dHasta = new Date(fechaHasta);
      dHasta.setHours(23, 59, 59, 999);

      // Buscar viajes completados en ese rango para esa ART
      const viajes = await prisma.viaje.findMany({
        where: {
          remiseriaId,
          artEmpresaId,
          estado: 'COMPLETADO',
          fecha: { gte: dDesde, lte: dHasta }
        },
        include: { artEmpresa: true }
      });

      if (viajes.length === 0) {
        return res.status(400).json({ success: false, message: 'No hay viajes completados de esta ART en el rango de fechas indicado' });
      }

      let totalKm = 0;
      let totalEsperaHoras = 0;
      let totalPeajes = 0;
      let totalFacturadoArt = 0;
      let totalPagaChoferes = 0;

      for (const v of viajes) {
        totalKm += v.distanciaKmConPasajero || 0;
        totalEsperaHoras += (v.tiempoEsperaSegundos || 0) / 3600;
        const peaje = Number(v.montoPeajes) || 0;
        totalPeajes += peaje;

        let pArt = v.precioArt ? Number(v.precioArt) : 0;
        if (!pArt && v.artEmpresa) {
          const km = v.distanciaKmConPasajero || 1;
          let p = v.artEmpresa.precioTramo || 0;
          if (km > 1 && v.artEmpresa.valorKm > 0) p += (km - 1) * v.artEmpresa.valorKm;
          if (v.costoEspera) p += v.costoEspera;
          pArt = Math.round(p / 50) * 50;
        }

        totalFacturadoArt += pArt + peaje;
        totalPagaChoferes += Number(v.precio || 0) + peaje;
      }

      const margenGanancia = Math.max(0, totalFacturadoArt - totalPagaChoferes);

      const nuevoCierre = await prisma.cierreFacturacionArt.create({
        data: {
          remiseriaId,
          artEmpresaId,
          periodoTipo: periodoTipo || 'MENSUAL',
          fechaDesde: dDesde,
          fechaHasta: dHasta,
          totalViajes: viajes.length,
          totalKm: Math.round(totalKm * 10) / 10,
          totalEsperaHoras: Math.round(totalEsperaHoras * 10) / 10,
          totalPeajes: Math.round(totalPeajes),
          totalFacturadoArt: Math.round(totalFacturadoArt),
          totalPagaChoferes: Math.round(totalPagaChoferes),
          margenGanancia: Math.round(margenGanancia),
          estado: 'PENDIENTE_FACTURAR',
          observaciones: observaciones ? String(observaciones).trim() : null
        }
      });

      // Vincular los viajes al cierre
      await prisma.viaje.updateMany({
        where: { id: { in: viajes.map(v => v.id) } },
        data: { cierreFacturacionArtId: nuevoCierre.id }
      });

      return res.status(201).json({
        success: true,
        data: nuevoCierre,
        message: `Cierre de facturación generado con éxito (${viajes.length} viajes, Total: $${nuevoCierre.totalFacturadoArt.toLocaleString('es-AR')})`
      });
    } catch (error) {
      console.error('Error al generar cierre de facturación:', error);
      return res.status(500).json({ success: false, message: 'Error interno al generar cierre' });
    }
  },

  // 7c. Registrar emisión y envío de factura
  async registrarFacturaCierre(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { numeroFactura, fechaEmision, fechaEnvioFactura, observaciones } = req.body;

      if (!numeroFactura) {
        return res.status(400).json({ success: false, message: 'Debe ingresar el número de factura' });
      }

      const cierre = await prisma.cierreFacturacionArt.findUnique({ where: { id } });
      if (!cierre) {
        return res.status(404).json({ success: false, message: 'Cierre de facturación no encontrado' });
      }

      const dataUpdate: any = {
        numeroFactura: String(numeroFactura).trim(),
        estado: 'FACTURA_EMITIDA'
      };

      if (fechaEmision) {
        dataUpdate.fechaEmision = new Date(fechaEmision);
      }
      if (fechaEnvioFactura) {
        dataUpdate.fechaEnvioFactura = new Date(fechaEnvioFactura);
      } else {
        dataUpdate.fechaEnvioFactura = new Date();
      }
      if (observaciones) {
        dataUpdate.observaciones = cierre.observaciones
          ? `${cierre.observaciones} | [Factura: ${observaciones}]`
          : `[Factura: ${observaciones}]`;
      }

      const cierreActualizado = await prisma.cierreFacturacionArt.update({
        where: { id },
        data: dataUpdate,
        include: { artEmpresa: true }
      });

      return res.json({
        success: true,
        data: cierreActualizado,
        message: `Factura ${dataUpdate.numeroFactura} registrada y agendada correctamente`
      });
    } catch (error) {
      console.error('Error al registrar factura de cierre:', error);
      return res.status(500).json({ success: false, message: 'Error al registrar factura' });
    }
  },

  // 7d. Marcar Cierre como Cobrado
  async marcarCierreCobrado(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { fechaCobro, metodoCobro, comprobanteCobroUrl, observaciones } = req.body;

      const cierre = await prisma.cierreFacturacionArt.findUnique({ where: { id } });
      if (!cierre) {
        return res.status(404).json({ success: false, message: 'Cierre de facturación no encontrado' });
      }

      const dataUpdate: any = {
        estado: 'COBRADO',
        fechaCobro: fechaCobro ? new Date(fechaCobro) : new Date(),
        metodoCobro: metodoCobro || 'TRANSFERENCIA'
      };

      if (comprobanteCobroUrl) {
        dataUpdate.comprobanteCobroUrl = comprobanteCobroUrl;
      }
      if (observaciones) {
        dataUpdate.observaciones = cierre.observaciones
          ? `${cierre.observaciones} | [Cobro: ${observaciones}]`
          : `[Cobro: ${observaciones}]`;
      }

      const cierreActualizado = await prisma.cierreFacturacionArt.update({
        where: { id },
        data: dataUpdate,
        include: { artEmpresa: true }
      });

      return res.json({
        success: true,
        data: cierreActualizado,
        message: `Cierre marcado como COBRADO exitosamente ($${cierre.totalFacturadoArt.toLocaleString('es-AR')})`
      });
    } catch (error) {
      console.error('Error al marcar cierre como cobrado:', error);
      return res.status(500).json({ success: false, message: 'Error al registrar cobro' });
    }
  },

  // 7e. Anular Cierre de Facturación
  async anularCierreFacturacion(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const cierre = await prisma.cierreFacturacionArt.findUnique({ where: { id } });
      if (!cierre) {
        return res.status(404).json({ success: false, message: 'Cierre de facturación no encontrado' });
      }

      // Desvincular viajes asociados
      await prisma.viaje.updateMany({
        where: { cierreFacturacionArtId: id },
        data: { cierreFacturacionArtId: null }
      });

      await prisma.cierreFacturacionArt.delete({ where: { id } });

      return res.json({
        success: true,
        message: 'Cierre de facturación cancelado y viajes desvinculados exitosamente'
      });
    } catch (error) {
      console.error('Error al anular cierre de facturación:', error);
      return res.status(500).json({ success: false, message: 'Error al anular cierre' });
    }
  }
};
