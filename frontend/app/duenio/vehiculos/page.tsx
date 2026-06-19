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
  Car
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
    setShowCreateModal(true);
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
      remiseriaId: ''
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
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehículo</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Propietario</th>
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
            )}
          </div>
        </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-full max-w-4xl shadow-xl rounded-lg bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Crear Nuevo Vehículo</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-6">
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
                       placeholder="ABC123"
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
                       placeholder="Toyota"
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
                       placeholder="Corolla"
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
                       placeholder="Blanco"
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
                     placeholder="Juan Pérez"
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

              {/* Asignación */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Truck className="w-5 h-5 mr-2" />
                  Asignación
                </h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remisería *
                  </label>
                  <select
                    required
                    value={formData.remiseriaId}
                    onChange={(e) => setFormData({ ...formData, remiseriaId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar remisería</option>
                    {remiserias.map(remiseria => (
                      <option key={remiseria.id} value={remiseria.id}>
                        {remiseria.nombreFantasia}
                      </option>
                    ))}
                  </select>
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
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Vehículo
                </button>
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