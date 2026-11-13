import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

async function getDuenioRemiseriaId(userId?: string): Promise<string | null> {
  if (!userId) return null;
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
  const first = await prisma.remiseria.findFirst({ select: { id: true } });
  return first?.id || null;
}

export const duenioClientesController = {
  // Listar clientes para el módulo del dueño con métricas de Cuenta Corriente
  async getClientes(req: AuthenticatedRequest, res: Response) {
    try {
      const remiseriaId = await getDuenioRemiseriaId(req.user?.id);
      const { q, filtroCC } = req.query;

      const whereClause: any = {};
      if (remiseriaId) {
        whereClause.OR = [
          { remiseriaId },
          { remiseriaId: null }
        ];
      }

      if (q && typeof q === 'string' && q.trim()) {
        const term = q.trim();
        whereClause.AND = [
          {
            OR: [
              { nombre: { contains: term, mode: 'insensitive' } },
              { apellido: { contains: term, mode: 'insensitive' } },
              { telefono: { contains: term } },
              { dni: { contains: term } },
              { email: { contains: term, mode: 'insensitive' } },
              { direccion: { contains: term, mode: 'insensitive' } }
            ]
          }
        ];
      }

      if (filtroCC === 'habilitadas') {
        whereClause.cuentaCorrienteHabilitada = true;
      }

      const clientes = await prisma.cliente.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { viajes: true, pagosCuentaCorriente: true }
          },
          pagosCuentaCorriente: {
            take: 5,
            orderBy: { fecha: 'desc' }
          },
          viajes: {
            take: 50,
            orderBy: { fecha: 'desc' },
            select: {
              id: true,
              fecha: true,
              origen: true,
              destino: true,
              precio: true,
              estado: true,
              metodoPago: true
            }
          }
        },
        orderBy: { nombre: 'asc' }
      });

      const listado = clientes.map(c => {
        const viajesCompletados = c.viajes.filter(v => v.estado === 'COMPLETADO');
        const viajesCC = viajesCompletados.filter(v => v.metodoPago === 'CUENTA_CORRIENTE');
        const totalGastadoCC = viajesCC.reduce((sum, v) => sum + Number(v.precio || 0), 0);
        
        // El saldo actual es el saldo registrado en el perfil del cliente
        // Si nunca hizo pagos y saldoCuentaCorriente es 0 pero tiene viajes en CC, sincronizamos con totalGastadoCC
        let saldoPendiente = Math.max(0, Number(c.saldoCuentaCorriente || 0));
        if (saldoPendiente === 0 && (c.pagosCuentaCorriente?.length || 0) === 0 && totalGastadoCC > 0) {
          saldoPendiente = totalGastadoCC;
        }

        const ultimoViaje = c.viajes[0] || null;

        const { viajes, _count, ...clienteData } = c;

        return {
          ...clienteData,
          totalViajes: _count.viajes,
          viajesCompletados: viajesCompletados.length,
          viajesCuentaCorriente: viajesCC.length,
          totalGastadoCC,
          saldoPendiente,
          ultimoViaje: ultimoViaje ? {
            fecha: ultimoViaje.fecha,
            origen: ultimoViaje.origen,
            destino: ultimoViaje.destino,
            precio: ultimoViaje.precio,
            metodoPago: ultimoViaje.metodoPago
          } : null
        };
      });

      // Si el filtro es "con_deuda", filtrar en memoria por saldo > 0
      const resultadoFinal = filtroCC === 'con_deuda' 
        ? listado.filter(c => c.saldoPendiente > 0)
        : listado;

      return res.json({
        success: true,
        data: resultadoFinal,
        message: 'Clientes obtenidos exitosamente'
      });
    } catch (error) {
      console.error('Error al obtener clientes para el dueño:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor al obtener clientes'
      });
    }
  },

  // Activar, desactivar o configurar cuenta corriente y tarifas de un cliente (exclusivo del Dueño)
  async toggleCuentaCorriente(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        habilitada,
        limite,
        tipoTarifa,
        tarifaValorKm,
        tarifaPrecioTramo,
        tarifaValorHoraEspera,
        pagaChoferTipo,
        choferValorKm,
        choferPrecioTramo,
        choferValorHoraEspera
      } = req.body;

      const cliente = await prisma.cliente.findUnique({
        where: { id }
      });

      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      const nuevoEstado = habilitada !== undefined ? Boolean(habilitada) : !cliente.cuentaCorrienteHabilitada;
      const nuevoLimite = limite !== undefined ? parseFloat(limite) || 0 : cliente.limiteCuentaCorriente;

      const dataToUpdate: any = {
        cuentaCorrienteHabilitada: nuevoEstado,
        limiteCuentaCorriente: nuevoLimite
      };

      if (tipoTarifa !== undefined) {
        dataToUpdate.tipoTarifa = tipoTarifa === 'PERSONALIZADA' ? 'PERSONALIZADA' : 'LISTA_NORMAL';
      }
      if (tarifaValorKm !== undefined) dataToUpdate.tarifaValorKm = parseFloat(tarifaValorKm) || 0;
      if (tarifaPrecioTramo !== undefined) dataToUpdate.tarifaPrecioTramo = parseFloat(tarifaPrecioTramo) || 0;
      if (tarifaValorHoraEspera !== undefined) dataToUpdate.tarifaValorHoraEspera = parseFloat(tarifaValorHoraEspera) || 0;

      if (pagaChoferTipo !== undefined) {
        dataToUpdate.pagaChoferTipo = pagaChoferTipo === 'PERSONALIZADO' ? 'PERSONALIZADO' : 'LISTA_NORMAL';
      }
      if (choferValorKm !== undefined) dataToUpdate.choferValorKm = parseFloat(choferValorKm) || 0;
      if (choferPrecioTramo !== undefined) dataToUpdate.choferPrecioTramo = parseFloat(choferPrecioTramo) || 0;
      if (choferValorHoraEspera !== undefined) dataToUpdate.choferValorHoraEspera = parseFloat(choferValorHoraEspera) || 0;

      const actualizado = await prisma.cliente.update({
        where: { id },
        data: dataToUpdate
      });

      return res.json({
        success: true,
        data: actualizado,
        message: nuevoEstado
          ? `Cuenta corriente y tarifas configuradas para ${cliente.nombre} ${cliente.apellido}`
          : `Cuenta corriente DESHABILITADA para ${cliente.nombre} ${cliente.apellido}`
      });
    } catch (error) {
      console.error('Error al actualizar cuenta corriente:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar cuenta corriente del cliente'
      });
    }
  },

  // Obtener viajes del cliente (historial para conciliar cuenta corriente)
  async getViajesCliente(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const cliente = await prisma.cliente.findUnique({
        where: { id },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          telefono: true,
          dni: true,
          cuentaCorrienteHabilitada: true,
          limiteCuentaCorriente: true,
          saldoCuentaCorriente: true,
          tipoTarifa: true,
          tarifaValorKm: true,
          tarifaPrecioTramo: true,
          tarifaValorHoraEspera: true,
          pagaChoferTipo: true,
          choferValorKm: true,
          choferPrecioTramo: true,
          choferValorHoraEspera: true
        }
      });

      if (!cliente) {
        return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      }

      const viajes = await prisma.viaje.findMany({
        where: { clienteId: id },
        orderBy: { fecha: 'desc' },
        include: {
          chofer: {
            select: { nombre: true, apellido: true, numeroChofer: true }
          },
          vehiculo: {
            select: { patente: true, modelo: true }
          }
        }
      });

      const pagos = await prisma.pagoCuentaCorriente.findMany({
        where: { clienteId: id },
        orderBy: { fecha: 'desc' }
      });

      const totalGastadoCC = viajes
        .filter(v => v.estado === 'COMPLETADO' && v.metodoPago === 'CUENTA_CORRIENTE')
        .reduce((sum, v) => sum + Number(v.precio || 0), 0);

      const totalAbonado = pagos.reduce((sum, p) => sum + Number(p.monto || 0), 0);

      let saldoActual = Math.max(0, Number(cliente.saldoCuentaCorriente || 0));
      if (saldoActual === 0 && pagos.length === 0 && totalGastadoCC > 0) {
        saldoActual = totalGastadoCC;
      }

      return res.json({
        success: true,
        data: {
          cliente: {
            ...cliente,
            saldoPendiente: saldoActual,
            saldoCalculadoCC: saldoActual,
            totalGastadoCC,
            totalAbonado
          },
          viajes,
          pagos
        }
      });
    } catch (error) {
      console.error('Error al obtener viajes del cliente:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },

  // Registrar abono o pago a cuenta corriente (soporta pago parcial o total)
  async registrarPago(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { monto, metodoPago, observaciones } = req.body;

      const pagoMonto = parseFloat(monto);
      if (isNaN(pagoMonto) || pagoMonto <= 0) {
        return res.status(400).json({ success: false, message: 'El importe del pago debe ser mayor a 0' });
      }

      const cliente = await prisma.cliente.findUnique({
        where: { id },
        include: {
          viajes: {
            where: {
              estado: 'COMPLETADO',
              metodoPago: 'CUENTA_CORRIENTE'
            },
            select: { precio: true }
          },
          pagosCuentaCorriente: {
            take: 1
          }
        }
      });

      if (!cliente) {
        return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      }

      let saldoAnterior = Math.max(0, Number(cliente.saldoCuentaCorriente || 0));
      // Auto-recuperación si nunca se inicializó saldoCuentaCorriente pero tiene viajes
      if (saldoAnterior === 0 && cliente.pagosCuentaCorriente.length === 0) {
        const totalCC = cliente.viajes.reduce((sum, v) => sum + Number(v.precio || 0), 0);
        if (totalCC > 0) {
          saldoAnterior = totalCC;
        }
      }

      if (saldoAnterior <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'El cliente no tiene saldo adeudado en cuenta corriente' 
        });
      }

      // Descontar abono (permite pagar una parte o el total)
      const nuevoSaldo = Math.max(0, saldoAnterior - pagoMonto);
      const esPagoTotal = nuevoSaldo === 0;
      const esPagoParcial = !esPagoTotal;

      const [pagoRegistrado, clienteActualizado] = await prisma.$transaction([
        prisma.pagoCuentaCorriente.create({
          data: {
            clienteId: id,
            monto: pagoMonto,
            saldoAnterior,
            saldoRestante: nuevoSaldo,
            metodoPago: (metodoPago || 'EFECTIVO').toUpperCase(),
            observaciones: observaciones?.trim() || (esPagoTotal ? 'Cancelación total de cuenta corriente' : 'Abono parcial de cuenta corriente')
          }
        }),
        prisma.cliente.update({
          where: { id },
          data: {
            saldoCuentaCorriente: nuevoSaldo
          }
        })
      ]);

      const mensaje = esPagoTotal
        ? `Pago total de $${pagoMonto.toLocaleString('es-AR')} registrado con éxito. La cuenta corriente quedó saldada.`
        : `Abono parcial de $${pagoMonto.toLocaleString('es-AR')} registrado con éxito. Nuevo saldo restante: $${nuevoSaldo.toLocaleString('es-AR')}.`;

      return res.json({
        success: true,
        data: {
          cliente: {
            ...clienteActualizado,
            saldoPendiente: nuevoSaldo
          },
          pago: pagoRegistrado,
          esPagoParcial
        },
        message: mensaje
      });
    } catch (error) {
      console.error('Error al registrar pago de cuenta corriente:', error);
      return res.status(500).json({ success: false, message: 'Error interno al registrar pago' });
    }
  }
};
