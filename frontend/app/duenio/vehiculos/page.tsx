'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { vehiculoService, remiseriaService } from '@/lib/api';
import { Vehiculo, CreateVehiculoData, UpdateVehiculoData, Remiseria } from '@/types';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  ArrowLeft,
  Truck,
  Calendar,
  FileText,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Car,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

export default function VehiculosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<number>(1);
  const [tipoPropietario, setTipoPropietario] = useState<'AGENCIA' | 'TERCERO' | 'CHOFER'>('AGENCIA');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingVehiculo, setEditingVehiculo] = useState<Vehiculo | null>(null);
  const [formData, setFormData] = useState<CreateVehiculoData>({
    patente: '',
    marca: '',
    modelo: '',
    anio: new Date().getFullYear(),
    color: '',
    tipo: '',
    capacidad: 4,
    propietario: '',
    vtoVtv: '',
    vtoMatafuego: '',
    vtoSeguro: '',
    observaciones: '',
    remiseriaId: ''
  });

  useEffect(() => {
    if (user?.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }
    loadVehiculos();
    loadRemiserias();
  }, [user, router]);

  const loadVehiculos = async () => {
    try {
      const response = await vehiculoService.getAll();
      if (response.success) {
        setVehiculos(response.data || []);
      }
    } catch (error) {
      toast.error('Error al cargar vehículos');
    } finally {
      setLoading(false);
    }
  };

  const loadRemiserias = async () => {
    try {
      const response = await remiseriaService.getAll();
      if (response.success) {
        setRemiserias(response.data || []);
      }
    } catch (error) {
      console.error('Error loading remiserias:', error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await vehiculoService.create(formData);
      if (response.success) {
        toast.success('Vehículo creado exitosamente');
        setShowCreateModal(false);
        resetForm();
        loadVehiculos();
      } else {
        toast.error(response.message || 'Error al crear vehículo');
      }
    } catch (error) {
      toast.error('Error al crear vehículo');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehiculo) return;

    try {
      const updateData: UpdateVehiculoData = {
        patente: formData.patente,
        marca: formData.marca,
        modelo: formData.modelo,
        anio: formData.anio,
        color: formData.color,
        tipo: formData.tipo,
        capacidad: formData.capacidad,
        propietario: formData.propietario,
        vtoVtv: formData.vtoVtv || undefined,
        vtoMatafuego: formData.vtoMatafuego || undefined,
        vtoSeguro: formData.vtoSeguro || undefined,
        observaciones: formData.observaciones || undefined,
        estado: editingVehiculo.estado
      };

      const response = await vehiculoService.update(editingVehiculo.id, updateData);
      if (response.success) {
        toast.success('Vehículo actualizado exitosamente');
        setShowEditModal(false);
        setEditingVehiculo(null);
        resetForm();
        loadVehiculos();
      } else {
        toast.error(response.message || 'Error al actualizar vehículo');
      }
    } catch (error) {
      toast.error('Error al actualizar vehículo');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este vehículo?')) return;

    try {
      const response = await vehiculoService.delete(id);
      if (response.success) {
        toast.success('Vehículo eliminado exitosamente');
        loadVehiculos();
      } else {
        toast.error(response.message || 'Error al eliminar vehículo');
      }
    } catch (error) {
      toast.error('Error al eliminar vehículo');
    }
  };

  const handleToggleStatus = async (vehiculo: Vehiculo) => {
    try {
      const newEstado = vehiculo.estado === 'ACTIVO' ? 'MANTENIMIENTO' : 
                       vehiculo.estado === 'MANTENIMIENTO' ? 'INACTIVO' : 'ACTIVO';
      
      const updateData: UpdateVehiculoData = {
        patente: vehiculo.patente,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        anio: vehiculo.anio,
        color: vehiculo.color,
        tipo: vehiculo.tipo,
        capacidad: vehiculo.capacidad,
        propietario: vehiculo.propietario,
        vtoVtv: vehiculo.vtoVtv || undefined,
        vtoMatafuego: vehiculo.vtoMatafuego || undefined,
        vtoSeguro: vehiculo.vtoSeguro || undefined,
        observaciones: vehiculo.observaciones || undefined,
        estado: newEstado
      };

      const response = await vehiculoService.update(vehiculo.id, updateData);
      if (response.success) {
        toast.success(`Vehículo ${newEstado.toLowerCase()}`);
        loadVehiculos();
      } else {
        toast.error(response.message || 'Error al cambiar estado');
      }
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  };

  const openEditModal = (vehiculo: Vehiculo) => {
    setEditingVehiculo(vehiculo);
    setFormData({
      patente: vehiculo.patente,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      anio: vehiculo.anio,
      color: vehiculo.color,
      tipo: vehiculo.tipo,
      capacidad: vehiculo.capacidad,
      propietario: vehiculo.propietario,
      vtoVtv: vehiculo.vtoVtv || '',
      vtoMatafuego: vehiculo.vtoMatafuego || '',
      vtoSeguro: vehiculo.vtoSeguro || '',
      observaciones: vehiculo.observaciones || '',
      remiseriaId: vehiculo.remiseriaId
    });
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setCreateStep(1);
    setTipoPropietario('AGENCIA');
    setFormData(prev => ({ ...prev, propietario: 'Agencia' }));
    setShowCreateModal(true);
  };

  const handleNextStep = () => {
    if (createStep === 1) {
      if (!formData.patente?.trim() || !formData.marca?.trim() || !formData.modelo?.trim() || !formData.tipo?.trim()) {
        toast.error('Completá la patente, tipo, marca y modelo del vehículo');
        return;
      }
    } else if (createStep === 2) {
      if (tipoPropietario === 'TERCERO' && !formData.propietario?.trim()) {
        toast.error('Por favor ingresá el nombre completo del dueño del vehículo');
        return;
      }
      if (!formData.propietario?.trim()) {
        toast.error('Indicá a quién pertenece el vehículo (titular / propietario)');
        return;
      }
    }
    setCreateStep(prev => Math.min(prev + 1, 4));
  };

  const handlePrevStep = () => {
    setCreateStep(prev => Math.max(prev - 1, 1));
  };

  const resetForm = () => {
    setFormData({
      patente: '',
      marca: '',
      modelo: '',
      anio: new Date().getFullYear(),
      color: '',
      tipo: '',
      capacidad: 4,
      propietario: '',
      vtoVtv: '',
      vtoMatafuego: '',
      vtoSeguro: '',
      observaciones: '',
      remiseriaId: remiserias[0]?.id || ''
    });
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'ACTIVO':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'MANTENIMIENTO':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'INACTIVO':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (estado: string) => {
    switch (estado) {
      case 'ACTIVO':
        return 'Activo';
      case 'MANTENIMIENTO':
        return 'En Mantenimiento';
      case 'INACTIVO':
        return 'Inactivo';
      default:
        return estado;
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'ACTIVO':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'MANTENIMIENTO':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'INACTIVO':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredVehiculos = vehiculos.filter(vehiculo => {
    const matchesSearch = 
      vehiculo.patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehiculo.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehiculo.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehiculo.propietario.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || vehiculo.estado === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="loading-spinner border-primary-500 mx-auto"></div>
        <p className="mt-4 text-slate-500">Cargando vehículos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Vehículos</h2>
          <p className="text-sm text-slate-500">Gestioná la flota de vehículos de tus remiserías.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn btn-primary shadow-md shadow-primary-500/20"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Vehículo
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por patente, marca, modelo o propietario..."
              className="input pl-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input max-w-[200px] bg-white cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="MANTENIMIENTO">En Mantenimiento</option>
            <option value="INACTIVO">Inactivos</option>
          </select>
        </div>

        {/* Vehicles Table */}
        <div className="overflow-x-auto">
          {filteredVehiculos.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Car className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No hay vehículos</h3>
                <p className="text-slate-500">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'No se encontraron vehículos con los filtros aplicados.'
                    : 'Comienza creando tu primer vehículo.'
                  }
                </p>
              </div>
            ) : (
              <>
                {/* VISTA MÓVIL (CARDS TÁCTILES) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {filteredVehiculos.map((vehiculo) => (
                    <div key={vehiculo.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1.5 bg-slate-900 text-white font-mono font-extrabold text-sm rounded-lg shadow-xs tracking-wider border border-slate-700">
                            {vehiculo.patente}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">
                              {vehiculo.marca} {vehiculo.modelo}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Año {vehiculo.anio} • {vehiculo.color}
                            </p>
                          </div>
                        </div>
                        <span className={`inline-flex px-2.5 py-1 text-[11px] font-semibold rounded-full border shrink-0 ${getStatusColor(vehiculo.estado)}`}>
                          {vehiculo.estado}
                        </span>
                      </div>

                      {/* Detalles: Propietario, Remiseria, Capacidad */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">Propietario</span>
                          <span className="font-semibold text-slate-800 block mt-0.5 truncate">
                            {vehiculo.propietario || 'Empresa'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">Remisería</span>
                          <span className="font-semibold text-slate-800 block mt-0.5 truncate">
                            {vehiculo.remiseria?.nombreFantasia || 'Base'}
                          </span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200/50 flex flex-wrap gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                            <span className="text-slate-400">VTV:</span> {vehiculo.vtoVtv ? new Date(vehiculo.vtoVtv).toLocaleDateString('es-AR') : 'Sin cargar'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                            <span className="text-slate-400">Seguro:</span> {vehiculo.vtoSeguro ? new Date(vehiculo.vtoSeguro).toLocaleDateString('es-AR') : 'Sin cargar'}
                          </span>
                        </div>
                      </div>

                      {/* Botones de acción táctiles */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          onClick={() => openEditModal(vehiculo)}
                          className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all active:scale-95"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleStatus(vehiculo)}
                          className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all active:scale-95"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Estado
                        </button>
                        <button
                          onClick={() => handleDelete(vehiculo.id)}
                          className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-all active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Borrar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* VISTA ESCRITORIO (TABLA) */}
                <div className="hidden md:block">
                  <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehículo</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Propietario</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Remisería</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Capacidad</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vencimientos</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredVehiculos.map((vehiculo) => (
                    <tr key={vehiculo.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                            <Car className="w-5 h-5 text-slate-500" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              {vehiculo.patente}
                            </div>
                            <div className="text-sm text-slate-600">
                              {vehiculo.marca} {vehiculo.modelo} ({vehiculo.anio})
                            </div>
                            <div className="text-xs text-slate-400">
                              {vehiculo.color} • {vehiculo.tipo}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">{vehiculo.propietario}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">
                          {vehiculo.remiseria?.nombreFantasia || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">{vehiculo.capacidad} pasajeros</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-slate-500 space-y-1">
                          {vehiculo.vtoVtv && (
                            <div><span className="font-medium text-slate-700">VTV:</span> {new Date(vehiculo.vtoVtv).toLocaleDateString()}</div>
                          )}
                          {vehiculo.vtoMatafuego && (
                            <div><span className="font-medium text-slate-700">Matafuego:</span> {new Date(vehiculo.vtoMatafuego).toLocaleDateString()}</div>
                          )}
                          {vehiculo.vtoSeguro && (
                            <div><span className="font-medium text-slate-700">Seguro:</span> {new Date(vehiculo.vtoSeguro).toLocaleDateString()}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${
                          vehiculo.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          vehiculo.estado === 'MANTENIMIENTO' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {getStatusText(vehiculo.estado)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(vehiculo)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(vehiculo)}
                            className={`p-1.5 rounded-lg transition-colors ${vehiculo.estado === 'ACTIVO' ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                            title={vehiculo.estado === 'ACTIVO' ? 'Suspender' : 'Activar'}
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(vehiculo.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
          </div>
        </div>

      {/* Create Modal por Pasos (Wizard Stepper) */}
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
                    {createStep === 1 && '• Datos del Rodado'}
                    {createStep === 2 && '• Propietario / Titular'}
                    {createStep === 3 && '• Vencimientos'}
                    {createStep === 4 && '• Confirmación'}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">Alta de Vehículo</h3>
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
                  { step: 1, label: 'Rodado', icon: Car },
                  { step: 2, label: 'Titular', icon: User },
                  { step: 3, label: 'Papeles', icon: Calendar },
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

            {/* Formulario */}
            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              
              {/* PASO 1: DATOS DEL VEHÍCULO */}
              {createStep === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Patente / Dominio *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.patente}
                        onChange={(e) => setFormData({ ...formData, patente: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider focus:ring-2 focus:ring-primary-500"
                        placeholder="ej. AF123CD"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tipo de Carrocería *
                      </label>
                      <select
                        required
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Seleccionar tipo</option>
                        <option value="Auto">Auto / Sedán</option>
                        <option value="Camioneta">Camioneta</option>
                        <option value="SUV">SUV</option>
                        <option value="Van">Van / Minibús</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Marca *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.marca}
                        onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm uppercase focus:ring-2 focus:ring-primary-500"
                        placeholder="ej. Toyota, Fiat, Renault"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Modelo *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.modelo}
                        onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm uppercase focus:ring-2 focus:ring-primary-500"
                        placeholder="ej. Cronos, Etios, Kangoo"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Año *
                      </label>
                      <input
                        type="number"
                        required
                        min="1990"
                        max={new Date().getFullYear() + 1}
                        value={formData.anio}
                        onChange={(e) => setFormData({ ...formData, anio: parseInt(e.target.value) || 2020 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Color *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm uppercase focus:ring-2 focus:ring-primary-500"
                        placeholder="ej. Blanco"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Pasajeros *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="20"
                        value={formData.capacidad}
                        onChange={(e) => setFormData({ ...formData, capacidad: parseInt(e.target.value) || 4 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 2: PROPIETARIO / TITULAR */}
              {createStep === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      ¿A quién pertenece el vehículo?
                    </label>
                    <p className="text-xs text-slate-500 mb-3">
                      Seleccioná la titularidad para calcular comisiones y liquidaciones correspondientes.
                    </p>

                    <div className="space-y-2.5">
                      {/* Opción 1: Agencia */}
                      <div
                        onClick={() => {
                          setTipoPropietario('AGENCIA');
                          setFormData({ ...formData, propietario: 'Agencia' });
                        }}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                          tipoPropietario === 'AGENCIA'
                            ? 'bg-indigo-50/70 border-indigo-600 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🏢</span>
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                              Propiedad de la Agencia (Remises Bruno)
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Vehículo propio de la empresa remisería.
                            </span>
                          </div>
                        </div>
                        {tipoPropietario === 'AGENCIA' && (
                          <Check className="w-5 h-5 text-indigo-600 shrink-0" />
                        )}
                      </div>

                      {/* Opción 2: Dueño de Vehículo (Tercero ajeno / Inversor) */}
                      <div
                        onClick={() => {
                          setTipoPropietario('TERCERO');
                          if (formData.propietario === 'Agencia' || formData.propietario === 'Chofer') {
                            setFormData({ ...formData, propietario: '' });
                          }
                        }}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                          tipoPropietario === 'TERCERO'
                            ? 'bg-blue-50/70 border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🚗</span>
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                              Dueño de Vehículo (Persona externa / Inversor)
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Persona ajena que pone a trabajar su auto en la agencia (50% de ganancia en liquidación).
                            </span>
                          </div>
                        </div>
                        {tipoPropietario === 'TERCERO' && (
                          <Check className="w-5 h-5 text-blue-600 shrink-0" />
                        )}
                      </div>

                      {/* Opción 3: Chofer */}
                      <div
                        onClick={() => {
                          setTipoPropietario('CHOFER');
                          setFormData({ ...formData, propietario: 'Chofer' });
                        }}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                          tipoPropietario === 'CHOFER'
                            ? 'bg-emerald-50/70 border-emerald-600 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">👤</span>
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                              Vehículo Propio del Chofer
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              El chofer conduce su propio auto (retiene el 80% y paga 20% a la agencia).
                            </span>
                          </div>
                        </div>
                        {tipoPropietario === 'CHOFER' && (
                          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Campo de ingreso del Dueño Tercero si seleccionó TERCERO */}
                  {tipoPropietario === 'TERCERO' && (
                    <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <label className="block text-xs font-bold text-blue-950 mb-1">
                          Nombre completo del Dueño del Vehículo *
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          value={formData.propietario === 'Agencia' || formData.propietario === 'Chofer' ? '' : formData.propietario}
                          onChange={(e) => setFormData({ ...formData, propietario: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-blue-300 rounded-xl text-xs sm:text-sm uppercase font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 shadow-xs"
                          placeholder="Ej: Carlos Gómez, María Benítez, etc."
                        />
                        <p className="text-[11px] text-blue-700 mt-1">
                          Con este nombre podrás seleccionarlo y generar su reporte de liquidación en PDF.
                        </p>
                      </div>

                      {/* Sugerencias de dueños ya registrados en otros autos */}
                      {(() => {
                        const duenos = Array.from(
                          new Set(
                            vehiculos
                              .map((v) => v.propietario?.trim())
                              .filter((p) => p && p.toLowerCase() !== 'agencia' && p.toLowerCase() !== 'chofer')
                          )
                        );
                        if (duenos.length === 0) return null;
                        return (
                          <div>
                            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1.5">
                              O seleccioná un dueño ya registrado:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {duenos.map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, propietario: d })}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                    formData.propietario.toLowerCase() === d.toLowerCase()
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                      : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-100'
                                  }`}
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* PASO 3: PAPELES Y VENCIMIENTOS */}
              {createStep === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-900">
                      Cargá los vencimientos para recibir alertas automáticas cuando la VTV o seguro estén próximos a vencer.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Vencimiento VTV
                      </label>
                      <input
                        type="date"
                        value={formData.vtoVtv}
                        onChange={(e) => setFormData({ ...formData, vtoVtv: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Vencimiento Seguro
                      </label>
                      <input
                        type="date"
                        value={formData.vtoSeguro}
                        onChange={(e) => setFormData({ ...formData, vtoSeguro: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Venc. Matafuego
                      </label>
                      <input
                        type="date"
                        value={formData.vtoMatafuego}
                        onChange={(e) => setFormData({ ...formData, vtoMatafuego: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Observaciones / Notas (opcional)
                    </label>
                    <textarea
                      value={formData.observaciones}
                      onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="Estado del coche, detalles mecánicos, etc."
                    />
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
                      <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Ficha del Vehículo</span>
                      <span className="text-xs font-black px-2.5 py-0.5 rounded bg-white text-slate-900 uppercase">
                        {formData.patente}
                      </span>
                    </div>
                    <p className="text-lg font-black text-white">
                      {formData.marca} {formData.modelo} ({formData.anio})
                    </p>
                    <p className="text-xs text-slate-300">
                      Color: {formData.color} • Tipo: {formData.tipo} • Capacidad: {formData.capacidad} pasajeros
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Propietario / Titular</span>
                      <span className="font-black text-slate-900 block mt-0.5">{formData.propietario}</span>
                      <span className="text-[11px] text-slate-500">
                        {formData.propietario === 'Agencia'
                          ? 'Vehículo de Remisería'
                          : formData.propietario === 'Chofer'
                          ? 'Auto propio del Chofer'
                          : 'Dueño externo de flota'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Documentación</span>
                      <span className="font-semibold text-slate-800 block mt-0.5">
                        VTV: {formData.vtoVtv || 'No cargada'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Seguro: {formData.vtoSeguro || 'No cargado'}
                      </span>
                    </div>
                  </div>

                  {formData.observaciones && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Notas</span>
                      <p className="text-slate-700 italic mt-0.5">"{formData.observaciones}"</p>
                    </div>
                  )}
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
                    Confirmar y Crear Vehículo
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingVehiculo && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-full max-w-4xl shadow-xl rounded-lg bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Editar Vehículo</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-6">
              {/* Información del Vehículo */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Truck className="w-5 h-5 mr-2" />
                  Información del Vehículo
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Patente *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.patente}
                      onChange={(e) => setFormData({ ...formData, patente: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo *
                    </label>
                    <select
                      required
                      value={formData.tipo}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seleccionar tipo</option>
                      <option value="Auto">Auto</option>
                      <option value="Camioneta">Camioneta</option>
                      <option value="SUV">SUV</option>
                      <option value="Van">Van</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Marca *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.marca}
                      onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Modelo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.modelo}
                      onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Año *
                    </label>
                    <input
                      type="number"
                      required
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      value={formData.anio}
                      onChange={(e) => setFormData({ ...formData, anio: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Capacidad *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="20"
                      value={formData.capacidad}
                      onChange={(e) => setFormData({ ...formData, capacidad: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Información del Propietario */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Información del Propietario
                </h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del Propietario *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.propietario}
                    onChange={(e) => setFormData({ ...formData, propietario: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                  />
                </div>
              </div>

              {/* Vencimientos */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Vencimientos
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vencimiento VTV
                    </label>
                    <input
                      type="date"
                      value={formData.vtoVtv}
                      onChange={(e) => setFormData({ ...formData, vtoVtv: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vencimiento Matafuego
                    </label>
                    <input
                      type="date"
                      value={formData.vtoMatafuego}
                      onChange={(e) => setFormData({ ...formData, vtoMatafuego: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vencimiento Seguro
                    </label>
                    <input
                      type="date"
                      value={formData.vtoSeguro}
                      onChange={(e) => setFormData({ ...formData, vtoSeguro: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Observaciones
                </h4>
                <div>
                  <textarea
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Comentarios adicionales sobre el vehículo..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Actualizar Vehículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
