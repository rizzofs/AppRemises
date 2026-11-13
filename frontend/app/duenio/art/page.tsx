'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { artEmpresaService, remiseriaService } from '@/lib/api';
import { ArtEmpresa, CreateArtEmpresaData, UpdateArtEmpresaData, FacturacionArtResponse } from '@/types';
import {
  Briefcase,
  DollarSign,
  Calendar,
  Download,
  Printer,
  Plus,
  Search,
  Building2,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Clock,
  Navigation,
  FileText,
  Filter,
  ArrowUpRight,
  Car,
  User,
  RefreshCw,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  ChevronRight,
  Layers
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ArtPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Estados generales
  const [activeTab, setActiveTab] = useState<'tarifas' | 'facturacion'>('tarifas');
  const [loading, setLoading] = useState(true);
  const [artList, setArtList] = useState<ArtEmpresa[]>([]);
  const [remiseriaNombre, setRemiseriaNombre] = useState('Remises Bruno');

  // Modal Crear / Editar ART
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArt, setEditingArt] = useState<ArtEmpresa | null>(null);
  const [savingArt, setSavingArt] = useState(false);
  const [formData, setFormData] = useState<CreateArtEmpresaData>({
    nombre: '',
    cuit: '',
    razonSocial: '',
    telefono: '',
    email: '',
    direccion: '',
    valorKm: 1200,
    precioTramo: 3500,
    valorHoraEspera: 10000,
    pagaChoferTipo: 'LISTA_NORMAL',
    choferValorKm: 1200,
    choferPrecioTramo: 3500,
    choferValorHoraEspera: 10000,
    observaciones: '',
    activo: true,
  });

  // Modal Reasignar / Editar ART en viaje
  const [modalViajeArtOpen, setModalViajeArtOpen] = useState(false);
  const [viajeSeleccionado, setViajeSeleccionado] = useState<any | null>(null);
  const [nuevoArtIdViaje, setNuevoArtIdViaje] = useState<string>('');
  const [nuevoSiniestroViaje, setNuevoSiniestroViaje] = useState<string>('');
  const [recalcularTarifaViaje, setRecalcularTarifaViaje] = useState(false);
  const [guardandoViajeArt, setGuardandoViajeArt] = useState(false);

  // Estados de Facturación
  const [selectedArtFilter, setSelectedArtFilter] = useState<string>('all');
  const [periodoFiltro, setPeriodoFiltro] = useState<'hoy' | 'semana' | 'mes' | 'mes_anterior' | 'personalizado'>('mes');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [estadoViajeFiltro, setEstadoViajeFiltro] = useState<string>('COMPLETADO');
  const [facturacionData, setFacturacionData] = useState<FacturacionArtResponse | null>(null);
  const [loadingFacturacion, setLoadingFacturacion] = useState(false);
  const [searchViajeTerm, setSearchViajeTerm] = useState('');

  // Proteger ruta
  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }
    inicializarFechasMes();
    cargarDatos();
  }, [user, router]);

  const inicializarFechasMes = () => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    const fDesde = primerDia.toISOString().split('T')[0];
    const fHasta = ultimoDia.toISOString().split('T')[0];

    setFechaDesde(fDesde);
    setFechaHasta(fHasta);
  };

  const aplicarPreajustePeriodo = (tipo: 'hoy' | 'semana' | 'mes' | 'mes_anterior' | 'personalizado') => {
    setPeriodoFiltro(tipo);
    const hoy = new Date();

    if (tipo === 'hoy') {
      const hoyStr = hoy.toISOString().split('T')[0];
      setFechaDesde(hoyStr);
      setFechaHasta(hoyStr);
    } else if (tipo === 'semana') {
      const primerDiaSemana = new Date(hoy);
      primerDiaSemana.setDate(hoy.getDate() - hoy.getDay() + (hoy.getDay() === 0 ? -6 : 1)); // Lunes
      const fDesde = primerDiaSemana.toISOString().split('T')[0];
      const fHasta = hoy.toISOString().split('T')[0];
      setFechaDesde(fDesde);
      setFechaHasta(fHasta);
    } else if (tipo === 'mes') {
      inicializarFechasMes();
    } else if (tipo === 'mes_anterior') {
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      setFechaDesde(primerDia.toISOString().split('T')[0]);
      setFechaHasta(ultimoDia.toISOString().split('T')[0]);
    }
  };

  // Cargar lista de ARTs y nombre de remisería
  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [artRes, remRes] = await Promise.all([
        artEmpresaService.getAll(),
        remiseriaService.getAll()
      ]);

      if (artRes.success && artRes.data) {
        setArtList(artRes.data);
      }
      if (remRes.success && remRes.data && remRes.data.length > 0) {
        const miRem = remRes.data[0];
        setRemiseriaNombre(miRem.nombreFantasia || 'Remises Bruno');
      }
    } catch (error) {
      console.error('Error cargando ARTs:', error);
      toast.error('Error al cargar la lista de ARTs');
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos de Facturación
  const cargarFacturacion = async () => {
    try {
      setLoadingFacturacion(true);
      const params: any = {
        artEmpresaId: selectedArtFilter !== 'all' ? selectedArtFilter : undefined,
        desde: fechaDesde || undefined,
        hasta: fechaHasta || undefined,
        estado: estadoViajeFiltro !== 'TODOS' ? estadoViajeFiltro : undefined
      };

      const res = await artEmpresaService.getFacturacion(params);
      if (res.success && res.data) {
        setFacturacionData(res.data);
      } else {
        toast.error(res.message || 'Error al obtener datos de facturación');
      }
    } catch (error) {
      console.error('Error cargando facturación:', error);
      toast.error('Error al generar la facturación');
    } finally {
      setLoadingFacturacion(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'facturacion') {
      cargarFacturacion();
    }
  }, [activeTab, selectedArtFilter, fechaDesde, fechaHasta, estadoViajeFiltro]);

  // Manejo de Modal de Creación / Edición
  const handleAbrirModalCrear = () => {
    setEditingArt(null);
    setFormData({
      nombre: '',
      cuit: '',
      razonSocial: '',
      telefono: '',
      email: '',
      direccion: '',
      valorKm: 1200,
      precioTramo: 3500,
      valorHoraEspera: 10000,
      pagaChoferTipo: 'LISTA_NORMAL',
      choferValorKm: 1200,
      choferPrecioTramo: 3500,
      choferValorHoraEspera: 10000,
      observaciones: '',
      activo: true,
    });
    setIsModalOpen(true);
  };

  const handleAbrirModalEditar = (art: ArtEmpresa) => {
    setEditingArt(art);
    setFormData({
      nombre: art.nombre || '',
      cuit: art.cuit || '',
      razonSocial: art.razonSocial || '',
      telefono: art.telefono || '',
      email: art.email || '',
      direccion: art.direccion || '',
      valorKm: art.valorKm ?? 1200,
      precioTramo: art.precioTramo ?? 3500,
      valorHoraEspera: art.valorHoraEspera ?? 10000,
      pagaChoferTipo: art.pagaChoferTipo || 'LISTA_NORMAL',
      choferValorKm: art.choferValorKm ?? 1200,
      choferPrecioTramo: art.choferPrecioTramo ?? 3500,
      choferValorHoraEspera: art.choferValorHoraEspera ?? 10000,
      observaciones: art.observaciones || '',
      activo: art.activo,
    });
    setIsModalOpen(true);
  };

  const handleGuardarArt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error('El nombre de la ART es obligatorio');
      return;
    }

    try {
      setSavingArt(true);
      if (editingArt) {
        const res = await artEmpresaService.update(editingArt.id, formData);
        if (res.success) {
          toast.success(`ART "${formData.nombre}" actualizada exitosamente`);
          setIsModalOpen(false);
          cargarDatos();
        } else {
          toast.error(res.message || 'Error al actualizar ART');
        }
      } else {
        const res = await artEmpresaService.create(formData);
        if (res.success) {
          toast.success(`ART "${formData.nombre}" creada con éxito`);
          setIsModalOpen(false);
          cargarDatos();
        } else {
          toast.error(res.message || 'Error al crear ART');
        }
      }
    } catch (error) {
      console.error('Error guardando ART:', error);
      toast.error('Error de conexión al guardar ART');
    } finally {
      setSavingArt(false);
    }
  };

  const handleToggleActivo = async (art: ArtEmpresa) => {
    try {
      const res = await artEmpresaService.toggleActivo(art.id);
      if (res.success) {
        toast.success(`ART ${art.activo ? 'desactivada' : 'activada'}`);
        cargarDatos();
      }
    } catch (error) {
      toast.error('Error al alternar estado');
    }
  };

  const handleEliminar = async (art: ArtEmpresa) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar o archivar "${art.nombre}"?`)) return;
    try {
      const res = await artEmpresaService.delete(art.id);
      if (res.success) {
        toast.success(res.message || 'ART eliminada correctamente');
        cargarDatos();
      }
    } catch (error) {
      toast.error('Error al eliminar ART');
    }
  };

  // Asignar / Cambiar ART en viaje
  const abrirModalEditarViajeArt = (viaje: any) => {
    setViajeSeleccionado(viaje);
    setNuevoArtIdViaje(viaje.artEmpresaId || viaje.artEmpresa?.id || '');
    setNuevoSiniestroViaje(viaje.numeroSiniestro || '');
    setRecalcularTarifaViaje(false);
    setModalViajeArtOpen(true);
  };

  const guardarCambioViajeArt = async () => {
    if (!viajeSeleccionado) return;
    try {
      setGuardandoViajeArt(true);
      const res = await artEmpresaService.asignarViajeArt(viajeSeleccionado.id, {
        artEmpresaId: nuevoArtIdViaje || null,
        numeroSiniestro: nuevoSiniestroViaje.trim(),
        recalcularTarifa: recalcularTarifaViaje
      });
      if (res.success) {
        toast.success('Viaje actualizado correctamente');
        setModalViajeArtOpen(false);
        cargarFacturacion();
      } else {
        toast.error(res.message || 'Error al actualizar el viaje');
      }
    } catch (error) {
      toast.error('Error de red al actualizar el viaje');
    } finally {
      setGuardandoViajeArt(false);
    }
  };

  // Filtrado de viajes por texto en buscador
  const viajesFiltrados = useMemo(() => {
    if (!facturacionData?.viajes) return [];
    if (!searchViajeTerm.trim()) return facturacionData.viajes;

    const term = searchViajeTerm.toLowerCase();
    return facturacionData.viajes.filter((v: any) => {
      const artNom = (v.artEmpresa?.nombre || '').toLowerCase();
      const pasajero = (v.clienteNombre || `${v.cliente?.nombre || ''} ${v.cliente?.apellido || ''}`).toLowerCase();
      const origen = (v.origen || '').toLowerCase();
      const destino = (v.destino || '').toLowerCase();
      const siniestro = (v.numeroSiniestro || '').toLowerCase();
      const chofer = (`${v.chofer?.nombre || ''} ${v.chofer?.apellido || ''}`).toLowerCase();
      return (
        artNom.includes(term) ||
        pasajero.includes(term) ||
        origen.includes(term) ||
        destino.includes(term) ||
        siniestro.includes(term) ||
        chofer.includes(term)
      );
    });
  }, [facturacionData, searchViajeTerm]);

  // Exportar a CSV (Excel)
  const handleExportarCSV = () => {
    if (!viajesFiltrados || viajesFiltrados.length === 0) {
      toast.error('No hay viajes para exportar en este período');
      return;
    }

    const headers = [
      'Fecha',
      'Hora',
      'ART / Empresa',
      'N° Siniestro / Bono',
      'Pasajero / Paciente',
      'Teléfono',
      'Origen',
      'Destino',
      'Chofer',
      'Móvil',
      'Distancia (Km)',
      'Espera (Minutos)',
      'Costo Espera ($)',
      'Importe Total ($)',
      'Estado'
    ];

    const rows = viajesFiltrados.map((v: any) => {
      const f = new Date(v.fecha);
      const fecha = f.toLocaleDateString('es-AR');
      const hora = f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const art = v.artEmpresa?.nombre || 'Sin ART';
      const siniestro = v.numeroSiniestro || '-';
      const pasajero = v.clienteNombre || `${v.cliente?.nombre || ''} ${v.cliente?.apellido || ''}`.trim() || 'Pasajero';
      const tel = v.clienteTelefono || v.cliente?.telefono || '-';
      const origen = `"${(v.origen || '').replace(/"/g, '""')}"`;
      const destino = `"${(v.destino || '').replace(/"/g, '""')}"`;
      const chofer = v.chofer ? `${v.chofer.nombre} ${v.chofer.apellido}` : 'Sin chofer';
      const movil = v.vehiculo?.patente || '-';
      const km = (v.distanciaKmConPasajero || 0).toFixed(1);
      const esperaMin = Math.round((v.tiempoEsperaSegundos || 0) / 60);
      const costoEspera = (v.costoEspera || 0).toFixed(2);
      const precio = Number(v.precio || 0).toFixed(2);
      const estado = v.estado;

      return [
        fecha,
        hora,
        art,
        siniestro,
        pasajero,
        tel,
        origen,
        destino,
        chofer,
        movil,
        km,
        esperaMin,
        costoEspera,
        precio,
        estado
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const artNom = selectedArtFilter !== 'all' ? (artList.find(a => a.id === selectedArtFilter)?.nombre || 'ART') : 'TODAS_LAS_ART';
    link.download = `Facturacion_${artNom.replace(/\s+/g, '_')}_${fechaDesde}_al_${fechaHasta}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Archivo CSV descargado con éxito');
  };

  // Imprimir resumen de facturación
  const handleImprimir = () => {
    window.print();
  };

  // Totales rápidos para los KPI cards de ARTs
  const totalArtsActivas = artList.filter(a => a.activo).length;
  const totalFacturadoHistorico = artList.reduce((acc, a) => acc + (a.totalFacturado || 0), 0);
  const totalViajesHistorico = artList.reduce((acc, a) => acc + (a.viajesCompletados || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Estilos para impresión limpia de la factura */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #seccion-imprimible-factura, #seccion-imprimible-factura * {
            visibility: visible;
          }
          #seccion-imprimible-factura {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Principal */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 text-primary-700 flex items-center justify-center shadow-inner">
            <Briefcase className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Módulo ART y Empresas</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Corporativo
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Administrá tarifas por kilómetro, tramos locales y horas de espera acordadas con ARTs y empresas para facturar por separado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={cargarDatos}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refrescar datos"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleAbrirModalCrear}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-sm shadow-primary-200 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nueva ART / Empresa
          </button>
        </div>
      </div>

      {/* Selector de Pestañas (Tabs) */}
      <div className="no-print flex items-center border-b border-slate-200 bg-white px-6 rounded-2xl shadow-sm">
        <button
          onClick={() => setActiveTab('tarifas')}
          className={`flex items-center gap-2 py-4 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'tarifas'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Gestión de ARTs y Tarifas
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-medium">
            {artList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('facturacion')}
          className={`flex items-center gap-2 py-4 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'facturacion'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Facturación y Liquidación ART
          {facturacionData?.resumen?.totalViajes !== undefined && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-primary-50 text-primary-700 font-medium">
              {facturacionData.resumen.totalViajes} viajes
            </span>
          )}
        </button>
      </div>

      {/* ============================================================== */}
      {/* PESTAÑA 1: GESTIÓN DE TARIFAS ART                              */}
      {/* ============================================================== */}
      {activeTab === 'tarifas' && (
        <div className="space-y-6">
          {/* Métricas Generales de ART */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ARTs Registradas</span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Building2 className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900">{artList.length}</span>
                <span className="text-xs text-slate-500 ml-2">({totalArtsActivas} activas)</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Viajes Históricos ART</span>
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Navigation className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900">{totalViajesHistorico}</span>
                <span className="text-xs text-slate-500 ml-2">completados</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Facturación Histórica</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <DollarSign className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-emerald-600">
                  ${totalFacturadoHistorico.toLocaleString('es-AR')}
                </span>
                <span className="text-xs text-slate-500 ml-2">acumulado</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Facturación de Este Mes</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <TrendingUp className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => setActiveTab('facturacion')}
                  className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  Ver liquidación mensual <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Tarjetas / Listado de ARTs */}
          {loading ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
              <p className="text-sm text-slate-500 mt-3">Cargando ARTs y convenios corporativos...</p>
            </div>
          ) : artList.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto">
                <Briefcase className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Aún no registraste ninguna ART o Empresa</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  Agregá las ART con las que trabaja {remiseriaNombre} (ej. Provincia ART, La Segunda ART, etc.) e ingresá sus tarifas por kilómetro, tramo local y hora de espera.
                </p>
              </div>
              <button
                onClick={handleAbrirModalCrear}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 shadow-sm shadow-primary-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar Primera ART
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {artList.map((art) => (
                <div
                  key={art.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between ${
                    art.activo ? 'border-slate-200' : 'border-slate-200/60 opacity-80 bg-slate-50/50'
                  }`}
                >
                  {/* Encabezado de la Tarjeta */}
                  <div className="p-6 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900 leading-snug">{art.nombre}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              art.activo
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {art.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                        {art.razonSocial && (
                          <p className="text-xs text-slate-500 mt-0.5">{art.razonSocial}</p>
                        )}
                        {art.cuit && (
                          <p className="text-xs font-mono text-slate-600 mt-1">CUIT: {art.cuit}</p>
                        )}
                      </div>

                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                        {art.nombre.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    {(art.telefono || art.email) && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                        {art.telefono && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{art.telefono}</span>
                          </div>
                        )}
                        {art.email && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{art.email}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tarifas pactadas (Destacadas) */}
                  <div className="p-6 bg-slate-50/60 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-3">
                      Tarifario Acordado con la ART
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                        <span className="text-xs text-slate-500 block">Tramo Local</span>
                        <span className="text-base font-bold text-slate-900 mt-1 block">
                          ${art.precioTramo?.toLocaleString('es-AR') || '0'}
                        </span>
                        <span className="text-[10px] text-slate-400">0 a 1 Km</span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                        <span className="text-xs text-slate-500 block">Por Km</span>
                        <span className="text-base font-bold text-primary-600 mt-1 block">
                          ${art.valorKm?.toLocaleString('es-AR') || '0'}
                        </span>
                        <span className="text-[10px] text-slate-400">km adicional</span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                        <span className="text-xs text-slate-500 block">Hora Espera</span>
                        <span className="text-base font-bold text-amber-600 mt-1 block">
                          ${art.valorHoraEspera?.toLocaleString('es-AR') || '0'}
                        </span>
                        <span className="text-[10px] text-slate-400">por hora</span>
                      </div>
                    </div>

                    {/* Esquema de Pago al Chofer (Confidencial Dueño) */}
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                        <Car className="w-3.5 h-3.5 text-amber-700" />
                        <span>Liquidación Chofer:</span>
                      </div>
                      <span className="font-bold text-amber-800">
                        {art.pagaChoferTipo === 'PERSONALIZADO'
                          ? `Especial (Km: $${art.choferValorKm || 0} | Tr: $${art.choferPrecioTramo || 0})`
                          : 'Lista Normal Remisería'}
                      </span>
                    </div>
                  </div>

                  {/* Resumen Histórico de Viajes */}
                  <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Viajes completados:</span>
                      <span className="font-bold text-slate-900">{art.viajesCompletados || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Km con paciente:</span>
                      <span className="font-bold text-slate-900">{art.totalKm || 0} km</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Total facturado histórico:</span>
                      <span className="font-bold text-emerald-600">
                        ${(art.totalFacturado || 0).toLocaleString('es-AR')}
                      </span>
                    </div>

                    {art.observaciones && (
                      <p className="text-xs text-slate-500 bg-amber-50/70 text-amber-900 border border-amber-200/50 p-2.5 rounded-xl italic">
                        &quot;{art.observaciones}&quot;
                      </p>
                    )}
                  </div>

                  {/* Barra de Acciones */}
                  <div className="p-4 bg-white border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedArtFilter(art.id);
                        setActiveTab('facturacion');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Facturar
                    </button>

                    <button
                      onClick={() => handleAbrirModalEditar(art)}
                      className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      title="Editar tarifas y datos"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleActivo(art)}
                      className={`p-2 rounded-xl transition-colors ${
                        art.activo
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                      title={art.activo ? 'Desactivar ART' : 'Activar ART'}
                    >
                      {art.activo ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => handleEliminar(art)}
                      className="p-2 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                      title="Eliminar o archivar ART"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* PESTAÑA 2: FACTURACIÓN Y DETALLE DE VIAJES POR ART             */}
      {/* ============================================================== */}
      {activeTab === 'facturacion' && (
        <div className="space-y-6">
          {/* Panel de Filtros para Facturación */}
          <div className="no-print bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Período y Empresa para Facturación</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seleccioná la ART y el rango de fechas para generar el reporte de facturación.
                </p>
              </div>

              {/* Botones de Preajustes Rápidos de Fechas */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => aplicarPreajustePeriodo('hoy')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    periodoFiltro === 'hoy'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => aplicarPreajustePeriodo('semana')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    periodoFiltro === 'semana'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Esta Semana
                </button>
                <button
                  onClick={() => aplicarPreajustePeriodo('mes')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    periodoFiltro === 'mes'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Este Mes
                </button>
                <button
                  onClick={() => aplicarPreajustePeriodo('mes_anterior')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    periodoFiltro === 'mes_anterior'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Mes Anterior
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
              {/* Selector de ART */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ART / Empresa
                </label>
                <select
                  value={selectedArtFilter}
                  onChange={(e) => setSelectedArtFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">Todas las ARTs (Reporte Global)</option>
                  {artList.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.nombre} {art.cuit ? `(${art.cuit})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha Desde */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => {
                    setFechaDesde(e.target.value);
                    setPeriodoFiltro('personalizado');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Fecha Hasta */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => {
                    setFechaHasta(e.target.value);
                    setPeriodoFiltro('personalizado');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Estado del viaje */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estado de Viajes
                </label>
                <select
                  value={estadoViajeFiltro}
                  onChange={(e) => setEstadoViajeFiltro(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="COMPLETADO">Solo Completados (A Facturar)</option>
                  <option value="TODOS">Todos los Estados</option>
                  <option value="EN_CURSO">En Curso / Activos</option>
                  <option value="CANCELADO">Cancelados</option>
                </select>
              </div>
            </div>

            {/* Acciones de exportación */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por paciente, siniestro, chofer, dirección..."
                  value={searchViajeTerm}
                  onChange={(e) => setSearchViajeTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportarCSV}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  Descargar Excel (CSV)
                </button>
                <button
                  onClick={handleImprimir}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-sm shadow-primary-200 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Detalle Factura
                </button>
              </div>
            </div>
          </div>

          {/* Tarjetas KPI del Período para Facturación y Ganancias */}
          <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Facturación Total ART */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs bg-linear-to-br from-white to-emerald-50/20">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Facturación ART
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600">
                  ${(facturacionData?.resumen?.totalFacturado || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {selectedArtFilter !== 'all' ? 'A cobrar a esta ART' : 'Total a cobrar todas las ARTs'}
              </span>
            </div>

            {/* Total Liquidación a Choferes */}
            <div className="bg-white p-5 rounded-2xl border border-blue-200/80 shadow-xs bg-linear-to-br from-white to-blue-50/20">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Paga a Choferes
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-blue-600">
                  ${(facturacionData?.resumen?.totalPagaChofer || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Liquidación de los móviles
              </span>
            </div>

            {/* Ganancia Neta Remises Bruno */}
            <div className="bg-white p-5 rounded-2xl border border-indigo-200/80 shadow-xs bg-linear-to-br from-white to-indigo-50/30">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">
                Ganancia Neta Remisería
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-600">
                  ${(facturacionData?.resumen?.totalGanancia || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <span className="text-[11px] text-indigo-500 font-medium mt-1 block">
                Margen neto a favor
              </span>
            </div>

            {/* Cantidad de Viajes */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Cantidad de Viajes
              </span>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900">
                  {facturacionData?.resumen?.totalViajes || 0}
                </span>
                <span className="text-xs text-slate-500 ml-1">servicios</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Promedio: ${(facturacionData?.resumen?.promedioPorViaje || 0).toLocaleString('es-AR')} / viaje
              </span>
            </div>

            {/* Km y Tiempo de Espera */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Km & Tiempo Espera
              </span>
              <div className="mt-2">
                <span className="text-xl font-bold text-slate-900">
                  {facturacionData?.resumen?.totalKm || 0} km
                </span>
                <span className="text-xs text-slate-500 ml-1.5 font-medium">
                  • {Math.floor((facturacionData?.resumen?.totalEsperaMinutos || 0) / 60)}h {(facturacionData?.resumen?.totalEsperaMinutos || 0) % 60}m
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block truncate">
                {selectedArtFilter !== 'all'
                  ? artList.find((a) => a.id === selectedArtFilter)?.nombre || 'ART'
                  : `${facturacionData?.porArt?.length || 0} empresas con viajes`}
              </span>
            </div>
          </div>

          {/* Si se seleccionó "Todas las ARTs", mostrar desglose por ART */}
          {selectedArtFilter === 'all' && facturacionData?.porArt && facturacionData.porArt.length > 0 && (
            <div className="no-print bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-600" />
                Resumen Separado por ART (Para Facturación Individual)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {facturacionData.porArt.map((item: any) => (
                  <div
                    key={item.artEmpresa.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{item.artEmpresa.nombre}</span>
                      <button
                        onClick={() => setSelectedArtFilter(item.artEmpresa.id)}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1"
                      >
                        Filtrar <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {item.artEmpresa.cuit && (
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">CUIT: {item.artEmpresa.cuit}</p>
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block">Viajes:</span>
                        <span className="font-bold text-slate-800">{item.totalViajes} ({item.totalKm} km)</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Factura ART:</span>
                        <span className="font-bold text-emerald-600">
                          ${item.totalFacturado.toLocaleString('es-AR')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Paga Choferes:</span>
                        <span className="font-bold text-blue-600">
                          ${(item.totalPagaChofer || 0).toLocaleString('es-AR')}
                        </span>
                      </div>
                      <div>
                        <span className="text-indigo-600 font-semibold block">Ganancia Neta:</span>
                        <span className="font-bold text-indigo-700">
                          ${(item.totalGanancia || 0).toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TABLA DE DETALLE DE VIAJES (INCLUYE VISTA DE IMPRESIÓN)        */}
          {/* ============================================================== */}
          <div
            id="seccion-imprimible-factura"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            {/* Encabezado formal visible solo al imprimir */}
            <div className="hidden print:block p-6 border-b border-slate-300">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{remiseriaNombre}</h1>
                  <p className="text-xs text-slate-600 mt-1">
                    Detalle Oficial de Servicios Realizados para Facturación
                  </p>
                  <p className="text-xs text-slate-500">
                    Fecha de emisión del reporte: {new Date().toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-bold text-slate-800">
                    {selectedArtFilter !== 'all'
                      ? artList.find((a) => a.id === selectedArtFilter)?.nombre
                      : 'TODAS LAS ARTs'}
                  </h2>
                  {selectedArtFilter !== 'all' && (
                    <p className="text-xs text-slate-600">
                      CUIT: {artList.find((a) => a.id === selectedArtFilter)?.cuit || 'S/D'}
                    </p>
                  )}
                  <p className="text-xs font-semibold text-slate-700 mt-1">
                    Período: {fechaDesde} al {fechaHasta}
                  </p>
                </div>
              </div>

              {/* Resumen numérico en la hoja impresa */}
              <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Total Viajes:</span>
                  <span className="font-bold text-sm text-slate-900">{facturacionData?.resumen?.totalViajes || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Km con Pasajero:</span>
                  <span className="font-bold text-sm text-slate-900">{facturacionData?.resumen?.totalKm || 0} km</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Horas de Espera:</span>
                  <span className="font-bold text-sm text-slate-900">
                    {Math.round((facturacionData?.resumen?.totalEsperaMinutos || 0) / 60)} hs
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Liquidado a Facturar:</span>
                  <span className="font-bold text-base text-emerald-700">
                    ${(facturacionData?.resumen?.totalFacturado || 0).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            {/* Cabecera de la tabla */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Detalle Individual de Viajes para Facturar ({viajesFiltrados.length})
                </h4>
                <p className="text-xs text-slate-500">
                  Cada viaje incluye origen, destino, chofer, móvil, km y espera calculada según la tarifa de su ART.
                </p>
              </div>
            </div>

            {loadingFacturacion ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
                <p className="text-sm text-slate-500 mt-2">Calculando importes y facturación de ART...</p>
              </div>
            ) : viajesFiltrados.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No se encontraron viajes para este período</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Probá seleccionando un rango de fechas más amplio o verificá que los viajes tengan asignada una ART.
                </p>
              </div>
            ) : (
              <>
                {/* VISTA MÓVIL (CARDS TÁCTILES) */}
                <div className="block md:hidden divide-y divide-slate-100 no-print">
                  {viajesFiltrados.map((viaje: any) => {
                    const fecha = new Date(viaje.fecha);
                    const esperaMin = Math.round((viaje.tiempoEsperaSegundos || 0) / 60);
                    const facturaArt = Number(viaje.precioFacturaArt ?? viaje.precioArt ?? viaje.precio ?? 0);
                    const pagaChofer = Number(viaje.pagaChofer ?? viaje.precio ?? 0);
                    const ganancia = Number(viaje.gananciaNeta ?? Math.max(0, facturaArt - pagaChofer));

                    return (
                      <div key={viaje.id} className="p-4 space-y-2.5 bg-white hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{viaje.artEmpresa?.nombre || 'Sin ART'}</span>
                              {viaje.numeroSiniestro && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                                  #{viaje.numeroSiniestro}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {fecha.toLocaleDateString('es-AR')} a las {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                            </p>
                          </div>
                          <span className="text-sm font-extrabold text-emerald-700">
                            ${facturaArt.toLocaleString('es-AR')}
                          </span>
                        </div>

                        <div className="text-xs text-slate-700">
                          <p className="font-semibold text-slate-900">
                            {viaje.clienteNombre || `${viaje.cliente?.nombre || ''} ${viaje.cliente?.apellido || ''}`.trim() || 'Pasajero'}
                          </p>
                          <p className="text-slate-500 truncate mt-0.5">
                            {viaje.origen} → {viaje.destino}
                          </p>
                        </div>

                        {/* Desglose Financiero */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Km / Espera</span>
                            <span className="font-semibold text-slate-800">{Number(viaje.distanciaKm || 0).toFixed(1)} km / {esperaMin}m</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-blue-600 block">Paga Chofer</span>
                            <span className="font-semibold text-blue-700">${pagaChofer.toLocaleString('es-AR')}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-indigo-600 block">Ganancia</span>
                            <span className="font-bold text-indigo-700">${ganancia.toLocaleString('es-AR')}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-400">
                            Chofer: <strong className="text-slate-600">{viaje.chofer ? `${viaje.chofer.nombre} ${viaje.chofer.apellido}` : 'Sin chofer'}</strong> ({viaje.vehiculo?.patente || 'S/D'})
                          </span>
                          <button
                            onClick={() => abrirModalEditarViajeArt(viaje)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                          >
                            Editar ART
                          </button>
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
                      <th className="py-3 px-4">Fecha / Hora</th>
                      <th className="py-3 px-4">ART / Siniestro</th>
                      <th className="py-3 px-4">Pasajero / Paciente</th>
                      <th className="py-3 px-4">Recorrido</th>
                      <th className="py-3 px-4">Móvil / Chofer</th>
                      <th className="py-3 px-3 text-center">Km / Espera</th>
                      <th className="py-3 px-4 text-right text-emerald-700">Factura ART ($)</th>
                      <th className="py-3 px-4 text-right text-blue-700">Paga Chofer ($)</th>
                      <th className="py-3 px-4 text-right text-indigo-700">Ganancia Neta ($)</th>
                      <th className="py-3 px-4 text-center no-print">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viajesFiltrados.map((viaje: any) => {
                      const fecha = new Date(viaje.fecha);
                      const esperaMin = Math.round((viaje.tiempoEsperaSegundos || 0) / 60);
                      const facturaArt = Number(viaje.precioFacturaArt ?? viaje.precioArt ?? viaje.precio ?? 0);
                      const pagaChofer = Number(viaje.pagaChofer ?? viaje.precio ?? 0);
                      const ganancia = Number(viaje.gananciaNeta ?? Math.max(0, facturaArt - pagaChofer));

                      return (
                        <tr key={viaje.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Fecha / Hora */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-900 block">
                              {fecha.toLocaleDateString('es-AR')}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                            </span>
                          </td>

                          {/* ART / Siniestro */}
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">
                              {viaje.artEmpresa?.nombre || 'Sin ART'}
                            </span>
                            {viaje.numeroSiniestro ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 mt-0.5">
                                Siniestro: {viaje.numeroSiniestro}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 block">-</span>
                            )}
                          </td>

                          {/* Pasajero */}
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-900 block">
                              {viaje.clienteNombre ||
                                `${viaje.cliente?.nombre || ''} ${viaje.cliente?.apellido || ''}`.trim() ||
                                'Pasajero Telefónico'}
                            </span>
                            {(viaje.clienteTelefono || viaje.cliente?.telefono) && (
                              <span className="text-[11px] text-slate-500 block">
                                Tel: {viaje.clienteTelefono || viaje.cliente?.telefono}
                              </span>
                            )}
                          </td>

                          {/* Recorrido */}
                          <td className="py-3 px-4 max-w-xs">
                            <div className="space-y-0.5">
                              <p className="text-slate-800 font-medium truncate" title={viaje.origen}>
                                <span className="text-emerald-600 font-bold">O:</span> {viaje.origen}
                              </p>
                              <p className="text-slate-600 truncate" title={viaje.destino}>
                                <span className="text-red-500 font-bold">D:</span> {viaje.destino}
                              </p>
                            </div>
                          </td>

                          {/* Chofer / Móvil */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {viaje.chofer ? (
                              <div>
                                <span className="font-medium text-slate-800 block">
                                  {viaje.chofer.nombre} {viaje.chofer.apellido}
                                </span>
                                <span className="text-[11px] text-slate-500 block">
                                  {viaje.vehiculo?.patente || 'Móvil asignado'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Sin asignar</span>
                            )}
                          </td>

                          {/* Km / Espera */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="font-bold text-slate-800">
                              {(viaje.distanciaKmConPasajero || 0).toFixed(1)} km
                            </span>
                            {esperaMin > 0 && (
                              <span className="text-[10px] text-amber-700 font-semibold block">
                                +{esperaMin}m espera
                              </span>
                            )}
                          </td>

                          {/* Factura ART */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="text-sm font-bold text-emerald-600">
                              ${facturaArt.toLocaleString('es-AR')}
                            </span>
                          </td>

                          {/* Paga Chofer */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="text-sm font-semibold text-blue-700">
                              ${pagaChofer.toLocaleString('es-AR')}
                            </span>
                          </td>

                          {/* Ganancia Neta */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="text-sm font-black text-indigo-700">
                              ${ganancia.toLocaleString('es-AR')}
                            </span>
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-4 text-center no-print whitespace-nowrap">
                            <button
                              onClick={() => abrirModalEditarViajeArt(viaje)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                              title="Reasignar ART o número de siniestro"
                            >
                              Editar ART
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Pie de tabla con totales */}
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                      <td colSpan={5} className="py-3 px-4 text-right">
                        TOTALES DEL PERÍODO:
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {facturacionData?.resumen?.totalKm || 0} km
                      </td>
                      <td className="py-3 px-4 text-right text-base text-emerald-700 whitespace-nowrap">
                        ${(facturacionData?.resumen?.totalFacturado || 0).toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-right text-base text-blue-700 whitespace-nowrap">
                        ${(facturacionData?.resumen?.totalPagaChofer || 0).toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-right text-base text-indigo-700 whitespace-nowrap">
                        ${(facturacionData?.resumen?.totalGanancia || 0).toLocaleString('es-AR')}
                      </td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL CREAR / EDITAR ART O EMPRESA                            */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Encabezado del Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingArt ? `Editar ART: ${editingArt.nombre}` : 'Nueva ART o Empresa Corporativa'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fijá los precios especiales de kilómetro, tramo local y hora de espera.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarArt} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Datos Generales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nombre de la ART / Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Provincia ART, La Segunda ART, Molino Chivilcoy"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    CUIT de Facturación
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 30-70809012-4"
                    value={formData.cuit || ''}
                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Provincia ART S.A."
                    value={formData.razonSocial || ''}
                    onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Teléfono Contacto / Autorizaciones
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 0800-333-1234"
                    value={formData.telefono || ''}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email para Facturas
                  </label>
                  <input
                    type="email"
                    placeholder="facturacion@art.com.ar"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* SECCIÓN CRÍTICA DE TARIFAS SOLICITADAS POR EL USUARIO */}
              <div className="p-4 rounded-2xl bg-primary-50/50 border border-primary-100 space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-primary-800">
                    Tarifas Acordadas con esta ART
                  </span>
                </div>
                <p className="text-xs text-primary-600">
                  Precios que se usarán automáticamente para cotizar y facturar los viajes de esta ART en {remiseriaNombre}.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {/* Precio por Tramo (Viajes Locales) */}
                  <div className="bg-white p-3 rounded-xl border border-primary-200 shadow-xs">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Precio Tramo Local ($) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        required
                        value={formData.precioTramo}
                        onChange={(e) => setFormData({ ...formData, precioTramo: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">Viajes urbanos (0 a 1 Km)</span>
                  </div>

                  {/* Precio por Kilómetro */}
                  <div className="bg-white p-3 rounded-xl border border-primary-200 shadow-xs">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Precio por Km ($/km) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        required
                        value={formData.valorKm}
                        onChange={(e) => setFormData({ ...formData, valorKm: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-primary-700 focus:bg-white focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">Por cada km adicional</span>
                  </div>

                  {/* Precio Hora de Espera */}
                  <div className="bg-white p-3 rounded-xl border border-primary-200 shadow-xs">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Hora de Espera ($/h) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        required
                        value={formData.valorHoraEspera}
                        onChange={(e) => setFormData({ ...formData, valorHoraEspera: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-amber-700 focus:bg-white focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">Espera en clínica / turno</span>
                  </div>
                </div>
              </div>

              {/* SECCIÓN DE TARIFA PAGADA AL CHOFER (CONFIDENCIAL) */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Tarifa Pagada al Chofer (Liquidación del Móvil)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    Confidencial
                  </span>
                </div>
                <p className="text-xs text-amber-800">
                  Bajo ningún punto de vista el chofer o coordinador conocerá el precio pactado con la ART. Seleccioná cómo se le liquida al chofer:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.pagaChoferTipo === 'LISTA_NORMAL'
                        ? 'border-amber-500 bg-white shadow-xs'
                        : 'border-amber-200/60 bg-amber-50/40 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pagaChoferTipo"
                      value="LISTA_NORMAL"
                      checked={formData.pagaChoferTipo === 'LISTA_NORMAL'}
                      onChange={() => setFormData({ ...formData, pagaChoferTipo: 'LISTA_NORMAL' })}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Lista Normal de la Remisería</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        El chofer cobra la bajada de bandera y precio por km normal de {remiseriaNombre}.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.pagaChoferTipo === 'PERSONALIZADO'
                        ? 'border-amber-500 bg-white shadow-xs'
                        : 'border-amber-200/60 bg-amber-50/40 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pagaChoferTipo"
                      value="PERSONALIZADO"
                      checked={formData.pagaChoferTipo === 'PERSONALIZADO'}
                      onChange={() => setFormData({ ...formData, pagaChoferTipo: 'PERSONALIZADO' })}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Tarifa Especial para Chofer</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Fijar precios específicos a liquidar al chofer para los viajes de esta ART.
                      </span>
                    </div>
                  </label>
                </div>

                {formData.pagaChoferTipo === 'PERSONALIZADO' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                    <div className="bg-white p-2.5 rounded-xl border border-amber-300">
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Tramo Chofer ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={formData.choferPrecioTramo ?? 3500}
                        onChange={(e) =>
                          setFormData({ ...formData, choferPrecioTramo: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-amber-300">
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Por Km Chofer ($/km)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={formData.choferValorKm ?? 1200}
                        onChange={(e) =>
                          setFormData({ ...formData, choferValorKm: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-amber-300">
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Espera Chofer ($/h)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={formData.choferValorHoraEspera ?? 10000}
                        onChange={(e) =>
                          setFormData({ ...formData, choferValorHoraEspera: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Observaciones y Estado */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notas de Facturación u Observaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Exige número de bono o autorización en cada viaje. Facturación del 1 al 5."
                  value={formData.observaciones || ''}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="artActivo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                >
                </input>
                <label htmlFor="artActivo" className="text-sm font-semibold text-slate-800 cursor-pointer">
                  ART activa para asignación de viajes
                </label>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingArt}
                  className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm shadow-primary-200 transition-colors disabled:opacity-50"
                >
                  {savingArt ? 'Guardando...' : editingArt ? 'Guardar Cambios' : 'Registrar ART'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL REASIGNAR ART O SINIESTRO A VIAJE                        */}
      {/* ============================================================== */}
      {modalViajeArtOpen && viajeSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Asignar ART o Siniestro al Viaje</h3>
            <p className="text-xs text-slate-500">
              Modificá la cuenta o número de siniestro del viaje de{' '}
              <span className="font-semibold text-slate-800">
                {viajeSeleccionado.clienteNombre || 'Pasajero'}
              </span>
              .
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ART / Empresa
                </label>
                <select
                  value={nuevoArtIdViaje}
                  onChange={(e) => setNuevoArtIdViaje(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white"
                >
                  <option value="">Sin ART (Viaje Particular Normal)</option>
                  {artList.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.nombre} (Tramo: ${art.precioTramo} - Km: ${art.valorKm})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  N° de Siniestro o Autorización
                </label>
                <input
                  type="text"
                  placeholder="Ej. SIN-98234-A"
                  value={nuevoSiniestroViaje}
                  onChange={(e) => setNuevoSiniestroViaje(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white"
                />
              </div>

              {nuevoArtIdViaje && (
                <div className="flex items-center gap-2 p-3 bg-primary-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="recalcTarifa"
                    checked={recalcularTarifaViaje}
                    onChange={(e) => setRecalcularTarifaViaje(e.target.checked)}
                    className="w-4 h-4 rounded text-primary-600"
                  />
                  <label htmlFor="recalcTarifa" className="text-xs font-medium text-primary-900 cursor-pointer">
                    Recalcular precio del viaje usando las tarifas de la ART seleccionada
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setModalViajeArtOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={guardarCambioViajeArt}
                disabled={guardandoViajeArt}
                className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {guardandoViajeArt ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
