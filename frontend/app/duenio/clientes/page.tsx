'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { duenioClienteService } from '@/lib/api';
import { Cliente, Viaje, PagoCuentaCorriente } from '@/types';
import {
  Users,
  Search,
  CreditCard,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Send,
  RefreshCw,
  Clock,
  Car,
  AlertCircle,
  TrendingDown,
  Receipt,
  PlusCircle,
  FileText,
  Wallet,
  Check,
  Tag,
  Settings
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function DuenioClientesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCC, setFiltroCC] = useState<'todas' | 'habilitadas' | 'con_deuda'>('todas');

  // Modal Historial de Viajes y Conciliación de Cuenta Corriente
  const [modalViajesOpen, setModalViajesOpen] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [viajesCliente, setViajesCliente] = useState<Viaje[]>([]);
  const [pagosCliente, setPagosCliente] = useState<PagoCuentaCorriente[]>([]);
  const [tabHistorial, setTabHistorial] = useState<'viajes' | 'pagos'>('viajes');
  const [loadingViajes, setLoadingViajes] = useState(false);

  // Modal Registrar Pago / Abono
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [montoPago, setMontoPago] = useState<string>('');
  const [metodoPagoRegistro, setMetodoPagoRegistro] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'OTRO'>('EFECTIVO');
  const [notaPago, setNotaPago] = useState<string>('');
  const [guardandoPago, setGuardandoPago] = useState(false);

  // Modal Configuración de Cuenta Corriente y Tarifa (Similar a ART)
  const [modalConfigCCOpen, setModalConfigCCOpen] = useState(false);
  const [clienteConfigCC, setClienteConfigCC] = useState<Cliente | null>(null);
  const [configCCForm, setConfigCCForm] = useState({
    habilitada: true,
    limite: 0,
    tipoTarifa: 'LISTA_NORMAL' as 'LISTA_NORMAL' | 'PERSONALIZADA',
    tarifaPrecioTramo: 3500,
    tarifaValorKm: 1200,
    tarifaValorHoraEspera: 10000,
    pagaChoferTipo: 'LISTA_NORMAL' as 'LISTA_NORMAL' | 'PERSONALIZADO',
    choferPrecioTramo: 3500,
    choferValorKm: 1200,
    choferValorHoraEspera: 10000,
  });
  const [guardandoConfigCC, setGuardandoConfigCC] = useState(false);

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }
    cargarClientes();
  }, [user, router, filtroCC]);

  const cargarClientes = async () => {
    try {
      setLoading(true);
      const res = await duenioClienteService.getClientes({
        q: searchTerm || undefined,
        filtroCC: filtroCC !== 'todas' ? filtroCC : undefined,
      });

      if (res.success && res.data) {
        setClientes(res.data);
      } else {
        toast.error(res.message || 'Error al cargar clientes');
      }
    } catch (error) {
      console.error('Error cargando clientes:', error);
      toast.error('Error de red al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCC = async (cliente: Cliente) => {
    // Si la va a activar, abrir directamente el modal para fijar tarifa y límite
    if (!cliente.cuentaCorrienteHabilitada) {
      abrirModalConfigCC({
        ...cliente,
        cuentaCorrienteHabilitada: true
      });
      return;
    }

    // Si ya estaba activa, permitir desactivar directamente
    try {
      const res = await duenioClienteService.toggleCuentaCorriente(cliente.id, {
        habilitada: false,
      });

      if (res.success) {
        toast.success(`Cuenta corriente desactivada para ${cliente.nombre}`);
        cargarClientes();
      } else {
        toast.error(res.message || 'Error al desactivar cuenta corriente');
      }
    } catch (error) {
      toast.error('Error al actualizar cuenta corriente');
    }
  };

  const abrirModalViajes = async (cliente: Cliente) => {
    setClienteSeleccionado(cliente);
    setModalViajesOpen(true);
    setTabHistorial('viajes');
    setLoadingViajes(true);
    try {
      const res = await duenioClienteService.getViajesCliente(cliente.id);
      if (res.success && res.data) {
        setViajesCliente(res.data.viajes || []);
        setPagosCliente(res.data.pagos || []);
      }
    } catch (error) {
      toast.error('Error al cargar historial del cliente');
    } finally {
      setLoadingViajes(false);
    }
  };

  const abrirModalRegistrarPago = (cliente: Cliente) => {
    const saldo = Number(cliente.saldoPendiente ?? cliente.saldoCuentaCorriente ?? 0);
    setClienteSeleccionado(cliente);
    setMontoPago(saldo > 0 ? saldo.toString() : '');
    setMetodoPagoRegistro('EFECTIVO');
    setNotaPago('');
    setModalPagoOpen(true);
  };

  const confirmarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteSeleccionado) return;
    const monto = parseFloat(montoPago);
    if (isNaN(monto) || monto <= 0) {
      toast.error('Ingresá un importe válido mayor a $0');
      return;
    }

    const saldoActual = Number(clienteSeleccionado.saldoPendiente ?? clienteSeleccionado.saldoCuentaCorriente ?? 0);
    if (saldoActual <= 0) {
      toast.error('El cliente no registra deuda pendiente');
      return;
    }

    if (monto > saldoActual) {
      toast.error(`El monto no puede superar la deuda actual de $${saldoActual.toLocaleString('es-AR')}`);
      return;
    }

    try {
      setGuardandoPago(true);
      const res = await duenioClienteService.registrarPago(clienteSeleccionado.id, {
        monto,
        metodoPago: metodoPagoRegistro,
        observaciones: notaPago,
      });

      if (res.success) {
        toast.success(res.message || 'Abono registrado con éxito');
        setModalPagoOpen(false);
        cargarClientes();
        if (modalViajesOpen) {
          abrirModalViajes(clienteSeleccionado);
        }
      } else {
        toast.error(res.message || 'Error al registrar pago');
      }
    } catch (error) {
      toast.error('Error al registrar pago');
    } finally {
      setGuardandoPago(false);
    }
  };

  const abrirModalConfigCC = (cliente: Cliente) => {
    setClienteConfigCC(cliente);
    setConfigCCForm({
      habilitada: Boolean(cliente.cuentaCorrienteHabilitada),
      limite: cliente.limiteCuentaCorriente || 0,
      tipoTarifa: cliente.tipoTarifa || 'LISTA_NORMAL',
      tarifaPrecioTramo: cliente.tarifaPrecioTramo && cliente.tarifaPrecioTramo > 0 ? cliente.tarifaPrecioTramo : 3500,
      tarifaValorKm: cliente.tarifaValorKm && cliente.tarifaValorKm > 0 ? cliente.tarifaValorKm : 1200,
      tarifaValorHoraEspera: cliente.tarifaValorHoraEspera && cliente.tarifaValorHoraEspera > 0 ? cliente.tarifaValorHoraEspera : 10000,
      pagaChoferTipo: cliente.pagaChoferTipo || 'LISTA_NORMAL',
      choferPrecioTramo: cliente.choferPrecioTramo && cliente.choferPrecioTramo > 0 ? cliente.choferPrecioTramo : 3500,
      choferValorKm: cliente.choferValorKm && cliente.choferValorKm > 0 ? cliente.choferValorKm : 1200,
      choferValorHoraEspera: cliente.choferValorHoraEspera && cliente.choferValorHoraEspera > 0 ? cliente.choferValorHoraEspera : 10000,
    });
    setModalConfigCCOpen(true);
  };

  const guardarConfigCC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteConfigCC) return;
    try {
      setGuardandoConfigCC(true);
      const res = await duenioClienteService.toggleCuentaCorriente(clienteConfigCC.id, {
        habilitada: configCCForm.habilitada,
        limite: Number(configCCForm.limite) || 0,
        tipoTarifa: configCCForm.tipoTarifa,
        tarifaPrecioTramo: Number(configCCForm.tarifaPrecioTramo) || 0,
        tarifaValorKm: Number(configCCForm.tarifaValorKm) || 0,
        tarifaValorHoraEspera: Number(configCCForm.tarifaValorHoraEspera) || 0,
        pagaChoferTipo: configCCForm.pagaChoferTipo,
        choferPrecioTramo: Number(configCCForm.choferPrecioTramo) || 0,
        choferValorKm: Number(configCCForm.choferValorKm) || 0,
        choferValorHoraEspera: Number(configCCForm.choferValorHoraEspera) || 0,
      });

      if (res.success) {
        toast.success(res.message || 'Configuración guardada exitosamente');
        setModalConfigCCOpen(false);
        cargarClientes();
      } else {
        toast.error(res.message || 'Error al actualizar cuenta corriente');
      }
    } catch (error) {
      toast.error('Error al guardar configuración');
    } finally {
      setGuardandoConfigCC(false);
    }
  };

  // Botón directo de WhatsApp con mensaje personalizado
  const handleEnviarWhatsApp = (cliente: Cliente) => {
    if (!cliente.telefono) {
      toast.error('El cliente no tiene teléfono registrado');
      return;
    }

    const cleanPhone = cliente.telefono.replace(/\D/g, '');
    let finalPhone = cleanPhone;
    if (!finalPhone.startsWith('54') && finalPhone.length >= 8) {
      finalPhone = `549${finalPhone}`;
    }

    const saldo = cliente.saldoPendiente || cliente.saldoCuentaCorriente || 0;
    let mensaje = '';

    if (saldo > 0) {
      mensaje = `Hola ${cliente.nombre}, te escribimos de Remises Bruno para recordarte el estado de tu cuenta corriente. Tenés un saldo pendiente de $${saldo.toLocaleString('es-AR')} correspondiente a tus viajes. Si necesitás el detalle de los servicios o los datos de transferencia bancaria, avisanos por este medio. ¡Muchas gracias!`;
    } else {
      mensaje = `Hola ${cliente.nombre}, te escribimos de Remises Bruno para informarte que tu cuenta corriente está activa y al día. ¡Cualquier traslado que necesites quedamos a tu disposición!`;
    }

    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  // Filtrado de clientes en vivo
  const clientesFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return clientes;
    const term = searchTerm.toLowerCase();
    return clientes.filter((c) => {
      const nom = `${c.nombre || ''} ${c.apellido || ''}`.toLowerCase();
      const tel = (c.telefono || '').toLowerCase();
      const dni = (c.dni || '').toLowerCase();
      const dir = (c.direccion || '').toLowerCase();
      const mail = (c.email || '').toLowerCase();
      return nom.includes(term) || tel.includes(term) || dni.includes(term) || dir.includes(term) || mail.includes(term);
    });
  }, [clientes, searchTerm]);

  // Métricas rápidas
  const totalClientes = clientes.length;
  const clientesConCC = clientes.filter((c) => c.cuentaCorrienteHabilitada).length;
  const deudaTotal = clientes.reduce((acc, c) => acc + (c.saldoPendiente || c.saldoCuentaCorriente || 0), 0);
  const totalViajesCC = clientes.reduce((acc, c) => acc + (c.viajesCuentaCorriente || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 text-primary-700 flex items-center justify-center shadow-inner">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Gestión de Clientes y Cuenta Corriente</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Solo Dueño
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Activá cuentas corrientes para que tus pasajeros habituales puedan viajar y abonar a fin de mes, y enviá avisos de cobro por WhatsApp.
            </p>
          </div>
        </div>

        <button
          onClick={cargarClientes}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar Lista
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Clientes</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">{totalClientes}</span>
            <span className="text-xs text-slate-500 ml-2">registrados</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuentas Corrientes</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CreditCard className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-emerald-600">{clientesConCC}</span>
            <span className="text-xs text-slate-500 ml-2">habilitadas</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Total Adeudado</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <DollarSign className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-amber-600">
              ${deudaTotal.toLocaleString('es-AR')}
            </span>
            <span className="text-xs text-slate-500 ml-2">a cobrar</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Viajes en Cta. Cte.</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Car className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">{totalViajesCC}</span>
            <span className="text-xs text-slate-500 ml-2">acumulados</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Input de Búsqueda */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido, teléfono, DNI o dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filtros de Pestaña */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFiltroCC('todas')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filtroCC === 'todas'
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({clientes.length})
            </button>
            <button
              onClick={() => setFiltroCC('habilitadas')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filtroCC === 'habilitadas'
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Cta. Cte. Activa ({clientesConCC})
            </button>
            <button
              onClick={() => setFiltroCC('con_deuda')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filtroCC === 'con_deuda'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Con Saldo Pendiente
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
            <p className="text-sm text-slate-500 mt-2">Cargando cartera de clientes...</p>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-base font-bold text-slate-800">No se encontraron clientes</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm ? 'No hay resultados que coincidan con la búsqueda.' : 'Aún no hay clientes registrados.'}
            </p>
          </div>
        ) : (
          <>
            {/* VISTA MÓVIL (CARDS TÁCTILES) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {clientesFiltrados.map((cliente) => {
                const saldo = cliente.saldoPendiente || cliente.saldoCuentaCorriente || 0;
                const tieneCC = cliente.cuentaCorrienteHabilitada;

                return (
                  <div key={cliente.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-primary-100 text-primary-700 font-bold text-base flex items-center justify-center shrink-0 shadow-xs">
                          {cliente.nombre?.charAt(0).toUpperCase() || 'C'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-base leading-tight truncate">
                            {cliente.nombre} {cliente.apellido}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            DNI: {cliente.dni || 'S/D'} • {cliente.telefono}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex px-2.5 py-1 text-[11px] font-semibold rounded-full border shrink-0 ${
                        tieneCC ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {tieneCC ? 'Cta. Cte. Activa' : 'Inactiva'}
                      </span>
                    </div>

                    {/* Resumen de Saldo y Viajes */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block">Saldo Pendiente</span>
                        {saldo > 0 ? (
                          <span className="text-sm font-extrabold text-rose-600 block mt-0.5">
                            ${saldo.toLocaleString('es-AR')}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                            $0 (Al día)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium block">Viajes en Cta. Cte.</span>
                        <span className="text-xs font-bold text-slate-800 block mt-0.5">
                          {cliente.viajesCuentaCorriente || 0} viajes
                        </span>
                      </div>
                    </div>

                    {/* Botones de acción táctiles para celular */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => handleEnviarWhatsApp(cliente)}
                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-all active:scale-95"
                        title="WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                        WhatsApp
                      </button>
                      <button
                        onClick={() => abrirModalViajes(cliente)}
                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Viajes
                      </button>
                      {saldo > 0 ? (
                        <button
                          onClick={() => abrirModalRegistrarPago(cliente)}
                          className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Cobrar
                        </button>
                      ) : (
                        <button
                          onClick={() => abrirModalConfigCC(cliente)}
                          className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all active:scale-95"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Config
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VISTA ESCRITORIO (TABLA) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Teléfono / DNI</th>
                  <th className="py-3.5 px-4">Cuenta Corriente</th>
                  <th className="py-3.5 px-4 text-center">Viajes Cta. Cte.</th>
                  <th className="py-3.5 px-4 text-right">Saldo Pendiente ($)</th>
                  <th className="py-3.5 px-4 text-center">Aviso WhatsApp</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientesFiltrados.map((cliente) => {
                  const saldo = cliente.saldoPendiente || cliente.saldoCuentaCorriente || 0;
                  const tieneCC = cliente.cuentaCorrienteHabilitada;

                  return (
                    <tr key={cliente.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center shrink-0">
                            {cliente.nombre?.charAt(0).toUpperCase() || 'C'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">
                              {cliente.nombre} {cliente.apellido}
                            </span>
                            {cliente.direccion && (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-[200px]">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                {cliente.direccion}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Teléfono / DNI */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="font-mono text-slate-800 font-medium block">
                            {cliente.telefono || 'Sin teléfono'}
                          </span>
                          <span className="text-[11px] text-slate-500 block font-mono">
                            DNI: {cliente.dni || '-'}
                          </span>
                        </div>
                      </td>

                      {/* Switch Cuenta Corriente */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleCC(cliente)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              tieneCC ? 'bg-emerald-500' : 'bg-slate-200'
                            }`}
                            title={tieneCC ? 'Desactivar cuenta corriente' : 'Activar cuenta corriente'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                tieneCC ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-xs font-semibold ${
                              tieneCC ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {tieneCC ? 'Habilitada' : 'No activa'}
                          </span>
                        </div>

                        {tieneCC ? (
                          <div className="mt-1.5 space-y-1">
                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                              <span>Límite: <strong className="text-slate-700">${cliente.limiteCuentaCorriente ? Number(cliente.limiteCuentaCorriente).toLocaleString('es-AR') : 'Sin tope'}</strong></span>
                            </div>
                            <div>
                              {cliente.tipoTarifa === 'PERSONALIZADA' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <Tag className="w-2.5 h-2.5" />
                                  Especial (Tr: ${cliente.tarifaPrecioTramo || 0} | Km: ${cliente.tarifaValorKm || 0})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                                  Tarifa Normal
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => abrirModalConfigCC(cliente)}
                              className="text-[10px] text-primary-600 hover:text-primary-800 font-bold flex items-center gap-1 hover:underline"
                            >
                              <Settings className="w-3 h-3" />
                              Configurar Tarifa / Límite
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => abrirModalConfigCC({ ...cliente, cuentaCorrienteHabilitada: true })}
                            className="mt-1 text-[10px] text-slate-400 hover:text-primary-600 font-medium flex items-center gap-1"
                          >
                            <span>+ Activar y fijar tarifa</span>
                          </button>
                        )}
                      </td>

                      {/* Viajes Cta Cte */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-800 text-sm">
                          {cliente.viajesCuentaCorriente || 0}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          de {cliente.totalViajes || 0} totales
                        </span>
                      </td>

                      {/* Saldo Pendiente */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {saldo > 0 ? (
                          <div className="inline-block bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-xl text-right">
                            <span className="font-bold text-sm block">
                              ${saldo.toLocaleString('es-AR')}
                            </span>
                            <span className="text-[10px] text-red-600 block">Pendiente de pago</span>
                          </div>
                        ) : (
                          <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-xl font-bold">
                            $0 (Al día)
                          </span>
                        )}
                      </td>

                      {/* Botón WhatsApp */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleEnviarWhatsApp(cliente)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
                          title="Enviar recordatorio de saldo por WhatsApp"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => abrirModalViajes(cliente)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                            title="Ver todos los viajes del cliente"
                          >
                            <FileText className="w-3.5 h-3.5 inline mr-1" />
                            Viajes
                          </button>

                          {saldo > 0 && (
                            <button
                              onClick={() => abrirModalRegistrarPago(cliente)}
                              className="px-2.5 py-1.5 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold text-xs transition-colors"
                              title="Registrar pago del cliente para descontar saldo"
                            >
                              <Receipt className="w-3.5 h-3.5 inline mr-1" />
                              Cobrar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>

      {/* ============================================================== */}
      {/* MODAL DETALLE DE VIAJES Y CONCILIACIÓN                          */}
      {/* ============================================================== */}
      {modalViajesOpen && clienteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Header del Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Historial de Cuenta Corriente: {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tel: {clienteSeleccionado.telefono} | DNI: {clienteSeleccionado.dni} |{' '}
                  <span className="font-bold text-red-600">
                    Saldo adeudado: ${(clienteSeleccionado.saldoPendiente || clienteSeleccionado.saldoCuentaCorriente || 0).toLocaleString('es-AR')}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setModalViajesOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Pestañas de Navegación: Viajes vs Abonos */}
            <div className="flex items-center gap-4 px-6 pt-3 border-b border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setTabHistorial('viajes')}
                className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-colors ${
                  tabHistorial === 'viajes'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Viajes Realizados ({viajesCliente.length})
              </button>
              <button
                onClick={() => setTabHistorial('pagos')}
                className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  tabHistorial === 'pagos'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                Historial de Abonos / Pagos ({pagosCliente.length})
              </button>
            </div>

            {/* Listado de Viajes o Pagos */}
            <div className="p-6 flex-1 overflow-y-auto space-y-3">
              {loadingViajes ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
                  <p className="text-sm text-slate-500 mt-2">Cargando datos...</p>
                </div>
              ) : tabHistorial === 'viajes' ? (
                viajesCliente.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Este cliente no tiene viajes registrados.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {viajesCliente.map((viaje) => {
                      const f = new Date(viaje.fecha);
                      const esCC = viaje.metodoPago === 'CUENTA_CORRIENTE';

                      return (
                        <div
                          key={viaje.id}
                          className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                            esCC ? 'bg-amber-50/30' : 'bg-white'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {f.toLocaleDateString('es-AR')} -{' '}
                                {f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  esCC
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {esCC ? '🏛️ Cuenta Corriente' : `💵 ${viaje.metodoPago || 'Efectivo'}`}
                              </span>
                              <span className="text-[10px] text-slate-500 font-semibold">{viaje.estado}</span>
                            </div>

                            <div className="text-xs text-slate-700">
                              <span className="font-bold text-emerald-600">O:</span> {viaje.origen} →{' '}
                              <span className="font-bold text-red-500">D:</span> {viaje.destino}
                            </div>

                            {viaje.chofer && (
                              <p className="text-[11px] text-slate-500">
                                Móvil: {viaje.vehiculo?.patente || '-'} | Chofer: {viaje.chofer.nombre}{' '}
                                {viaje.chofer.apellido}
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-base font-bold text-slate-900 block">
                              ${Number(viaje.precio || 0).toLocaleString('es-AR')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* Tab de Historial de Pagos / Abonos */
                pagosCliente.length === 0 ? (
                  <div className="p-12 text-center">
                    <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No hay abonos registrados para este cliente</p>
                    <p className="text-xs text-slate-400 mt-1">Los pagos parciales y totales que registre figurarán detallados aquí.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {pagosCliente.map((pago) => {
                      const f = new Date(pago.fecha);
                      const esParcial = pago.saldoRestante > 0;
                      return (
                        <div key={pago.id} className="p-4 flex items-center justify-between gap-4 bg-white hover:bg-slate-50 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {f.toLocaleDateString('es-AR')} - {f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                esParcial ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              }`}>
                                {esParcial ? 'Abono Parcial' : 'Pago Total'}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                {pago.metodoPago || 'Efectivo'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              {pago.observaciones || 'Sin observaciones'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Deuda anterior: <span className="font-semibold text-slate-700">${Number(pago.saldoAnterior).toLocaleString('es-AR')}</span> → Saldo restante: <span className={`font-semibold ${pago.saldoRestante > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>${Number(pago.saldoRestante).toLocaleString('es-AR')}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-base font-extrabold text-emerald-600 block">
                              -${Number(pago.monto).toLocaleString('es-AR')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">Abonado</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Footer Modal con Botón Registrar Pago */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setModalViajesOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Cerrar
              </button>

              <button
                onClick={() => abrirModalRegistrarPago(clienteSeleccionado)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                Registrar Cobro / Abono
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL REGISTRAR PAGO A CUENTA CORRIENTE                        */}
      {/* ============================================================== */}
      {modalPagoOpen && clienteSeleccionado && (() => {
        const saldoActual = Number(clienteSeleccionado.saldoPendiente ?? clienteSeleccionado.saldoCuentaCorriente ?? 0);
        const montoNum = parseFloat(montoPago) || 0;
        const saldoRestanteEstimado = Math.max(0, saldoActual - montoNum);
        const superaDeuda = montoNum > saldoActual;
        const esTotal = montoNum === saldoActual && saldoActual > 0;
        const esParcial = montoNum > 0 && montoNum < saldoActual;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Registrar Pago / Abono</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cliente:{' '}
                    <span className="font-bold text-slate-800">
                      {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalPagoOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              {/* Tarjeta de Resumen de Deuda */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Deuda Actual en Cta. Cte.
                  </span>
                  <span className="text-2xl font-black text-red-600">
                    ${saldoActual.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Acceso Rápido:</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setMontoPago(saldoActual.toString())}
                      className="px-2.5 py-1 bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 rounded-lg text-xs font-bold text-slate-700 shadow-2xs transition-colors"
                      title="Pagar la totalidad de la deuda"
                    >
                      Total (100%)
                    </button>
                    {saldoActual >= 2 && (
                      <button
                        type="button"
                        onClick={() => setMontoPago(Math.round(saldoActual * 0.5).toString())}
                        className="px-2.5 py-1 bg-white border border-slate-300 hover:border-primary-500 hover:text-primary-700 rounded-lg text-xs font-bold text-slate-700 shadow-2xs transition-colors"
                        title="Abonar el 50% de la deuda"
                      >
                        50%
                      </button>
                    )}
                    {saldoActual >= 4 && (
                      <button
                        type="button"
                        onClick={() => setMontoPago(Math.round(saldoActual * 0.25).toString())}
                        className="px-2.5 py-1 bg-white border border-slate-300 hover:border-primary-500 hover:text-primary-700 rounded-lg text-xs font-bold text-slate-700 shadow-2xs transition-colors"
                        title="Abonar el 25% de la deuda"
                      >
                        25%
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={confirmarPago} className="space-y-4">
                {/* Monto a Abonar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">
                      Monto a Abonar ($) *
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Podés abonar una parte o el total
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">$</span>
                    <input
                      type="number"
                      min="1"
                      max={saldoActual > 0 ? saldoActual : undefined}
                      step="1"
                      required
                      placeholder="Ingresá el importe"
                      value={montoPago}
                      onChange={(e) => setMontoPago(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-lg font-black text-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Banner de Estado Dinámico */}
                {superaDeuda ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>El monto ingresado ($<strong>{montoNum.toLocaleString('es-AR')}</strong>) supera la deuda actual ($<strong>{saldoActual.toLocaleString('es-AR')}</strong>).</span>
                  </div>
                ) : esTotal ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <div>
                        <span className="font-bold block">Pago Total: Cancelación completa</span>
                        <span className="text-[11px] text-emerald-700">La cuenta corriente del cliente quedará en $0 (al día).</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-200 text-emerald-900">
                      100%
                    </span>
                  </div>
                ) : esParcial ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 shrink-0 text-blue-600" />
                      <div>
                        <span className="font-bold block">Abono Parcial</span>
                        <span className="text-[11px] text-blue-700">
                          Quedará debiendo:{' '}
                          <strong className="text-amber-800 font-extrabold">${saldoRestanteEstimado.toLocaleString('es-AR')}</strong>
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-200 text-blue-900">
                      Parcial
                    </span>
                  </div>
                ) : null}

                {/* Método de Pago */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMetodoPagoRegistro('EFECTIVO')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                        metodoPagoRegistro === 'EFECTIVO'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/30'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      💵 Efectivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetodoPagoRegistro('TRANSFERENCIA')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                        metodoPagoRegistro === 'TRANSFERENCIA'
                          ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/30'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      🏦 Transferencia
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetodoPagoRegistro('OTRO')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                        metodoPagoRegistro === 'OTRO'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/30'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      💳 Tarjeta / QR
                    </button>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Comprobante / Detalle (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Comprobante transfe #9283, Pago en base, etc."
                    value={notaPago}
                    onChange={(e) => setNotaPago(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalPagoOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoPago || superaDeuda || montoNum <= 0}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {guardandoPago
                      ? 'Procesando...'
                      : esTotal
                      ? 'Confirmar Pago Total'
                      : 'Confirmar Abono Parcial'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL CONFIGURAR CUENTA CORRIENTE Y TARIFA (SIMILAR A ART)     */}
      {/* ============================================================== */}
      {modalConfigCCOpen && clienteConfigCC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Configurar Cuenta Corriente y Tarifa
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cliente: <span className="font-bold text-slate-800">{clienteConfigCC.nombre} {clienteConfigCC.apellido}</span> | DNI: {clienteConfigCC.dni}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalConfigCCOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={guardarConfigCC} className="space-y-5">
              {/* Switch de Estado de Cuenta Corriente */}
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Estado de la Cuenta Corriente
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Permite al cliente viajar sin abonar al momento y acumular saldo.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigCCForm({ ...configCCForm, habilitada: !configCCForm.habilitada })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    configCCForm.habilitada ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      configCCForm.habilitada ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Límite de Crédito */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Límite Máximo de Saldo ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="0 para sin límite"
                    value={configCCForm.limite}
                    onChange={(e) => setConfigCCForm({ ...configCCForm, limite: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Dejá en 0 si no querés aplicar un tope de corte automático.
                </span>
              </div>

              {/* ESQUEMA TARIFARIO (SIMILAR A ART) */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary-600" />
                    Esquema de Tarifa para este Cliente
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400">Modelo tipo ART</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Opción 1: Lista Normal */}
                  <label
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      configCCForm.tipoTarifa === 'LISTA_NORMAL'
                        ? 'border-primary-600 bg-primary-50/40 text-primary-950'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoTarifa"
                      value="LISTA_NORMAL"
                      checked={configCCForm.tipoTarifa === 'LISTA_NORMAL'}
                      onChange={() => setConfigCCForm({ ...configCCForm, tipoTarifa: 'LISTA_NORMAL' })}
                      className="mt-0.5 text-primary-600"
                    />
                    <div>
                      <span className="text-xs font-bold block">Tarifa Normal de la Remisería</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Abona el mismo precio que cualquier cliente estándar.
                      </span>
                    </div>
                  </label>

                  {/* Opción 2: Tarifa Especial / Personalizada */}
                  <label
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      configCCForm.tipoTarifa === 'PERSONALIZADA'
                        ? 'border-amber-500 bg-amber-50/40 text-amber-950'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoTarifa"
                      value="PERSONALIZADA"
                      checked={configCCForm.tipoTarifa === 'PERSONALIZADA'}
                      onChange={() => setConfigCCForm({ ...configCCForm, tipoTarifa: 'PERSONALIZADA' })}
                      className="mt-0.5 text-amber-600"
                    />
                    <div>
                      <span className="text-xs font-bold block">Tarifa Especial / Diferenciada</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Precios corporativos o preferenciales acordados por viaje y Km.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Subformulario de Tarifa Especial */}
                {configCCForm.tipoTarifa === 'PERSONALIZADA' && (
                  <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-4 animate-in fade-in duration-200">
                    <span className="text-xs font-bold text-amber-900 block">
                      Valores Acordados con el Cliente:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                          Precio Tramo / Base ($) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            required
                            value={configCCForm.tarifaPrecioTramo}
                            onChange={(e) => setConfigCCForm({ ...configCCForm, tarifaPrecioTramo: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">0 a 1 Km (bajada)</span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                          Valor por Km ($) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            required
                            value={configCCForm.tarifaValorKm}
                            onChange={(e) => setConfigCCForm({ ...configCCForm, tarifaValorKm: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Km adicional</span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                          Hora de Espera ($)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            value={configCCForm.tarifaValorHoraEspera}
                            onChange={(e) => setConfigCCForm({ ...configCCForm, tarifaValorHoraEspera: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Espera por hora</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalConfigCCOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoConfigCC}
                  className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {guardandoConfigCC ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
