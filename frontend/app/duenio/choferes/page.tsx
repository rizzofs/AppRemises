'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { choferService, remiseriaService, vehiculoService } from '@/lib/api';
import { Chofer, CreateChoferData, Remiseria, Vehiculo } from '@/types';
import { Truck, Plus, Edit, Trash2, Eye, EyeOff, Search, Filter, ArrowLeft, User, Calendar, Phone, Mail, MapPin, FileText, CheckCircle, XCircle, Clock, ChevronRight, ChevronLeft, Check, Sparkles, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChoferesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<number>(1);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedChofer, setSelectedChofer] = useState<Chofer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<'all' | 'PENDIENTE_APROBACION' | 'ACTIVO' | 'SUSPENDIDO' | 'RECHAZADO' | 'DADO_DE_BAJA'>('all');

  // Estado para modal de Aprobación y Rechazo
  const [choferParaAprobar, setChoferParaAprobar] = useState<Chofer | null>(null);
  const [choferParaRechazar, setChoferParaRechazar] = useState<Chofer | null>(null);
  const [aprobarComision, setAprobarComision] = useState<number>(30);
  const [aprobarVehiculoId, setAprobarVehiculoId] = useState<string>('');
  const [motivoRechazoInput, setMotivoRechazoInput] = useState<string>('');
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  // Formulario de creación/edición
  const [formData, setFormData] = useState<CreateChoferData>({
    numeroChofer: '',
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    direccion: '',
    categoriaLicencia: '',
    vtoLicencia: '',
    remiseriaId: '',
    vehiculoId: '',
    esPropietario: false,
    comisionPorcentaje: 30
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadChoferes();
    loadRemiserias();
    loadVehiculos();
  }, [user]);

  const loadChoferes = async () => {
    try {
      setLoading(true);
      const response = await choferService.getAll();
      if (response.success) {
        setChoferes(response.data || []);
      } else {
        toast.error('Error al cargar choferes');
      }
    } catch (error) {
      console.error('Error loading choferes:', error);
      toast.error('Error al cargar choferes');
    } finally {
      setLoading(false);
    }
  };

  const loadRemiserias = async () => {
    try {
      const response = await remiseriaService.getAll();
      if (response.success) {
        setRemiserias(response.data || []);
      } else {
        toast.error('Error al cargar remiserías');
      }
    } catch (error) {
      console.error('Error loading remiserias:', error);
      toast.error('Error al cargar remiserías');
    }
  };

  const loadVehiculos = async () => {
    try {
      const response = await vehiculoService.getAll();
      if (response.success) {
        setVehiculos(response.data || []);
      } else {
        toast.error('Error al cargar vehículos');
      }
    } catch (error) {
      console.error('Error loading vehiculos:', error);
      toast.error('Error al cargar vehículos');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await choferService.create(formData);
      if (response.success) {
        toast.success('Chofer creado exitosamente');
        setShowCreateModal(false);
        setFormData({
          numeroChofer: '',
          nombre: '',
          apellido: '',
          dni: '',
          telefono: '',
          email: '',
          direccion: '',
          categoriaLicencia: '',
          vtoLicencia: '',
          remiseriaId: '',
          vehiculoId: '',
          esPropietario: false
        });
        loadChoferes();
      } else {
        toast.error(response.message || 'Error al crear chofer');
      }
    } catch (error) {
      console.error('Error creating chofer:', error);
      toast.error('Error al crear chofer');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChofer) return;

    try {
      const updateData = {
        numeroChofer: formData.numeroChofer,
        nombre: formData.nombre,
        apellido: formData.apellido,
        dni: formData.dni,
        telefono: formData.telefono,
        email: formData.email,
        direccion: formData.direccion,
        categoriaLicencia: formData.categoriaLicencia,
        vtoLicencia: formData.vtoLicencia,
        vehiculoId: formData.vehiculoId,
        esPropietario: formData.esPropietario,
        comisionPorcentaje: formData.comisionPorcentaje
      };

      const response = await choferService.update(selectedChofer.id, updateData);
      if (response.success) {
        toast.success('Chofer actualizado exitosamente');
        setShowEditModal(false);
        setSelectedChofer(null);
        setFormData({
          numeroChofer: '',
          nombre: '',
          apellido: '',
          dni: '',
          telefono: '',
          email: '',
          direccion: '',
          categoriaLicencia: '',
          vtoLicencia: '',
          remiseriaId: '',
          vehiculoId: '',
          esPropietario: false
        });
        loadChoferes();
      } else {
        toast.error(response.message || 'Error al actualizar chofer');
      }
    } catch (error) {
      console.error('Error updating chofer:', error);
      toast.error('Error al actualizar chofer');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este chofer?')) return;

    try {
      const response = await choferService.delete(id);
      if (response.success) {
        toast.success('Chofer eliminado exitosamente');
        loadChoferes();
      } else {
        toast.error(response.message || 'Error al eliminar chofer');
      }
    } catch (error) {
      console.error('Error deleting chofer:', error);
      toast.error('Error al eliminar chofer');
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const response = await choferService.toggleStatus(id);
      if (response.success) {
        toast.success(response.message || 'Estado cambiado exitosamente');
        loadChoferes();
      } else {
        toast.error(response.message || 'Error al cambiar estado');
      }
    } catch (error) {
      console.error('Error toggling chofer status:', error);
      toast.error('Error al cambiar estado');
    }
  };

  const openEditModal = (chofer: Chofer) => {
    setSelectedChofer(chofer);
    setFormData({
      numeroChofer: chofer.numeroChofer,
      nombre: chofer.nombre,
      apellido: chofer.apellido,
      dni: chofer.dni,
      telefono: chofer.telefono,
      email: chofer.email || '',
      direccion: chofer.direccion || '',
      categoriaLicencia: chofer.categoriaLicencia,
      vtoLicencia: chofer.vtoLicencia.split('T')[0], // format date for input type=date
      remiseriaId: chofer.remiseriaId,
      vehiculoId: chofer.vehiculoId || '',
      esPropietario: chofer.esPropietario || false,
      comisionPorcentaje: chofer.comisionPorcentaje !== undefined ? chofer.comisionPorcentaje : 30
    });
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    const nextNum = (choferes.length + 1).toString().padStart(3, '0');
    setFormData({
      numeroChofer: `CH${nextNum}`,
      nombre: '',
      apellido: '',
      dni: '',
      telefono: '',
      email: '',
      direccion: '',
      categoriaLicencia: 'D1',
      vtoLicencia: '',
      remiseriaId: remiserias[0]?.id || '',
      vehiculoId: '',
      esPropietario: false,
      comisionPorcentaje: 30
    });
    setCreateStep(1);
    setShowCreateModal(true);
  };

  const handleNextStep = () => {
    if (createStep === 1) {
      if (!formData.nombre?.trim() || !formData.apellido?.trim() || !formData.dni?.trim() || !formData.numeroChofer?.trim() || !formData.telefono?.trim()) {
        toast.error('Completá nombre, apellido, DNI, número de chofer y teléfono');
        return;
      }
    } else if (createStep === 2) {
      if (!formData.categoriaLicencia?.trim() || !formData.vtoLicencia?.trim()) {
        toast.error('Completá la categoría y el vencimiento de la licencia');
        return;
      }
    }
    setCreateStep(prev => Math.min(prev + 1, 4));
  };

  const handlePrevStep = () => {
    setCreateStep(prev => Math.max(prev - 1, 1));
  };

  // Filtrar choferes
  const filteredChoferes = choferes.filter(chofer => {
    const matchesSearch = 
      chofer.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chofer.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chofer.numeroChofer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chofer.dni.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterEstado === 'all' || chofer.estado === filterEstado;
    
    return matchesSearch && matchesFilter;
  });

  const handleAprobarChofer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choferParaAprobar) return;
    setActionSubmitting(true);
    try {
      const res = await choferService.aprobar(choferParaAprobar.id, {
        comisionPorcentaje: Number(aprobarComision),
        vehiculoId: aprobarVehiculoId || undefined,
      });
      if (res.success) {
        toast.success(res.message || 'Chofer aprobado exitosamente');
        setChoferParaAprobar(null);
        await loadChoferes();
      } else {
        toast.error(res.message || 'Error al aprobar chofer');
      }
    } catch {
      toast.error('Error al aprobar chofer');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleRechazarChofer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choferParaRechazar) return;
    setActionSubmitting(true);
    try {
      const res = await choferService.rechazar(choferParaRechazar.id, motivoRechazoInput);
      if (res.success) {
        toast.success('Solicitud rechazada');
        setChoferParaRechazar(null);
        setMotivoRechazoInput('');
        await loadChoferes();
      } else {
        toast.error(res.message || 'Error al rechazar chofer');
      }
    } catch {
      toast.error('Error al rechazar chofer');
    } finally {
      setActionSubmitting(false);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'ACTIVO':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDIENTE_APROBACION':
        return 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-300';
      case 'SUSPENDIDO':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'RECHAZADO':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'DADO_DE_BAJA':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEstadoText = (estado: string) => {
    switch (estado) {
      case 'ACTIVO':
        return 'Activo';
      case 'PENDIENTE_APROBACION':
        return '⏳ Pendiente Aprobación';
      case 'SUSPENDIDO':
        return 'Suspendido';
      case 'RECHAZADO':
        return 'Rechazado';
      case 'DADO_DE_BAJA':
        return 'Dado de Baja';
      default:
        return estado;
    }
  };

  if (!user) return null;

  const solicitudesPendientes = choferes.filter((c) => c.estado === 'PENDIENTE_APROBACION');

  return (
    <div className="space-y-6">
      {/* Alerta de Choferes Pendientes de Aprobación */}
      {solicitudesPendientes.length > 0 && filterEstado !== 'PENDIENTE_APROBACION' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-xs">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-sm">
                {solicitudesPendientes.length === 1
                  ? 'Tienes 1 nueva solicitud de chofer pendiente'
                  : `Tienes ${solicitudesPendientes.length} nuevas solicitudes de choferes pendientes`}
              </p>
              <p className="text-xs text-amber-700">
                Choferes que completaron su registro con documentación y esperan tu aprobación para operar.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterEstado('PENDIENTE_APROBACION')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
          >
            Ver Pendientes ({solicitudesPendientes.length})
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Choferes</h2>
          <p className="text-sm text-slate-500">Gestioná las postulaciones y choferes de tus remiserías.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn btn-primary shadow-md shadow-primary-500/20"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Chofer (Manual)
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido o DNI..."
              className="input pl-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as any)}
            className="input max-w-[220px] bg-white cursor-pointer font-medium text-xs"
          >
            <option value="all">Todos los estados</option>
            <option value="PENDIENTE_APROBACION">⏳ Pendientes de Aprobación</option>
            <option value="ACTIVO">Activos</option>
            <option value="SUSPENDIDO">Suspendidos</option>
            <option value="RECHAZADO">Rechazados</option>
            <option value="DADO_DE_BAJA">Dados de Baja</option>
          </select>
        </div>

        {/* Lista de choferes */}
        {loading ? (
          <div className="text-center py-16">
            <div className="loading-spinner border-primary-500 mx-auto"></div>
            <p className="mt-4 text-slate-500">Cargando choferes...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {filteredChoferes.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Truck className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || filterEstado !== 'all' ? 'No se encontraron choferes' : 'No hay choferes'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm || filterEstado !== 'all' 
                    ? 'Intenta ajustar los filtros de búsqueda' 
                    : 'Comienza creando tu primer chofer'}
                </p>
              </div>
            ) : (
              <>
                {/* VISTA MÓVIL (CARDS TÁCTILES) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {filteredChoferes.map((chofer) => (
                    <div key={chofer.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-primary-100 text-primary-700 font-bold text-base flex items-center justify-center shrink-0 shadow-xs">
                            {chofer.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-base leading-tight truncate">
                              {chofer.nombre} {chofer.apellido}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              #{chofer.numeroChofer} • DNI: {chofer.dni}
                            </p>
                          </div>
                        </div>
                        <span className={`inline-flex px-2.5 py-1 text-[11px] font-semibold rounded-full border shrink-0 ${getEstadoColor(chofer.estado)}`}>
                          {getEstadoText(chofer.estado)}
                        </span>
                      </div>

                      {/* Datos de contacto y auto */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">Contacto</span>
                          <a href={`tel:${chofer.telefono}`} className="font-semibold text-primary-600 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {chofer.telefono}
                          </a>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">Vehículo Asignado</span>
                          <span className="font-semibold text-slate-800 block mt-0.5 truncate">
                            {chofer.vehiculo ? `${chofer.vehiculo.patente} (${chofer.vehiculo.modelo})` : 'Sin asignar'}
                          </span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200/50 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-medium">
                            Modalidad
                          </span>
                          {chofer.esPropietario ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">
                              Auto Propio (80%)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 shrink-0" title={chofer.vehiculo?.propietario ? `Titular del coche: ${chofer.vehiculo.propietario}` : undefined}>
                              Auto Agencia ({chofer.comisionPorcentaje || 30}%)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botones de acción táctiles */}
                      <div className="pt-1">
                        {chofer.estado === 'PENDIENTE_APROBACION' ? (
                          <div className="grid grid-cols-2 gap-2 w-full">
                            <button
                              onClick={() => {
                                setChoferParaAprobar(chofer);
                                setAprobarComision(chofer.comisionPorcentaje || 30);
                                setAprobarVehiculoId(chofer.vehiculoId || '');
                              }}
                              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Aprobar
                            </button>
                            <button
                              onClick={() => {
                                setChoferParaRechazar(chofer);
                                setMotivoRechazoInput('');
                              }}
                              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold active:scale-95 transition-all"
                            >
                              <XCircle className="w-4 h-4" />
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 w-full">
                            <button
                              onClick={() => openEditModal(chofer)}
                              className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all active:scale-95"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleToggleStatus(chofer.id)}
                              className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all active:scale-95"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Estado
                            </button>
                            <button
                              onClick={() => handleDelete(chofer.id)}
                              className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-all active:scale-95"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Borrar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* VISTA ESCRITORIO (TABLA) */}
                <div className="hidden md:block">
                  <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Chofer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contacto</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehículo Asignado</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredChoferes.map((chofer) => (
                    <tr key={chofer.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                            {chofer.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {chofer.nombre} {chofer.apellido}
                            </div>
                            <div className="text-xs text-slate-500">
                              #{chofer.numeroChofer} • DNI: {chofer.dni}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {chofer.telefono}
                          </div>
                          {chofer.email && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {chofer.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          {chofer.esPropietario ? (
                            <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Auto Propio (80%)
                            </span>
                          ) : (
                            <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200" title={chofer.vehiculo?.propietario ? `Titular del coche: ${chofer.vehiculo.propietario}` : undefined}>
                              Auto Agencia ({chofer.comisionPorcentaje || 30}%)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          {chofer.vehiculo ? (
                            <div>
                              <div className="font-semibold">{chofer.vehiculo.patente}</div>
                              <div className="text-slate-500 text-xs">
                                {chofer.vehiculo.marca} {chofer.vehiculo.modelo}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Sin asignar</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${getEstadoColor(chofer.estado)}`}>
                          {getEstadoText(chofer.estado)}
                        </span>
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {chofer.estado === 'PENDIENTE_APROBACION' ? (
                            <div className="flex justify-end items-center space-x-2">
                              <button
                                onClick={() => {
                                  setChoferParaAprobar(chofer);
                                  setAprobarComision(chofer.comisionPorcentaje || 30);
                                  setAprobarVehiculoId(chofer.vehiculoId || '');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                                title="Aprobar Solicitud"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Aprobar
                              </button>
                              <button
                                onClick={() => {
                                  setChoferParaRechazar(chofer);
                                  setMotivoRechazoInput('');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                                title="Rechazar Solicitud"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Rechazar
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleToggleStatus(chofer.id)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Cambiar estado"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditModal(chofer)}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(chofer.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </div>
        )}
      </div>

      {/* Modal de Creación por Pasos (Wizard Stepper) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs overflow-y-auto h-full w-full z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header del Modal */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">
                    Paso {createStep} de 4
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {createStep === 1 && '• Identificación'}
                    {createStep === 2 && '• Documentación'}
                    {createStep === 3 && '• Modalidad y Auto'}
                    {createStep === 4 && '• Confirmación'}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">Alta de Chofer</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Stepper visual interactivo */}
            <div className="px-5 sm:px-6 pt-3 pb-2 bg-slate-50/70 border-b border-slate-100">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { step: 1, label: 'Personal', icon: User },
                  { step: 2, label: 'Licencia', icon: FileText },
                  { step: 3, label: 'Modalidad', icon: Truck },
                  { step: 4, label: 'Resumen', icon: CheckCircle }
                ].map((s) => {
                  const Icon = s.icon;
                  const isCompleted = createStep > s.step;
                  const isCurrent = createStep === s.step;
                  return (
                    <div
                      key={s.step}
                      className={`flex flex-col items-center text-center pb-1 border-b-2 transition-all ${
                        isCurrent
                          ? 'border-primary-600 text-primary-600 font-bold'
                          : isCompleted
                          ? 'border-emerald-500 text-emerald-600 font-semibold'
                          : 'border-transparent text-slate-400 font-medium'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs mb-1 transition-all ${
                          isCurrent
                            ? 'bg-primary-600 text-white shadow-xs'
                            : isCompleted
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.step}
                      </div>
                      <span className="text-[10px] hidden sm:inline">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cuerpo del Formulario según Paso Activo */}
            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              
              {/* PASO 1: DATOS PERSONALES */}
              {createStep === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        N° de Chofer *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.numeroChofer}
                        onChange={(e) => setFormData({ ...formData, numeroChofer: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold uppercase focus:ring-2 focus:ring-primary-500"
                        placeholder="ej. CH001"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        DNI *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.dni}
                        onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
                        placeholder="Sin puntos"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm uppercase focus:ring-2 focus:ring-primary-500"
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Apellido *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.apellido}
                        onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm uppercase focus:ring-2 focus:ring-primary-500"
                        placeholder="Apellido"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="ej. 11 1234-5678"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Email (opcional)
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
                        placeholder="chofer@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Domicilio (opcional)
                      </label>
                      <input
                        type="text"
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm uppercase focus:ring-2 focus:ring-primary-500"
                        placeholder="Calle y N°"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 2: LICENCIA Y HABILITACIÓN */}
              {createStep === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
                    <p className="text-xs text-blue-800">
                      Verificá que la licencia profesional esté vigente antes de habilitar los viajes del chofer.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Categoría de Licencia *
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {['D1', 'D2', 'B1', 'B2'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormData({ ...formData, categoriaLicencia: cat })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            formData.categoriaLicencia === cat
                              ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Cat. {cat}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.categoriaLicencia}
                      onChange={(e) => setFormData({ ...formData, categoriaLicencia: e.target.value.toUpperCase() })}
                      placeholder="O ingresá otra categoría (ej. D1)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm uppercase font-semibold focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Fecha de Vencimiento de la Licencia *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.vtoLicencia}
                      onChange={(e) => setFormData({ ...formData, vtoLicencia: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              {/* PASO 3: MODALIDAD Y VEHÍCULO ASIGNADO */}
              {createStep === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Categoría del Chofer y Comisión
                    </label>
                    <div className="space-y-2.5">
                      <div
                        onClick={() => setFormData({ ...formData, esPropietario: false, comisionPorcentaje: 30 })}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                          formData.esPropietario === false
                            ? 'bg-blue-50/50 border-blue-600 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🚗</span>
                            <div>
                              <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                                Chofer con Vehículo de la Remisería
                              </span>
                              <span className="text-[11px] text-slate-500 block mt-0.5">
                                Conduce un coche asignado (de la remisería o de una persona externa).
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-black shrink-0">
                            Auto Agencia (30%)
                          </span>
                        </div>
                      </div>

                      <div
                        onClick={() => setFormData({ ...formData, esPropietario: true, comisionPorcentaje: 80 })}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                          formData.esPropietario === true
                            ? 'bg-emerald-50/50 border-emerald-600 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">👤</span>
                            <div>
                              <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                                Chofer Propietario (Auto Propio)
                              </span>
                              <span className="text-[11px] text-slate-500 block mt-0.5">
                                Es dueño de su vehículo. Paga el 20% a la remisería y retiene el 80%.
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black shrink-0">
                            Auto Propio (80%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Vehículo Asignado (opcional)
                    </label>
                    <select
                      value={formData.vehiculoId}
                      onChange={(e) => setFormData({ ...formData, vehiculoId: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Sin asignar por el momento</option>
                      {vehiculos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.patente} • {v.marca} {v.modelo} ({v.propietario === 'Agencia' ? '🏢 Agencia' : `🚗 Dueño: ${v.propietario}`})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Base Asignada:</span>
                    <strong className="text-slate-800 font-bold">{remiserias[0]?.nombreFantasia || 'Remises Bruno'}</strong>
                  </div>
                </div>
              )}

              {/* PASO 4: REVISIÓN Y CONFIRMACIÓN */}
              {createStep === 4 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Ficha del Chofer</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/20 text-white">
                        #{formData.numeroChofer}
                      </span>
                    </div>
                    <p className="text-lg font-black text-white">
                      {formData.nombre} {formData.apellido}
                    </p>
                    <p className="text-xs text-slate-300">
                      DNI: {formData.dni} • Cel: {formData.telefono}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Licencia</span>
                      <span className="font-bold text-slate-800 block mt-0.5">Cat. {formData.categoriaLicencia}</span>
                      <span className="text-[11px] text-slate-500">Vence: {formData.vtoLicencia}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Modalidad</span>
                      <span className="font-bold text-slate-800 block mt-0.5">
                        {formData.esPropietario ? 'Auto Propio (80%)' : 'Auto Agencia (30%)'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {formData.esPropietario ? 'Comisión base 20%' : 'Se lleva el 30% diario'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Vehículo Asignado</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">
                      {formData.vehiculoId
                        ? (() => {
                            const veh = vehiculos.find((v) => v.id === formData.vehiculoId);
                            return veh ? `${veh.patente} • ${veh.marca} ${veh.modelo} (Titular: ${veh.propietario})` : 'Vehículo seleccionado';
                          })()
                        : 'Sin auto asignado (se puede asignar luego)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Botones de Navegación del Modal */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                {createStep > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Atrás
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold transition-all"
                  >
                    Cancelar
                  </button>
                )}

                {createStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all ml-auto"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all ml-auto"
                  >
                    <Sparkles className="w-4 h-4" />
                    Confirmar y Crear Chofer
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      {showEditModal && selectedChofer && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Chofer</h3>
              <form onSubmit={handleEdit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Chofer
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.numeroChofer}
                      onChange={(e) => setFormData({ ...formData, numeroChofer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apellido
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.apellido}
                        onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DNI
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría de Licencia
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.categoriaLicencia}
                      onChange={(e) => setFormData({ ...formData, categoriaLicencia: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vencimiento de Licencia
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.vtoLicencia}
                      onChange={(e) => setFormData({ ...formData, vtoLicencia: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría del Chofer y Comisión
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      Comisión agencia: 20%. Choferes con auto asignado se llevan el 30% de recaudación diaria.
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-start p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                        <input
                          type="radio"
                          name="editEsPropietario"
                          checked={formData.esPropietario === false}
                          onChange={() => setFormData({ ...formData, esPropietario: false, comisionPorcentaje: 30 })}
                          className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <div className="ml-3">
                          <span className="text-xs font-bold text-gray-800 block">🚗 Chofer con Vehículo de la Remisería [Auto Agencia (30%)]</span>
                          <span className="text-[11px] text-slate-500">Conduce un coche asignado (de la remisería o de una persona externa). Se lleva el 30% de su recaudación.</span>
                        </div>
                      </label>
                      <label className="flex items-start p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                        <input
                          type="radio"
                          name="editEsPropietario"
                          checked={formData.esPropietario === true}
                          onChange={() => setFormData({ ...formData, esPropietario: true, comisionPorcentaje: 80 })}
                          className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                        />
                        <div className="ml-3">
                          <span className="text-xs font-bold text-gray-800 block">👤 Chofer Propietario [Auto Propio (80%)]</span>
                          <span className="text-[11px] text-slate-500">Paga el 20% a la remisería, retiene el 80% de su recaudación.</span>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vehículo Asignado
                    </label>
                    <select
                      value={formData.vehiculoId}
                      onChange={(e) => setFormData({ ...formData, vehiculoId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">Sin asignar</option>
                      {vehiculos.map(vehiculo => (
                        <option key={vehiculo.id} value={vehiculo.id}>
                          {vehiculo.patente} - {vehiculo.marca} {vehiculo.modelo} ({vehiculo.propietario === 'Agencia' ? '🏢 Agencia' : vehiculo.propietario === 'Chofer' ? '👤 Chofer' : `🚗 Dueño: ${vehiculo.propietario}`})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                  >
                    Actualizar Chofer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Aprobación de Chofer */}
      {choferParaAprobar && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative mx-auto p-6 border w-full max-w-lg shadow-xl rounded-2xl bg-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Aprobar Chofer</h3>
                  <p className="text-xs text-gray-500">
                    {choferParaAprobar.nombre} {choferParaAprobar.apellido} ({choferParaAprobar.numeroChofer})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChoferParaAprobar(null)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAprobarChofer} className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="text-slate-500"><span className="font-semibold text-slate-700">DNI:</span> {choferParaAprobar.dni}</div>
                <div className="text-slate-500"><span className="font-semibold text-slate-700">Teléfono:</span> {choferParaAprobar.telefono}</div>
                <div className="text-slate-500"><span className="font-semibold text-slate-700">Licencia:</span> {choferParaAprobar.categoriaLicencia} (Vence: {new Date(choferParaAprobar.vtoLicencia).toLocaleDateString()})</div>
                <div className="text-slate-500"><span className="font-semibold text-slate-700">Tipo:</span> {choferParaAprobar.esPropietario ? 'Propietario de auto propio' : 'Chofer de flota (Asignado)'}</div>
              </div>

              {!choferParaAprobar.esPropietario && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Comisión de Chofer Asignado (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      required
                      value={aprobarComision}
                      onChange={(e) => setAprobarComision(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 text-sm">
                      %
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Porcentaje que le corresponde al chofer por viaje.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Vehículo Asignado {choferParaAprobar.esPropietario ? '(Opcional o auto propio)' : '(Opcional, puede asignarse luego)'}
                </label>
                <select
                  value={aprobarVehiculoId}
                  onChange={(e) => setAprobarVehiculoId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                >
                  <option value="">Sin asignar por ahora</option>
                  {vehiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.patente} - {v.marca} {v.modelo} ({v.anio})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setChoferParaAprobar(null)}
                  disabled={actionSubmitting}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  {actionSubmitting ? 'Aprobando...' : 'Confirmar Aprobación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Rechazo de Chofer */}
      {choferParaRechazar && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative mx-auto p-6 border w-full max-w-md shadow-xl rounded-2xl bg-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Rechazar Solicitud</h3>
                  <p className="text-xs text-gray-500">
                    {choferParaRechazar.nombre} {choferParaRechazar.apellido}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChoferParaRechazar(null)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRechazarChofer} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Motivo del Rechazo (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={motivoRechazoInput}
                  onChange={(e) => setMotivoRechazoInput(e.target.value)}
                  placeholder="Ej: Licencia vencida, documentación ilegible, cupo completo..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">El chofer podrá ver este motivo al intentar ingresar a la aplicación.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setChoferParaRechazar(null)}
                  disabled={actionSubmitting}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  <XCircle className="w-4 h-4" />
                  {actionSubmitting ? 'Rechazando...' : 'Confirmar Rechazo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 