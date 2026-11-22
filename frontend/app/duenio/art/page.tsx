'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { artEmpresaService, remiseriaService, choferService } from '@/lib/api';
import { ArtEmpresa, CreateArtEmpresaData, UpdateArtEmpresaData, FacturacionArtResponse, CierreFacturacionArt } from '@/types';
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
  Layers,
  AlertTriangle,
  RotateCcw,
  Wrench,
  ShieldCheck,
  Check,
  CheckCircle,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ArtPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Estados generales
  const [activeTab, setActiveTab] = useState<'tarifas' | 'facturacion' | 'cierres'>('tarifas');
  const [loading, setLoading] = useState(true);
  const [artList, setArtList] = useState<ArtEmpresa[]>([]);
  const [choferesList, setChoferesList] = useState<any[]>([]);
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
    periodoFacturacion: 'MENSUAL',
    diaCorteFacturacion: 1,
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

  // Estados para Reasignar Chofer antes de salir (Punto 1)
  const [isModalReasignarOpen, setIsModalReasignarOpen] = useState(false);
  const [viajeParaReasignar, setViajeParaReasignar] = useState<any | null>(null);
  const [nuevoChoferId, setNuevoChoferId] = useState('');
  const [motivoReasignacion, setMotivoReasignacion] = useState('Vehículo descompuesto / Avería');
  const [savingReasignacion, setSavingReasignacion] = useState(false);

  // Estados para Auxilio Mecánico / Trasbordo en viaje (Punto 2)
  const [isModalAuxilioOpen, setIsModalAuxilioOpen] = useState(false);
  const [viajeParaAuxilio, setViajeParaAuxilio] = useState<any | null>(null);
  const [choferAuxilioId, setChoferAuxilioId] = useState('');
  const [puntoTrasbordo, setPuntoTrasbordo] = useState('');
  const [kmChoferInicial, setKmChoferInicial] = useState('');
  const [savingAuxilio, setSavingAuxilio] = useState(false);

  // Estados para Modificar / Anular Siniestro (Punto 3)
  const [isModalSiniestroOpen, setIsModalSiniestroOpen] = useState(false);
  const [viajeParaSiniestro, setViajeParaSiniestro] = useState<any | null>(null);
  const [tipoAccionSiniestro, setTipoAccionSiniestro] = useState<'MODIFICAR' | 'ANULAR'>('MODIFICAR');
  const [nuevoNumeroSiniestro, setNuevoNumeroSiniestro] = useState('');
  const [motivoSiniestro, setMotivoSiniestro] = useState('');
  const [savingSiniestro, setSavingSiniestro] = useState(false);

  // Estados para Coordinación con el Pasajero (Punto 4)
  const [isModalCoordinacionOpen, setIsModalCoordinacionOpen] = useState(false);
  const [viajeParaCoordinacion, setViajeParaCoordinacion] = useState<any | null>(null);
  const [estadoCoordinacionSeleccionado, setEstadoCoordinacionSeleccionado] = useState<string>('PENDIENTE_CONTACTO');
  const [motivoRechazoPaciente, setMotivoRechazoPaciente] = useState('');
  const [observacionesCoordinacion, setObservacionesCoordinacion] = useState('');
  const [savingCoordinacion, setSavingCoordinacion] = useState(false);

  // Estados para Peajes (Punto 6)
  const [isModalPeajesOpen, setIsModalPeajesOpen] = useState(false);
  const [viajeParaPeajes, setViajeParaPeajes] = useState<any | null>(null);
  const [montoPeajesInput, setMontoPeajesInput] = useState('');
  const [observacionesPeajeInput, setObservacionesPeajeInput] = useState('');
  const [savingPeajes, setSavingPeajes] = useState(false);

  // Estados para Cierres de Facturación y Cobranzas (Punto 7)
  const [cierresList, setCierresList] = useState<CierreFacturacionArt[]>([]);
  const [loadingCierres, setLoadingCierres] = useState(false);
  const [filtroArtCierre, setFiltroArtCierre] = useState<string>('all');
  const [filtroEstadoCierre, setFiltroEstadoCierre] = useState<string>('all');

  // Modal Generar Cierre
  const [isModalGenerarCierreOpen, setIsModalGenerarCierreOpen] = useState(false);
  const [artCierreId, setArtCierreId] = useState('');
  const [fechaDesdeCierre, setFechaDesdeCierre] = useState('');
  const [fechaHastaCierre, setFechaHastaCierre] = useState('');
  const [observacionesCierre, setObservacionesCierre] = useState('');
  const [savingGenerarCierre, setSavingGenerarCierre] = useState(false);

  // Modal Registrar Factura
  const [isModalRegistrarFacturaOpen, setIsModalRegistrarFacturaOpen] = useState(false);
  const [cierreParaFactura, setCierreParaFactura] = useState<CierreFacturacionArt | null>(null);
  const [numeroFacturaInput, setNumeroFacturaInput] = useState('');
  const [fechaEmisionInput, setFechaEmisionInput] = useState('');
  const [fechaEnvioFacturaInput, setFechaEnvioFacturaInput] = useState('');
  const [observacionesFacturaInput, setObservacionesFacturaInput] = useState('');
  const [savingFactura, setSavingFactura] = useState(false);

  // Modal Registrar Cobro
  const [isModalMarcarCobradoOpen, setIsModalMarcarCobradoOpen] = useState(false);
  const [cierreParaCobrado, setCierreParaCobrado] = useState<CierreFacturacionArt | null>(null);
  const [fechaCobroInput, setFechaCobroInput] = useState('');
  const [metodoCobroInput, setMetodoCobroInput] = useState('TRANSFERENCIA');
  const [comprobanteCobroInput, setComprobanteCobroInput] = useState('');
  const [observacionesCobroInput, setObservacionesCobroInput] = useState('');
  const [savingCobro, setSavingCobro] = useState(false);

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

  // Cargar lista de ARTs, choferes y nombre de remisería
  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [artRes, remRes, choferRes] = await Promise.all([
        artEmpresaService.getAll(),
        remiseriaService.getAll(),
        choferService.getAll()
      ]);

      if (artRes.success && artRes.data) {
        setArtList(artRes.data);
      }
      if (remRes.success && remRes.data && remRes.data.length > 0) {
        const miRem = remRes.data[0];
        setRemiseriaNombre(miRem.nombreFantasia || 'Remises Bruno');
      }
      if (choferRes.success && choferRes.data) {
        setChoferesList(choferRes.data.filter((c: any) => c.estado === 'ACTIVO'));
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
    } else if (activeTab === 'cierres') {
      cargarCierres();
    }
  }, [activeTab, selectedArtFilter, fechaDesde, fechaHasta, estadoViajeFiltro, filtroArtCierre, filtroEstadoCierre]);

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
      periodoFacturacion: 'MENSUAL',
      diaCorteFacturacion: 1,
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
      periodoFacturacion: art.periodoFacturacion || 'MENSUAL',
      diaCorteFacturacion: art.diaCorteFacturacion ?? 1,
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

  // Handler Reasignar Chofer (Punto 1)
  const handleAbrirReasignar = (viaje: any) => {
    setViajeParaReasignar(viaje);
    setNuevoChoferId('');
    setMotivoReasignacion('Vehículo descompuesto / Avería');
    setIsModalReasignarOpen(true);
  };

  const handleGuardarReasignar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viajeParaReasignar || !nuevoChoferId) {
      toast.error('Seleccioná el nuevo chofer');
      return;
    }
    try {
      setSavingReasignacion(true);
      const res = await artEmpresaService.reasignarChofer(viajeParaReasignar.id, {
        nuevoChoferId,
        motivo: motivoReasignacion,
      });
      if (res.success) {
        toast.success('Viaje reasignado correctamente al nuevo chofer');
        setIsModalReasignarOpen(false);
        cargarFacturacion();
      } else {
        toast.error(res.message || 'Error al reasignar chofer');
      }
    } catch (error: any) {
      toast.error('Error al reasignar chofer');
    } finally {
      setSavingReasignacion(false);
    }
  };

  // Handler Auxilio Mecánico / Trasbordo en viaje (Punto 2)
  const handleAbrirAuxilio = (viaje: any) => {
    setViajeParaAuxilio(viaje);
    setChoferAuxilioId('');
    setPuntoTrasbordo('');
    setKmChoferInicial(viaje.distanciaKmConPasajero ? String(Math.round(viaje.distanciaKmConPasajero / 2)) : '');
    setIsModalAuxilioOpen(true);
  };

  const handleGuardarAuxilio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viajeParaAuxilio || !choferAuxilioId) {
      toast.error('Seleccioná el chofer de auxilio / trasbordo');
      return;
    }
    try {
      setSavingAuxilio(true);
      const res = await artEmpresaService.auxilioMecanico(viajeParaAuxilio.id, {
        nuevoChoferId: choferAuxilioId,
        puntoTrasbordo: puntoTrasbordo.trim() || 'En ruta',
        kmChoferInicial: kmChoferInicial ? parseFloat(kmChoferInicial) : undefined,
      });
      if (res.success) {
        toast.success('Auxilio mecánico activado. Viaje transferido al nuevo móvil.');
        setIsModalAuxilioOpen(false);
        cargarFacturacion();
      } else {
        toast.error(res.message || 'Error al procesar auxilio');
      }
    } catch (error: any) {
      toast.error('Error al registrar auxilio');
    } finally {
      setSavingAuxilio(false);
    }
  };

  // Handler Modificar / Anular Siniestro (Punto 3)
  const handleAbrirSiniestro = (viaje: any, tipo: 'MODIFICAR' | 'ANULAR') => {
    setViajeParaSiniestro(viaje);
    setTipoAccionSiniestro(tipo);
    setNuevoNumeroSiniestro(viaje.numeroSiniestro || '');
    setMotivoSiniestro('');
    setIsModalSiniestroOpen(true);
  };

  const handleGuardarSiniestro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viajeParaSiniestro) return;
    try {
      setSavingSiniestro(true);
      if (tipoAccionSiniestro === 'MODIFICAR') {
        if (!nuevoNumeroSiniestro.trim()) {
          toast.error('Ingresá el nuevo número de siniestro');
          return;
        }
        const res = await artEmpresaService.modificarSiniestro(viajeParaSiniestro.id, {
          nuevoNumeroSiniestro: nuevoNumeroSiniestro.trim(),
          motivo: motivoSiniestro.trim() || 'Corrección de número de siniestro',
        });
        if (res.success) {
          toast.success('Siniestro actualizado con éxito');
          setIsModalSiniestroOpen(false);
          cargarFacturacion();
        } else {
          toast.error(res.message || 'Error al modificar siniestro');
        }
      } else {
        const res = await artEmpresaService.anularSiniestro(viajeParaSiniestro.id, {
          motivo: motivoSiniestro.trim() || 'Siniestro anulado por la ART',
          numeroSiniestroNuevo: nuevoNumeroSiniestro.trim() || undefined,
        });
        if (res.success) {
          toast.success('Viaje de siniestro anulado');
          setIsModalSiniestroOpen(false);
          cargarFacturacion();
        } else {
          toast.error(res.message || 'Error al anular siniestro');
        }
      }
    } catch (error: any) {
      toast.error('Error al procesar siniestro');
    } finally {
      setSavingSiniestro(false);
    }
  };

  // Handler Coordinación con Pasajero (Punto 4)
  const handleAbrirCoordinacion = (viaje: any) => {
    setViajeParaCoordinacion(viaje);
    setEstadoCoordinacionSeleccionado(viaje.estadoCoordinacion || 'PENDIENTE_CONTACTO');
    setMotivoRechazoPaciente(viaje.motivoRechazoPaciente || '');
    setObservacionesCoordinacion('');
    setIsModalCoordinacionOpen(true);
  };

  const handleGuardarCoordinacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viajeParaCoordinacion) return;
    try {
      setSavingCoordinacion(true);
      const res = await artEmpresaService.actualizarCoordinacionPaciente(viajeParaCoordinacion.id, {
        estadoCoordinacion: estadoCoordinacionSeleccionado as any,
        motivoRechazo: estadoCoordinacionSeleccionado === 'RECHAZADO_POR_PACIENTE' ? (motivoRechazoPaciente.trim() || 'Pasajero no desea viajar') : undefined,
        observaciones: observacionesCoordinacion.trim() || undefined,
      });
      if (res.success) {
        toast.success('Estado de coordinación actualizado');
        setIsModalCoordinacionOpen(false);
        cargarFacturacion();
      } else {
        toast.error(res.message || 'Error al actualizar coordinación');
      }
    } catch (error: any) {
      toast.error('Error al actualizar coordinación');
    } finally {
      setSavingCoordinacion(false);
    }
  };

  // Handler Peajes (Punto 6)
  const handleAbrirPeajes = (viaje: any) => {
    setViajeParaPeajes(viaje);
    setMontoPeajesInput(viaje.montoPeajes ? String(viaje.montoPeajes) : '');
    setObservacionesPeajeInput(viaje.observacionesPeaje || '');
    setIsModalPeajesOpen(true);
  };

  const handleGuardarPeajes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viajeParaPeajes) return;
    try {
      setSavingPeajes(true);
      const monto = parseFloat(montoPeajesInput) || 0;
      const res = await artEmpresaService.actualizarPeajes(viajeParaPeajes.id, {
        montoPeajes: monto,
        observacionesPeaje: observacionesPeajeInput.trim() || undefined,
      });
      if (res.success) {
        toast.success('Peajes actualizados correctamente');
        setIsModalPeajesOpen(false);
        cargarFacturacion();
      } else {
        toast.error(res.message || 'Error al actualizar peajes');
      }
    } catch (error: any) {
      toast.error('Error al actualizar peajes');
    } finally {
      setSavingPeajes(false);
    }
  };

  // Handler Periodo Actual ART (Punto 5)
  const aplicarPeriodoActualArt = async () => {
    if (selectedArtFilter === 'all') {
      toast.error('Seleccioná primero una ART específica en el filtro');
      return;
    }
    try {
      const res = await artEmpresaService.getPeriodoActual(selectedArtFilter);
      if (res.success && res.data) {
        setFechaDesde(res.data.fechaDesde);
        setFechaHasta(res.data.fechaHasta);
        setPeriodoFiltro('personalizado');
        toast.success(`Rango ajustado al ciclo ${res.data.periodoTipo.toLowerCase()} de la ART (${res.data.fechaDesde} al ${res.data.fechaHasta})`);
      } else {
        toast.error(res.message || 'No se pudo obtener el ciclo de la ART');
      }
    } catch (error: any) {
      toast.error('Error al consultar ciclo de la ART');
    }
  };

  // Cierres Handlers (Punto 7)
  const cargarCierres = async () => {
    try {
      setLoadingCierres(true);
      const params: any = {};
      if (filtroArtCierre !== 'all') params.artEmpresaId = filtroArtCierre;
      if (filtroEstadoCierre !== 'all') params.estado = filtroEstadoCierre;
      const res = await artEmpresaService.getCierresFacturacion(params);
      if (res.success && res.data) {
        setCierresList(res.data);
      }
    } catch (error) {
      console.error('Error al cargar cierres:', error);
    } finally {
      setLoadingCierres(false);
    }
  };

  const handleAbrirModalGenerarCierre = () => {
    if (selectedArtFilter === 'all') {
      toast.error('Seleccioná una ART específica para generar el cierre');
      return;
    }
    setArtCierreId(selectedArtFilter);
    setFechaDesdeCierre(fechaDesde);
    setFechaHastaCierre(fechaHasta);
    setObservacionesCierre('');
    setIsModalGenerarCierreOpen(true);
  };

  const handleGenerarCierre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artCierreId || !fechaDesdeCierre || !fechaHastaCierre) {
      toast.error('Completá la ART y el rango de fechas');
      return;
    }
    try {
      setSavingGenerarCierre(true);
      const res = await artEmpresaService.generarCierreFacturacion({
        artEmpresaId: artCierreId,
        fechaDesde: fechaDesdeCierre,
        fechaHasta: fechaHastaCierre,
        observaciones: observacionesCierre.trim() || undefined,
      });
      if (res.success) {
        toast.success(res.message || 'Cierre de facturación generado exitosamente');
        setIsModalGenerarCierreOpen(false);
        setActiveTab('cierres');
        cargarCierres();
      } else {
        toast.error(res.message || 'Error al generar cierre');
      }
    } catch (error: any) {
      toast.error('Error al generar cierre de facturación');
    } finally {
      setSavingGenerarCierre(false);
    }
  };

  const handleAbrirRegistrarFactura = (cierre: CierreFacturacionArt) => {
    setCierreParaFactura(cierre);
    setNumeroFacturaInput(cierre.numeroFactura || '');
    setFechaEmisionInput(cierre.fechaEmision ? cierre.fechaEmision.split('T')[0] : '');
    setFechaEnvioFacturaInput(cierre.fechaEnvioFactura ? cierre.fechaEnvioFactura.split('T')[0] : '');
    setObservacionesFacturaInput(cierre.observaciones || '');
    setIsModalRegistrarFacturaOpen(true);
  };

  const handleGuardarFacturaCierre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cierreParaFactura || !numeroFacturaInput.trim()) {
      toast.error('Ingresá el número de factura emitida');
      return;
    }
    try {
      setSavingFactura(true);
      const res = await artEmpresaService.registrarFacturaCierre(cierreParaFactura.id, {
        numeroFactura: numeroFacturaInput.trim(),
        fechaEmision: fechaEmisionInput,
        fechaEnvioFactura: fechaEnvioFacturaInput,
        observaciones: observacionesFacturaInput.trim() || undefined,
      });
      if (res.success) {
        toast.success('Factura registrada y agendada exitosamente');
        setIsModalRegistrarFacturaOpen(false);
        cargarCierres();
      } else {
        toast.error(res.message || 'Error al registrar factura');
      }
    } catch (error: any) {
      toast.error('Error al registrar factura');
    } finally {
      setSavingFactura(false);
    }
  };

  const handleAbrirMarcarCobrado = (cierre: CierreFacturacionArt) => {
    setCierreParaCobrado(cierre);
    setFechaCobroInput(cierre.fechaCobro ? cierre.fechaCobro.split('T')[0] : '');
    setMetodoCobroInput(cierre.metodoCobro || 'TRANSFERENCIA');
    setComprobanteCobroInput(cierre.comprobanteCobroUrl || '');
    setObservacionesCobroInput(cierre.observaciones || '');
    setIsModalMarcarCobradoOpen(true);
  };

  const handleGuardarCobroCierre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cierreParaCobrado || !fechaCobroInput) {
      toast.error('Ingresá la fecha de cobro');
      return;
    }
    try {
      setSavingCobro(true);
      const res = await artEmpresaService.marcarCierreCobrado(cierreParaCobrado.id, {
        fechaCobro: fechaCobroInput,
        metodoCobro: metodoCobroInput,
        comprobanteCobroUrl: comprobanteCobroInput.trim() || undefined,
        observaciones: observacionesCobroInput.trim() || undefined,
      });
      if (res.success) {
        toast.success('¡Cierre marcado como COBRADO!');
        setIsModalMarcarCobradoOpen(false);
        cargarCierres();
      } else {
        toast.error(res.message || 'Error al registrar cobro');
      }
    } catch (error: any) {
      toast.error('Error al registrar cobro');
    } finally {
      setSavingCobro(false);
    }
  };

  const handleAnularCierre = async (cierre: CierreFacturacionArt) => {
    if (!window.confirm(`¿Estás seguro de anular el cierre #${cierre.id.slice(0, 8)}? Los viajes volverán a quedar disponibles para un nuevo cierre.`)) {
      return;
    }
    try {
      const res = await artEmpresaService.anularCierreFacturacion(cierre.id);
      if (res.success) {
        toast.success('Cierre anulado y viajes liberados');
        cargarCierres();
      } else {
        toast.error(res.message || 'Error al anular cierre');
      }
    } catch (error: any) {
      toast.error('Error al anular cierre');
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
              ? 'border-primary-600 text-primary-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Facturación y Viajes ART
          {facturacionData?.resumen?.totalViajes !== undefined && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-primary-50 text-primary-700 font-medium">
              {facturacionData.resumen.totalViajes} viajes
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cierres')}
          className={`flex items-center gap-2 py-4 px-4 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'cierres'
              ? 'border-indigo-600 text-indigo-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Cierres y Cobranzas
          {cierresList.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800 font-bold">
              {cierresList.length}
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

                {selectedArtFilter !== 'all' && (
                  <button
                    onClick={aplicarPeriodoActualArt}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors flex items-center gap-1 shadow-xs"
                    title="Ajustar fechas según el ciclo (semanal, quincenal, mensual) de esta ART"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-700" />
                    <span>Ciclo Actual ART</span>
                  </button>
                )}
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

              <div className="flex flex-wrap items-center gap-2">
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
                {selectedArtFilter !== 'all' && (
                  <button
                    onClick={handleAbrirModalGenerarCierre}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-200 transition-all active:scale-95"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Generar Cierre Facturación</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tarjetas KPI del Período para Facturación y Ganancias */}
          <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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

            {/* Total Peajes Choferes */}
            <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs bg-linear-to-br from-white to-amber-50/20">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Peajes Informados
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-600">
                  ${(facturacionData?.resumen?.totalPeajes || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Reembolso chofer / Sumado a ART
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
                    const peajes = Number(viaje.montoPeajes || 0);
                    const facturaArt = Number(viaje.precioFacturaArt ?? viaje.precioArt ?? viaje.precio ?? 0) + peajes;
                    const pagaChofer = Number(viaje.pagaChofer ?? viaje.precio ?? 0) + peajes;
                    const ganancia = Number(viaje.gananciaNeta ?? Math.max(0, facturaArt - pagaChofer));

                    return (
                      <div key={viaje.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{viaje.artEmpresa?.nombre || 'Sin ART'}</span>
                              {viaje.numeroSiniestro ? (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                                  <span>#{viaje.numeroSiniestro}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirSiniestro(viaje, 'MODIFICAR')}
                                    className="hover:text-blue-900"
                                    title="Modificar número de siniestro"
                                  >
                                    <Edit className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirSiniestro(viaje, 'ANULAR')}
                                    className="text-rose-500 hover:text-rose-700 font-bold"
                                    title="Anular viaje de siniestro"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirSiniestro(viaje, 'MODIFICAR')}
                                  className="text-[10px] text-blue-600 underline font-medium"
                                >
                                  + Siniestro
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {fecha.toLocaleDateString('es-AR')} a las {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-emerald-700 block">
                              ${facturaArt.toLocaleString('es-AR')}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block mt-0.5 ${
                              viaje.estado === 'CANCELADO'
                                ? 'bg-rose-50 text-rose-700'
                                : viaje.estado === 'COMPLETADO'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}>
                              {viaje.estado}
                            </span>
                          </div>
                        </div>

                        {/* Estado de Coordinación y Auxilio en Móvil */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => handleAbrirCoordinacion(viaje)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                              viaje.estadoCoordinacion === 'CONFIRMADO'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : viaje.estadoCoordinacion === 'RECHAZADO_POR_PACIENTE'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : viaje.estadoCoordinacion === 'NO_RESPONDE'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {viaje.estadoCoordinacion === 'CONFIRMADO'
                              ? '✓ Pasajero Confirmó'
                              : viaje.estadoCoordinacion === 'RECHAZADO_POR_PACIENTE'
                              ? `✕ Pasajero Desiste ${viaje.motivoRechazoPaciente ? `(${viaje.motivoRechazoPaciente})` : ''}`
                              : viaje.estadoCoordinacion === 'NO_RESPONDE'
                              ? '⚠️ No Contesta'
                              : '📞 Coordinar Pasajero'}
                          </button>

                          {viaje.auxilioMecanico && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              🚨 Auxilio en: {viaje.puntoTrasbordo || 'Ruta'}
                            </span>
                          )}
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
                        <div className="grid grid-cols-4 gap-2 text-center text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Km/Espera</span>
                            <span className="font-semibold text-slate-800">{Number(viaje.distanciaKmConPasajero || viaje.distanciaKm || 0).toFixed(1)}k/{esperaMin}m</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-amber-700 block">Peajes</span>
                            <button
                              type="button"
                              onClick={() => handleAbrirPeajes(viaje)}
                              className="font-bold text-amber-800 hover:underline"
                            >
                              ${peajes.toLocaleString('es-AR')}
                            </button>
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

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                          <span className="text-[11px] text-slate-500">
                            Chofer: <strong>{viaje.chofer ? `${viaje.chofer.nombre} ${viaje.chofer.apellido}` : 'Sin chofer'}</strong>
                          </span>
                          <div className="flex items-center gap-1.5">
                            {viaje.estado !== 'COMPLETADO' && viaje.estado !== 'CANCELADO' && (
                              <button
                                type="button"
                                onClick={() => handleAbrirReasignar(viaje)}
                                className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold text-[10px] border border-amber-200"
                                title="Reasignar por rotura u otro chofer"
                              >
                                🔁 Reasignar
                              </button>
                            )}

                            {(viaje.estado === 'EN_CAMINO' || viaje.estado === 'EN_CURSO') && (
                              <button
                                type="button"
                                onClick={() => handleAbrirAuxilio(viaje)}
                                className="px-2 py-1 rounded-lg bg-rose-50 text-rose-800 font-bold text-[10px] border border-rose-200"
                                title="Auxilio mecánico y trasbordo"
                              >
                                🚨 Auxilio
                              </button>
                            )}

                            <button
                              onClick={() => abrirModalEditarViajeArt(viaje)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                            >
                              Editar ART
                            </button>
                          </div>
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
                      <th className="py-3 px-4 text-center">Coordinación</th>
                      <th className="py-3 px-4">Pasajero / Paciente</th>
                      <th className="py-3 px-4">Recorrido</th>
                      <th className="py-3 px-4">Móvil / Chofer</th>
                      <th className="py-3 px-3 text-center">Km / Espera</th>
                      <th className="py-3 px-3 text-right text-amber-700">Peajes ($)</th>
                      <th className="py-3 px-4 text-right text-emerald-700">Factura ART ($)</th>
                      <th className="py-3 px-4 text-right text-blue-700">Paga Chofer ($)</th>
                      <th className="py-3 px-4 text-right text-indigo-700">Ganancia Neta ($)</th>
                      <th className="py-3 px-4 text-center no-print">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viajesFiltrados.map((viaje: any) => {
                      const fecha = new Date(viaje.fecha);
                      const esperaMin = Math.round((viaje.tiempoEsperaSegundos || 0) / 60);
                      const peajes = Number(viaje.montoPeajes || 0);
                      const facturaArt = Number(viaje.precioFacturaArt ?? viaje.precioArt ?? viaje.precio ?? 0) + peajes;
                      const pagaChofer = Number(viaje.pagaChofer ?? viaje.precio ?? 0) + peajes;
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
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block">
                              {viaje.artEmpresa?.nombre || 'Sin ART'}
                            </span>
                            {viaje.numeroSiniestro ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                                  #{viaje.numeroSiniestro}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAbrirSiniestro(viaje, 'MODIFICAR')}
                                  className="text-slate-400 hover:text-blue-600 p-0.5"
                                  title="Corregir N° de Siniestro"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAbrirSiniestro(viaje, 'ANULAR')}
                                  className="text-rose-400 hover:text-rose-600 font-bold p-0.5"
                                  title="Anular Siniestro / Caído"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAbrirSiniestro(viaje, 'MODIFICAR')}
                                className="text-[10px] text-blue-600 underline font-medium"
                              >
                                + Asignar Siniestro
                              </button>
                            )}
                          </td>

                          {/* Coordinación con Pasajero */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleAbrirCoordinacion(viaje)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                viaje.estadoCoordinacion === 'CONFIRMADO'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : viaje.estadoCoordinacion === 'RECHAZADO_POR_PACIENTE'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : viaje.estadoCoordinacion === 'NO_RESPONDE'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                              title="Clic para coordinar llamado o registrar desistimiento"
                            >
                              {viaje.estadoCoordinacion === 'CONFIRMADO'
                                ? '✓ Confirmado'
                                : viaje.estadoCoordinacion === 'RECHAZADO_POR_PACIENTE'
                                ? '✕ Desiste'
                                : viaje.estadoCoordinacion === 'NO_RESPONDE'
                                ? '⚠️ No Contesta'
                                : '⏳ Coordinar'}
                            </button>
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
                              {viaje.auxilioMecanico && (
                                <p className="text-[10px] text-rose-700 font-bold bg-rose-50 px-1 rounded">
                                  🚨 Trasbordo en: {viaje.puntoTrasbordo || 'Ruta'}
                                </p>
                              )}
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

                          {/* Peajes */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleAbrirPeajes(viaje)}
                              className="font-bold text-amber-800 hover:text-amber-950 px-1.5 py-0.5 rounded hover:bg-amber-50"
                              title="Clic para registrar o ajustar peajes informados por el chofer"
                            >
                              ${peajes.toLocaleString('es-AR')}
                              <Edit className="w-2.5 h-2.5 inline ml-1 text-slate-400" />
                            </button>
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
                            <div className="flex items-center justify-center gap-1.5">
                              {viaje.estado !== 'COMPLETADO' && viaje.estado !== 'CANCELADO' && (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirReasignar(viaje)}
                                  className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 transition-colors"
                                  title="Reasignar a otro chofer si se rompió el vehículo antes de salir"
                                >
                                  <RotateCcw className="w-3 h-3 inline mr-0.5" />
                                  Reasignar
                                </button>
                              )}

                              {(viaje.estado === 'EN_CAMINO' || viaje.estado === 'EN_CURSO') && (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirAuxilio(viaje)}
                                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-200 transition-colors"
                                  title="Auxilio mecánico y trasbordo de pasajero en viaje"
                                >
                                  <Wrench className="w-3 h-3 inline mr-0.5" />
                                  Auxilio
                                </button>
                              )}

                              <button
                                onClick={() => abrirModalEditarViajeArt(viaje)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                                title="Editar ART o recalcular tarifa"
                              >
                                Editar ART
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Pie de tabla con totales */}
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                      <td colSpan={6} className="py-3 px-4 text-right">
                        TOTALES DEL PERÍODO:
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {facturacionData?.resumen?.totalKm || 0} km
                      </td>
                      <td className="py-3 px-3 text-right text-amber-800 whitespace-nowrap">
                        ${(facturacionData?.resumen?.totalPeajes || 0).toLocaleString('es-AR')}
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
      {/* PESTAÑA 3: CIERRES DE FACTURACIÓN Y COBRANZAS ART              */}
      {/* ============================================================== */}
      {activeTab === 'cierres' && (
        <div className="space-y-6">
          {/* Header y Filtros */}
          <div className="no-print bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Cierres de Facturación y Control de Cobranzas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Llevá el control riguroso de cada período cerrado, número de factura emitida, fecha de envío a la aseguradora y estado del cobro.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedArtFilter !== 'all') {
                      handleAbrirModalGenerarCierre();
                    } else {
                      setActiveTab('facturacion');
                      toast('Seleccioná la ART y el período para generar el cierre', { icon: 'ℹ️' });
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-200 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Cierre de Facturación</span>
                </button>
                <button
                  onClick={cargarCierres}
                  disabled={loadingCierres}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  title="Actualizar cierres"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingCierres ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Filtros de ART y Estado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Filtrar por ART
                </label>
                <select
                  value={filtroArtCierre}
                  onChange={(e) => setFiltroArtCierre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Todas las Aseguradoras</option>
                  {artList.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.nombre} {art.cuit ? `(${art.cuit})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estado del Cierre
                </label>
                <select
                  value={filtroEstadoCierre}
                  onChange={(e) => setFiltroEstadoCierre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="PENDIENTE_FACTURAR">Pendiente de Facturar</option>
                  <option value="FACTURA_EMITIDA">Factura Emitida y Enviada</option>
                  <option value="COBRADO">Cobrado con Éxito</option>
                  <option value="ANULADO">Anulado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tarjetas KPI de Cierres */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Facturado en Cierres
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  ${cierresList
                    .filter(c => c.estado !== 'ANULADO')
                    .reduce((acc, c) => acc + (Number(c.totalFacturadoArt) || 0), 0)
                    .toLocaleString('es-AR')}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {cierresList.filter(c => c.estado !== 'ANULADO').length} cierres registrados
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs bg-linear-to-br from-white to-emerald-50/20">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                Total Cobrado
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600">
                  ${cierresList
                    .filter(c => c.estado === 'COBRADO')
                    .reduce((acc, c) => acc + (Number(c.totalFacturadoArt) || 0), 0)
                    .toLocaleString('es-AR')}
                </span>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
                Cobranzas efectivas ingresadas
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs bg-linear-to-br from-white to-amber-50/20">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block">
                Pendiente de Cobro
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-600">
                  ${cierresList
                    .filter(c => c.estado === 'PENDIENTE_FACTURAR' || c.estado === 'FACTURA_EMITIDA')
                    .reduce((acc, c) => acc + (Number(c.totalFacturadoArt) || 0), 0)
                    .toLocaleString('es-AR')}
                </span>
              </div>
              <span className="text-[11px] text-amber-700 font-medium mt-1 block">
                En curso o a la espera de pago
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs bg-linear-to-br from-white to-indigo-50/20">
              <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wider block">
                Ganancia Neta en Cierres
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-600">
                  ${cierresList
                    .filter(c => c.estado !== 'ANULADO')
                    .reduce((acc, c) => acc + (Number(c.margenGanancia) || 0), 0)
                    .toLocaleString('es-AR')}
                </span>
              </div>
              <span className="text-[11px] text-indigo-600 font-medium mt-1 block">
                Margen neto remisería
              </span>
            </div>
          </div>

          {/* Listado de Cierres */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingCierres ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
                <p className="text-sm">Cargando cierres de facturación...</p>
              </div>
            ) : cierresList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-700 text-sm">No hay cierres de facturación registrados</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Generá un cierre desde la pestaña "Facturación y Viajes ART" para congelar los viajes del período y gestionar el cobro a la aseguradora.
                </p>
                <button
                  onClick={() => setActiveTab('facturacion')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                >
                  Ir a Facturación
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-3 px-4">ART / Aseguradora</th>
                      <th className="py-3 px-4">Período Cerrado</th>
                      <th className="py-3 px-4 text-center">Viajes / Km</th>
                      <th className="py-3 px-4 text-right">Peajes</th>
                      <th className="py-3 px-4 text-right">Total Factura</th>
                      <th className="py-3 px-4 text-right">Paga Choferes</th>
                      <th className="py-3 px-4 text-right">Ganancia</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4">Datos Factura & Cobranza</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cierresList.map((cierre) => {
                      const fDesdeLegible = cierre.fechaDesde ? new Date(cierre.fechaDesde).toLocaleDateString('es-AR') : '—';
                      const fHastaLegible = cierre.fechaHasta ? new Date(cierre.fechaHasta).toLocaleDateString('es-AR') : '—';

                      return (
                        <tr key={cierre.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>{cierre.artEmpresa?.nombre || 'ART'}</span>
                            </div>
                            {cierre.artEmpresa?.cuit && (
                              <span className="text-[10px] text-slate-400 font-mono block pl-5">
                                CUIT: {cierre.artEmpresa.cuit}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 block">
                              {fDesdeLegible} al {fHastaLegible}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium capitalize">
                              Ciclo {cierre.periodoTipo.toLowerCase()}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-bold text-slate-800">{cierre.totalViajes}</span>
                            <span className="text-[10px] text-slate-400 block">{cierre.totalKm} km</span>
                          </td>

                          <td className="py-3 px-4 text-right font-medium text-amber-700 whitespace-nowrap">
                            ${Number(cierre.totalPeajes || 0).toLocaleString('es-AR')}
                          </td>

                          <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm whitespace-nowrap">
                            ${Number(cierre.totalFacturadoArt || 0).toLocaleString('es-AR')}
                          </td>

                          <td className="py-3 px-4 text-right font-semibold text-blue-700 whitespace-nowrap">
                            ${Number(cierre.totalPagaChoferes || 0).toLocaleString('es-AR')}
                          </td>

                          <td className="py-3 px-4 text-right font-black text-indigo-700 whitespace-nowrap">
                            ${Number(cierre.margenGanancia || 0).toLocaleString('es-AR')}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                              cierre.estado === 'COBRADO'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : cierre.estado === 'FACTURA_EMITIDA'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : cierre.estado === 'ANULADO'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {cierre.estado === 'COBRADO'
                                ? '✓ Cobrado'
                                : cierre.estado === 'FACTURA_EMITIDA'
                                ? 'Factura Emitida'
                                : cierre.estado === 'ANULADO'
                                ? 'Anulado'
                                : 'Pendiente Factura'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-[11px] text-slate-600 min-w-[200px]">
                            {cierre.numeroFactura ? (
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900">
                                  📄 Fac. {cierre.numeroFactura}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {cierre.fechaEmision && `Emitida: ${new Date(cierre.fechaEmision).toLocaleDateString('es-AR')}`}
                                  {cierre.fechaEnvioFactura && ` • Enviada: ${new Date(cierre.fechaEnvioFactura).toLocaleDateString('es-AR')}`}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Sin factura registrada</span>
                            )}

                            {cierre.fechaCobro && (
                              <p className="text-[10px] text-emerald-700 font-bold mt-1">
                                💰 Cobrado: {new Date(cierre.fechaCobro).toLocaleDateString('es-AR')} ({cierre.metodoCobro || 'Transferencia'})
                              </p>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {cierre.estado !== 'COBRADO' && cierre.estado !== 'ANULADO' && (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirRegistrarFactura(cierre)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                                  title="Registrar número de factura y fecha de envío a la ART"
                                >
                                  📄 {cierre.numeroFactura ? 'Editar Factura' : 'Reg. Factura'}
                                </button>
                              )}

                              {cierre.estado !== 'COBRADO' && cierre.estado !== 'ANULADO' && (
                                <button
                                  type="button"
                                  onClick={() => handleAbrirMarcarCobrado(cierre)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                  title="Marcar este período como cobrado por la ART"
                                >
                                  💰 Cobrado
                                </button>
                              )}

                              {cierre.estado !== 'COBRADO' && (
                                <button
                                  type="button"
                                  onClick={() => handleAnularCierre(cierre)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Anular Cierre y liberar viajes"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

              {/* CICLO DE FACTURACIÓN DE LA ART */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                    Ciclo de Cierre y Facturación de la ART
                  </span>
                </div>
                <p className="text-xs text-indigo-700">
                  Configurá la periodicidad con la que esta aseguradora exige el envío de la facturación y cierre de cuenta.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Frecuencia de Cierre *
                    </label>
                    <select
                      value={formData.periodoFacturacion || 'MENSUAL'}
                      onChange={(e) => setFormData({ ...formData, periodoFacturacion: e.target.value as any })}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="SEMANAL">Semanal (Cierre cada 7 días)</option>
                      <option value="QUINCENAL">Quincenal (Día 1 al 15 y 16 a fin de mes)</option>
                      <option value="MENSUAL">Mensual (Mes calendario completo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Día de Corte / Vencimiento
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.diaCorteFacturacion ?? 1}
                      onChange={(e) => setFormData({ ...formData, diaCorteFacturacion: parseInt(e.target.value) || 1 })}
                      placeholder="Ej: 1 o 15"
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Día del mes o semana en que se genera la liquidación
                    </span>
                  </div>
                </div>
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

      {/* ============================================================== */}
      {/* MODAL 1: REASIGNAR CHOFER ANTES DE SALIR (Punto 1)            */}
      {/* ============================================================== */}
      {isModalReasignarOpen && viajeParaReasignar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reasignar Chofer (Antes de Salir)</h3>
                  <p className="text-xs text-slate-500">Avería o indisponibilidad previa a la salida</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalReasignarOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ficha Resumen del Viaje */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Pasajero / Paciente:</span>
                <span className="font-semibold text-slate-800">{viajeParaReasignar.clienteNombre || viajeParaReasignar.nombrePasajero || 'Sin especificar'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ART:</span>
                <span className="font-semibold text-primary-700">{viajeParaReasignar.artEmpresa?.nombre || 'ART'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trayecto:</span>
                <span className="font-medium text-slate-700 truncate max-w-[260px]">{viajeParaReasignar.origen} &rarr; {viajeParaReasignar.destino}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chofer asignado actual:</span>
                <span className="font-semibold text-amber-800">
                  {viajeParaReasignar.chofer ? `${viajeParaReasignar.chofer.nombre} ${viajeParaReasignar.chofer.apellido}` : 'Sin chofer'}
                </span>
              </div>
            </div>

            <form onSubmit={handleGuardarReasignar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nuevo Chofer a Asignar <span className="text-red-500">*</span>
                </label>
                <select
                  value={nuevoChoferId}
                  onChange={(e) => setNuevoChoferId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">-- Seleccionar chofer disponible --</option>
                  {choferesList
                    .filter((c: any) => c.id !== viajeParaReasignar.choferId)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.apellido} ({c.autoModelo || 'Vehículo'} {c.autoPatente ? `- ${c.autoPatente}` : ''})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo de la reasignación
                </label>
                <input
                  type="text"
                  value={motivoReasignacion}
                  onChange={(e) => setMotivoReasignacion(e.target.value)}
                  placeholder="Ej: Vehículo averiado, pinchadura de neumático, imprevisto..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  El chofer anterior será desvinculado de este viaje y el nuevo chofer recibirá la notificación inmediata en su celular para iniciar el recorrido.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalReasignarOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingReasignacion || !nuevoChoferId}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {savingReasignacion ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Reasignando...
                    </>
                  ) : (
                    'Confirmar Reasignación'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: AUXILIO MECÁNICO / TRASBORDO EN VIAJE (Punto 2)       */}
      {/* ============================================================== */}
      {isModalAuxilioOpen && viajeParaAuxilio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Auxilio Mecánico en Viaje</h3>
                  <p className="text-xs text-slate-500">Enviar móvil de relevo y registrar trasbordo</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalAuxilioOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ficha Resumen del Viaje */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Paciente a bordo:</span>
                <span className="font-semibold text-slate-800">{viajeParaAuxilio.clienteNombre || viajeParaAuxilio.nombrePasajero}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chofer averiado:</span>
                <span className="font-semibold text-red-700">
                  {viajeParaAuxilio.chofer ? `${viajeParaAuxilio.chofer.nombre} ${viajeParaAuxilio.chofer.apellido}` : 'Sin chofer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trayecto planificado:</span>
                <span className="font-medium text-slate-700 truncate max-w-[260px]">{viajeParaAuxilio.origen} &rarr; {viajeParaAuxilio.destino}</span>
              </div>
            </div>

            <form onSubmit={handleGuardarAuxilio} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Móvil / Chofer que acude al auxilio <span className="text-red-500">*</span>
                </label>
                <select
                  value={choferAuxilioId}
                  onChange={(e) => setChoferAuxilioId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">-- Seleccionar chofer de relevo --</option>
                  {choferesList
                    .filter((c: any) => c.id !== viajeParaAuxilio.choferId)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.apellido} ({c.autoModelo || 'Vehículo'} {c.autoPatente ? `- ${c.autoPatente}` : ''})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Punto de encuentro / Trasbordo
                </label>
                <input
                  type="text"
                  value={puntoTrasbordo}
                  onChange={(e) => setPuntoTrasbordo(e.target.value)}
                  placeholder="Ej: Autopista La Plata Km 24 / Estación YPF Mitre y Av. Belgrano"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Km recorridos por el 1° chofer antes de la falla (aprox.)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={kmChoferInicial}
                  onChange={(e) => setKmChoferInicial(e.target.value)}
                  placeholder="Ej: 14.2"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Sirve para liquidar los kilómetros proporcionales a cada móvil según el tramo realizado.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalAuxilioOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAuxilio || !choferAuxilioId}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {savingAuxilio ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Activando Auxilio...
                    </>
                  ) : (
                    'Confirmar Trasbordo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: MODIFICAR / ANULAR SINIESTRO (Punto 3)                */}
      {/* ============================================================== */}
      {isModalSiniestroOpen && viajeParaSiniestro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tipoAccionSiniestro === 'MODIFICAR' ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-600'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {tipoAccionSiniestro === 'MODIFICAR' ? 'Corregir N° de Siniestro' : 'Anular Siniestro / Emiten Nuevo'}
                  </h3>
                  <p className="text-xs text-slate-500">Gestión de inconsistencias enviadas por la ART</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalSiniestroOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de modo: Modificar vs Anular */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setTipoAccionSiniestro('MODIFICAR')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  tipoAccionSiniestro === 'MODIFICAR'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Corregir Tipeo
              </button>
              <button
                type="button"
                onClick={() => setTipoAccionSiniestro('ANULAR')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  tipoAccionSiniestro === 'ANULAR'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Anular Siniestro
              </button>
            </div>

            {/* Ficha Resumen */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Siniestro actual:</span>
                <span className="font-bold text-slate-900 font-mono">{viajeParaSiniestro.numeroSiniestro || 'Sin registrar'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ART:</span>
                <span className="font-semibold text-primary-700">{viajeParaSiniestro.artEmpresa?.nombre || 'ART'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paciente:</span>
                <span className="font-semibold text-slate-800">{viajeParaSiniestro.clienteNombre || viajeParaSiniestro.nombrePasajero}</span>
              </div>
            </div>

            <form onSubmit={handleGuardarSiniestro} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {tipoAccionSiniestro === 'MODIFICAR' ? 'Nuevo Número de Siniestro *' : 'Nuevo Siniestro emitido de reemplazo (opcional)'}
                </label>
                <input
                  type="text"
                  value={nuevoNumeroSiniestro}
                  onChange={(e) => setNuevoNumeroSiniestro(e.target.value)}
                  placeholder="Ej: ART-2025-88421"
                  required={tipoAccionSiniestro === 'MODIFICAR'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo o justificación de la ART
                </label>
                <input
                  type="text"
                  value={motivoSiniestro}
                  onChange={(e) => setMotivoSiniestro(e.target.value)}
                  placeholder={tipoAccionSiniestro === 'MODIFICAR' ? "Ej: Error de tipeo en dígito verificador" : "Ej: Anulado por ART por cambio de prestador o error de emisión"}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalSiniestroOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSiniestro}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm ${
                    tipoAccionSiniestro === 'MODIFICAR' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {savingSiniestro ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    tipoAccionSiniestro === 'MODIFICAR' ? 'Guardar Corrección' : 'Anular Siniestro'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: COORDINACIÓN CON PASAJERO (Punto 4)                   */}
      {/* ============================================================== */}
      {isModalCoordinacionOpen && viajeParaCoordinacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Coordinación con el Pasajero</h3>
                  <p className="text-xs text-slate-500">Llamada previa de confirmación o rechazo del paciente</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalCoordinacionOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ficha Resumen */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Paciente:</span>
                <span className="font-semibold text-slate-800">{viajeParaCoordinacion.clienteNombre || viajeParaCoordinacion.nombrePasajero}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Teléfono:</span>
                <span className="font-mono font-semibold text-primary-700">{viajeParaCoordinacion.telefonoPasajero || viajeParaCoordinacion.telefonoCliente || 'No registrado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recorrido:</span>
                <span className="font-medium text-slate-700 truncate max-w-[260px]">{viajeParaCoordinacion.origen} &rarr; {viajeParaCoordinacion.destino}</span>
              </div>
            </div>

            <form onSubmit={handleGuardarCoordinacion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resultado del Contacto <span className="text-red-500">*</span>
                </label>
                <select
                  value={estadoCoordinacionSeleccionado}
                  onChange={(e) => setEstadoCoordinacionSeleccionado(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="PENDIENTE_CONTACTO">🟡 Pendiente de contacto (Aún no se llamó)</option>
                  <option value="CONFIRMADO">🟢 Confirmado (El paciente acepta y espera el móvil)</option>
                  <option value="NO_RESPONDE">🟠 No responde al llamado telefónico</option>
                  <option value="RECHAZADO_POR_PACIENTE">🔴 Rechazado por el paciente (No quiere viajar)</option>
                </select>
              </div>

              {estadoCoordinacionSeleccionado === 'RECHAZADO_POR_PACIENTE' && (
                <div className="space-y-2 p-3 bg-red-50 rounded-xl border border-red-200 animate-in fade-in duration-200">
                  <label className="block text-xs font-semibold text-red-800">
                    Motivo por el cual no desea viajar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={motivoRechazoPaciente}
                    onChange={(e) => setMotivoRechazoPaciente(e.target.value)}
                    placeholder="Ej: Fue por sus propios medios / Se siente indispuesto / Canceló turno médico"
                    className="w-full px-3 py-2 bg-white border border-red-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-red-400"
                    required
                  />
                  <p className="text-[11px] text-red-700 leading-tight">
                    El viaje pasará a estado <strong>CANCELADO</strong> con causa justificada para que la remisería pueda facturar el intento si corresponde según el convenio con la ART.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones / Notas de la llamada
                </label>
                <textarea
                  value={observacionesCoordinacion}
                  onChange={(e) => setObservacionesCoordinacion(e.target.value)}
                  rows={2}
                  placeholder="Detalles hablados con el paciente o familiar..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalCoordinacionOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCoordinacion}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {savingCoordinacion ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Coordinación'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: PEAJES DEL VIAJE (Punto 6)                            */}
      {/* ============================================================== */}
      {isModalPeajesOpen && viajeParaPeajes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Peajes Pagados por Chofer</h3>
                  <p className="text-xs text-slate-500">Reembolso al móvil y cargo a la ART</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalPeajesOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ficha Resumen */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Chofer:</span>
                <span className="font-semibold text-slate-800">
                  {viajeParaPeajes.chofer ? `${viajeParaPeajes.chofer.nombre} ${viajeParaPeajes.chofer.apellido}` : 'Sin chofer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paciente:</span>
                <span className="font-semibold text-slate-800">{viajeParaPeajes.clienteNombre || viajeParaPeajes.nombrePasajero}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ART:</span>
                <span className="font-semibold text-primary-700">{viajeParaPeajes.artEmpresa?.nombre || 'ART'}</span>
              </div>
            </div>

            <form onSubmit={handleGuardarPeajes} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monto Total de Peajes ($) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={montoPeajesInput}
                    onChange={(e) => setMontoPeajesInput(e.target.value)}
                    placeholder="0"
                    required
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detalle de cabinas / Comprobante
                </label>
                <input
                  type="text"
                  value={observacionesPeajeInput}
                  onChange={(e) => setObservacionesPeajeInput(e.target.value)}
                  placeholder="Ej: Peaje Dock Sud + Hudson ida y vuelta"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Este importe se sumará automáticamente a la <strong>liquidación a pagar al chofer</strong> y a la <strong>facturación final remitida a la ART</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalPeajesOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPeajes}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {savingPeajes ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Peajes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 6: GENERAR CIERRE DE FACTURACIÓN (Punto 7)               */}
      {/* ============================================================== */}
      {isModalGenerarCierreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Generar Cierre de Facturación</h3>
                  <p className="text-xs text-slate-500">Consolidar viajes del periodo para facturar a la ART</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalGenerarCierreOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerarCierre} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ART / Empresa Aseguradora <span className="text-red-500">*</span>
                </label>
                <select
                  value={artCierreId}
                  onChange={(e) => setArtCierreId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
                  required
                >
                  <option value="">-- Seleccionar ART --</option>
                  {artList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} (Corte: {a.periodoFacturacion || 'MENSUAL'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha Desde <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={fechaDesdeCierre}
                    onChange={(e) => setFechaDesdeCierre(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha Hasta <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={fechaHastaCierre}
                    onChange={(e) => setFechaHastaCierre(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones internas del periodo
                </label>
                <textarea
                  value={observacionesCierre}
                  onChange={(e) => setObservacionesCierre(e.target.value)}
                  rows={2}
                  placeholder="Ej: Cierre 1ra quincena de mes. Se incluyen viajes de traslado con peajes..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                />
              </div>

              <div className="p-3 bg-primary-50 rounded-xl border border-primary-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-primary-800 leading-relaxed">
                  El sistema calculará automáticamente el monto facturado a la ART, las liquidaciones a los choferes y los peajes, generando el registro oficial de cierre pendiente de cobro.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalGenerarCierreOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingGenerarCierre || !artCierreId || !fechaDesdeCierre || !fechaHastaCierre}
                  className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {savingGenerarCierre ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Generando Cierre...
                    </>
                  ) : (
                    'Generar Cierre Ahora'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 7: REGISTRAR FACTURA EMITIDA (Punto 7)                   */}
      {/* ============================================================== */}
      {isModalRegistrarFacturaOpen && cierreParaFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Registrar Factura Emitida</h3>
                  <p className="text-xs text-slate-500">Control de envío y vencimiento con la ART</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalRegistrarFacturaOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ficha Resumen Cierre */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Cierre:</span>
                <span className="font-bold text-slate-900 font-mono">#{cierreParaFactura.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ART:</span>
                <span className="font-semibold text-primary-700">{cierreParaFactura.artEmpresa?.nombre || 'ART'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total a Facturar:</span>
                <span className="font-bold text-emerald-700 text-sm">
                  ${Number(cierreParaFactura.totalFacturadoArt || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cantidad de Viajes:</span>
                <span className="font-semibold text-slate-800">{cierreParaFactura.totalViajes} servicios</span>
              </div>
            </div>

            <form onSubmit={handleGuardarFacturaCierre} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número de Factura Emitida <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={numeroFacturaInput}
                  onChange={(e) => setNumeroFacturaInput(e.target.value)}
                  placeholder="Ej: A-0001-00045231 o FACT-88192"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha de Emisión
                  </label>
                  <input
                    type="date"
                    value={fechaEmisionInput}
                    onChange={(e) => setFechaEmisionInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha de Envío a la ART
                  </label>
                  <input
                    type="date"
                    value={fechaEnvioFacturaInput}
                    onChange={(e) => setFechaEnvioFacturaInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones / Notas de facturación
                </label>
                <textarea
                  value={observacionesFacturaInput}
                  onChange={(e) => setObservacionesFacturaInput(e.target.value)}
                  rows={2}
                  placeholder="Ej: Enviada por portal de proveedores / Enviada a facturacion@art.com..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalRegistrarFacturaOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingFactura || !numeroFacturaInput.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {savingFactura ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    'Agendar y Guardar Factura'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 8: REGISTRAR COBRO DEL CIERRE (Punto 7)                  */}
      {/* ============================================================== */}
      {isModalMarcarCobradoOpen && cierreParaCobrado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Registrar Cobranza de la ART</h3>
                  <p className="text-xs text-slate-500">Marcar cierre como cobrado e ingresar datos bancarios</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalMarcarCobradoOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ficha Resumen Cierre */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Factura / Cierre:</span>
                <span className="font-bold text-slate-900 font-mono">{cierreParaCobrado.numeroFactura || '#' + cierreParaCobrado.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ART:</span>
                <span className="font-semibold text-primary-700">{cierreParaCobrado.artEmpresa?.nombre || 'ART'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto Cobrado:</span>
                <span className="font-bold text-emerald-700 text-sm">
                  ${Number(cierreParaCobrado.totalFacturadoArt || 0).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            <form onSubmit={handleGuardarCobroCierre} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha de Cobro / Acreditación <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={fechaCobroInput}
                    onChange={(e) => setFechaCobroInput(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Método de Pago <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={metodoCobroInput}
                    onChange={(e) => setMetodoCobroInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white"
                  >
                    <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                    <option value="ECHEQ">E-Cheq</option>
                    <option value="CHEQUE">Cheque Físico</option>
                    <option value="DEBITO_AUTOMATICO">Débito Automático</option>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="OTRO">Otro Medio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  N° Comprobante / Orden de Pago (OP)
                </label>
                <input
                  type="text"
                  value={comprobanteCobroInput}
                  onChange={(e) => setComprobanteCobroInput(e.target.value)}
                  placeholder="Ej: OP-992384 o Ref. Transferencia 10293847"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones de Cobro
                </label>
                <textarea
                  value={observacionesCobroInput}
                  onChange={(e) => setObservacionesCobroInput(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre retenciones impositivas, cuenta de acreditación, etc."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalMarcarCobradoOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCobro || !fechaCobroInput}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {savingCobro ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Registrando Cobro...
                    </>
                  ) : (
                    'Confirmar Cobro'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
