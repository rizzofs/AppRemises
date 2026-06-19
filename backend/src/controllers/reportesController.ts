import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

export const reportesController = {
  // Obtener remiserías asociadas al dueño para selectores
  async getMisRemiserias(req: AuthenticatedRequest, res: Response) {
    try {
      const duenioUserId = req.user?.id;
      if (!duenioUserId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const duenio = await prisma.duenio.findFirst({
        where: { userId: duenioUserId },
        include: {
          remiserias: {
            include: {
              remiseria: {
                select: {
                  id: true,
                  nombreFantasia: true
                }
              }
            }
          }
        }
      });

      if (!duenio) {
        return res.status(404).json({ success: false, message: 'Dueño no encontrado' });
      }

      const listado = duenio.remiserias.map(rd => ({
        id: rd.remiseria.id,
        nombre: rd.remiseria.nombreFantasia
      }));

      res.json({ success: true, data: listado });
    } catch (error) {
      console.error('Error al obtener remiserías del dueño:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // 1. INFORME DIARIO
  async getDiario(req: AuthenticatedRequest, res: Response) {
    try {
      const duenioUserId = req.user?.id;
      const { remiseriaId } = req.query;

      if (!duenioUserId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      // Validar dueño y sus remiserías
      const duenio = await prisma.duenio.findFirst({
        where: { userId: duenioUserId },
        include: { remiserias: true }
      });

      if (!duenio) {
        return res.status(404).json({ success: false, message: 'Dueño no encontrado' });
      }

      const misRemiseriaIds = duenio.remiserias.map(rd => rd.remiseriaId);

      // Multi-tenant check
      let targetRemiseriaIds = misRemiseriaIds;
      if (remiseriaId && typeof remiseriaId === 'string' && remiseriaId !== 'todas') {
        if (!misRemiseriaIds.includes(remiseriaId)) {
          return res.status(403).json({ success: false, message: 'Acceso denegado a esta remisería' });
        }
        targetRemiseriaIds = [remiseriaId];
      }

      // Fechas de hoy (00:00:00 a 23:59:59) en hora local de Argentina
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Obtener viajes
      const viajes = await prisma.viaje.findMany({
        where: {
          remiseriaId: { in: targetRemiseriaIds },
          fecha: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        include: {
          chofer: {
            select: {
              nombre: true,
              apellido: true
            }
          },
          vehiculo: {
            select: {
              patente: true
            }
          }
        },
        orderBy: {
          fecha: 'desc'
        }
      });

      // Cálculos
      const completados = viajes.filter(v => v.estado === 'COMPLETADO');
      const cancelados = viajes.filter(v => v.estado === 'CANCELADO');
      const pendientes = viajes.filter(v => v.estado === 'PENDIENTE' || v.estado === 'EN_CURSO');

      const totalFacturado = completados.reduce((sum, v) => sum + Number(v.precio), 0);
      const ticketPromedio = completados.length > 0 ? totalFacturado / completados.length : 0;
      const tasaCancelacion = viajes.length > 0 ? (cancelados.length / viajes.length) * 100 : 0;

      res.json({
        success: true,
        data: {
          resumen: {
            totalFacturado,
            viajesCompletados: completados.length,
            viajesCancelados: cancelados.length,
            viajesPendientes: pendientes.length,
            ticketPromedio,
            tasaCancelacion
          },
          viajes: viajes.map(v => ({
            id: v.id,
            origen: v.origen,
            destino: v.destino,
            precio: Number(v.precio),
            estado: v.estado,
            fecha: v.fecha,
            cliente: v.clienteNombre || 'Sin Nombre',
            chofer: v.chofer ? `${v.chofer.nombre} ${v.chofer.apellido}` : 'Sin Chofer',
            patente: v.vehiculo?.patente || 'Sin Auto'
          }))
        }
      });

    } catch (error) {
      console.error('Error al obtener informe diario:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // 2. INFORME SEMANAL
  async getSemanal(req: AuthenticatedRequest, res: Response) {
    try {
      const duenioUserId = req.user?.id;
      const { remiseriaId } = req.query;

      if (!duenioUserId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const duenio = await prisma.duenio.findFirst({
        where: { userId: duenioUserId },
        include: { remiserias: true }
      });

      if (!duenio) {
        return res.status(404).json({ success: false, message: 'Dueño no encontrado' });
      }

      const misRemiseriaIds = duenio.remiserias.map(rd => rd.remiseriaId);

      let targetRemiseriaIds = misRemiseriaIds;
      if (remiseriaId && typeof remiseriaId === 'string' && remiseriaId !== 'todas') {
        if (!misRemiseriaIds.includes(remiseriaId)) {
          return res.status(403).json({ success: false, message: 'Acceso denegado a esta remisería' });
        }
        targetRemiseriaIds = [remiseriaId];
      }

      // Obtener rango de la semana actual (últimos 7 días para gráfico continuo)
      const hoy = new Date();
      const hace7Dias = new Date();
      hace7Dias.setDate(hoy.getDate() - 6);
      hace7Dias.setHours(0, 0, 0, 0);

      const viajes = await prisma.viaje.findMany({
        where: {
          remiseriaId: { in: targetRemiseriaIds },
          estado: 'COMPLETADO',
          fecha: {
            gte: hace7Dias,
            lte: hoy
          }
        },
        select: {
          precio: true,
          fecha: true
        }
      });

      // Estructurar distribución de los últimos 7 días
      const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const ultimos7DiasDesglose: { dia: string; fecha: string; total: number; cantidad: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(hoy.getDate() - i);
        const dayLabel = diasSemana[d.getDay()];
        const dateString = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
        
        // Filtrar viajes de este día
        const viajesDia = viajes.filter(v => {
          const vf = new Date(v.fecha);
          return vf.getDate() === d.getDate() && vf.getMonth() === d.getMonth() && vf.getFullYear() === d.getFullYear();
        });

        const totalDia = viajesDia.reduce((sum, v) => sum + Number(v.precio), 0);
        
        ultimos7DiasDesglose.push({
          dia: dayLabel,
          fecha: dateString,
          total: totalDia,
          cantidad: viajesDia.length
        });
      }

      // Calcular comparación con la semana anterior
      const hace14Dias = new Date();
      hace14Dias.setDate(hoy.getDate() - 13);
      hace14Dias.setHours(0, 0, 0, 0);

      const viajesSemanaPasada = await prisma.viaje.findMany({
        where: {
          remiseriaId: { in: targetRemiseriaIds },
          estado: 'COMPLETADO',
          fecha: {
            gte: hace14Dias,
            lt: hace7Dias
          }
        },
        select: {
          precio: true
        }
      });

      const totalEstaSemana = viajes.reduce((sum, v) => sum + Number(v.precio), 0);
      const totalSemanaPasada = viajesSemanaPasada.reduce((sum, v) => sum + Number(v.precio), 0);
      
      let variacionPorcentual = 0;
      if (totalSemanaPasada > 0) {
        variacionPorcentual = ((totalEstaSemana - totalSemanaPasada) / totalSemanaPasada) * 100;
      } else if (totalEstaSemana > 0) {
        variacionPorcentual = 100; // 100% de aumento si antes fue 0
      }

      res.json({
        success: true,
        data: {
          totalSemana: totalEstaSemana,
          totalSemanaAnterior: totalSemanaPasada,
          variacion: variacionPorcentual,
          viajesCompletados: viajes.length,
          promedioDiario: totalEstaSemana / 7,
          desgloseGrafico: ultimos7DiasDesglose
        }
      });

    } catch (error) {
      console.error('Error al obtener informe semanal:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // 3. INFORME MENSUAL
  async getMensual(req: AuthenticatedRequest, res: Response) {
    try {
      const duenioUserId = req.user?.id;
      const { remiseriaId } = req.query;

      if (!duenioUserId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const duenio = await prisma.duenio.findFirst({
        where: { userId: duenioUserId },
        include: { remiserias: true }
      });

      if (!duenio) {
        return res.status(404).json({ success: false, message: 'Dueño no encontrado' });
      }

      const misRemiseriaIds = duenio.remiserias.map(rd => rd.remiseriaId);

      let targetRemiseriaIds = misRemiseriaIds;
      if (remiseriaId && typeof remiseriaId === 'string' && remiseriaId !== 'todas') {
        if (!misRemiseriaIds.includes(remiseriaId)) {
          return res.status(403).json({ success: false, message: 'Acceso denegado a esta remisería' });
        }
        targetRemiseriaIds = [remiseriaId];
      }

      // Rango del mes actual
      const hoy = new Date();
      const startOfMonth = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const endOfMonth = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

      // Viajes completados este mes
      const viajes = await prisma.viaje.findMany({
        where: {
          remiseriaId: { in: targetRemiseriaIds },
          estado: 'COMPLETADO',
          fecha: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        select: {
          precio: true,
          fecha: true,
          chofer: {
            select: {
              nombre: true,
              apellido: true
            }
          }
        }
      });

      // Agrupar ingresos por semanas del mes
      const semanasDesglose: { semana: string; total: number }[] = [];
      const totalMes = viajes.reduce((sum, v) => sum + Number(v.precio), 0);

      // Dividir el mes en 4 periodos aproximados
      for (let w = 1; w <= 4; w++) {
        const startDay = (w - 1) * 7 + 1;
        const endDay = w === 4 ? 31 : w * 7;
        
        const viajesSemana = viajes.filter(v => {
          const d = new Date(v.fecha).getDate();
          return d >= startDay && d <= endDay;
        });

        const totalSemana = viajesSemana.reduce((sum, v) => sum + Number(v.precio), 0);
        semanasDesglose.push({
          semana: `Semana ${w} (${startDay}-${endDay})`,
          total: totalSemana
        });
      }

      // Comparación con el mes anterior
      const startOfLastMonth = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const endOfLastMonth = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999);

      const viajesMesAnterior = await prisma.viaje.findMany({
        where: {
          remiseriaId: { in: targetRemiseriaIds },
          estado: 'COMPLETADO',
          fecha: {
            gte: startOfLastMonth,
            lte: endOfLastMonth
          }
        },
        select: {
          precio: true
        }
      });

      const totalMesAnterior = viajesMesAnterior.reduce((sum, v) => sum + Number(v.precio), 0);
      let variacionMes = 0;
      if (totalMesAnterior > 0) {
        variacionMes = ((totalMes - totalMesAnterior) / totalMesAnterior) * 100;
      } else if (totalMes > 0) {
        variacionMes = 100;
      }

      // Chofer destacado del mes (el que más recaudó)
      const facturacionPorChofer: { [key: string]: { nombre: string; total: number } } = {};
      viajes.forEach(v => {
        if (v.chofer) {
          const key = `${v.chofer.nombre} ${v.chofer.apellido}`;
          if (!facturacionPorChofer[key]) {
            facturacionPorChofer[key] = { nombre: key, total: 0 };
          }
          facturacionPorChofer[key].total += Number(v.precio);
        }
      });

      const choferesOrdenados = Object.values(facturacionPorChofer).sort((a, b) => b.total - a.total);
      const choferDestacado = choferesOrdenados[0] || { nombre: 'Sin viajes', total: 0 };

      res.json({
        success: true,
        data: {
          totalMes,
          totalMesAnterior,
          variacion: variacionMes,
          viajesCompletados: viajes.length,
          ticketPromedio: viajes.length > 0 ? totalMes / viajes.length : 0,
          desgloseSemanas: semanasDesglose,
          choferDestacado
        }
      });

    } catch (error) {
      console.error('Error al obtener informe mensual:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // 4. INFORME POR CHOFER (LIQUIDACIÓN)
  async getChoferes(req: AuthenticatedRequest, res: Response) {
    try {
      const duenioUserId = req.user?.id;
      const { remiseriaId } = req.query;

      if (!duenioUserId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const duenio = await prisma.duenio.findFirst({
        where: { userId: duenioUserId },
        include: { remiserias: true }
      });

      if (!duenio) {
        return res.status(404).json({ success: false, message: 'Dueño no encontrado' });
      }

      const misRemiseriaIds = duenio.remiserias.map(rd => rd.remiseriaId);

      let targetRemiseriaIds = misRemiseriaIds;
      if (remiseriaId && typeof remiseriaId === 'string' && remiseriaId !== 'todas') {
        if (!misRemiseriaIds.includes(remiseriaId)) {
          return res.status(403).json({ success: false, message: 'Acceso denegado a esta remisería' });
        }
        targetRemiseriaIds = [remiseriaId];
      }

      // Obtener todos los choferes de estas remiserías
      const choferes = await prisma.chofer.findMany({
        where: {
          remiseriaId: { in: targetRemiseriaIds }
        },
        include: {
          remiseria: {
            select: {
              nombreFantasia: true,
              comisionPorcentaje: true
            }
          },
          viajes: {
            where: {
              estado: 'COMPLETADO'
            },
            select: {
              precio: true
            }
          }
        }
      });

      const liquidaciones = choferes.map(chofer => {
        const viajesCompletados = chofer.viajes.length;
        const facturacionBruta = chofer.viajes.reduce((sum, v) => sum + Number(v.precio), 0);
        
        // Obtener el porcentaje de comisión de la remisería del chofer
        const comisionAgenciaPct = chofer.remiseria?.comisionPorcentaje || 30.0;
        const comisionChoferPct = 100.0 - comisionAgenciaPct;

        // Calcular desgloses
        const comisionChofer = (facturacionBruta * comisionChoferPct) / 100;
        const saldoAgencia = (facturacionBruta * comisionAgenciaPct) / 100;

        return {
          choferId: chofer.id,
          numeroChofer: chofer.numeroChofer,
          nombreCompleto: `${chofer.nombre} ${chofer.apellido}`,
          dni: chofer.dni,
          telefono: chofer.telefono,
          remiseriaNombre: chofer.remiseria?.nombreFantasia || 'Sin Agencia',
          comisionAgenciaPct,
          viajesCompletados,
          facturacionBruta,
          comisionChofer,
          saldoAgencia
        };
      });

      res.json({
        success: true,
        data: liquidaciones
      });

    } catch (error) {
      console.error('Error al obtener liquidación de choferes:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
};
