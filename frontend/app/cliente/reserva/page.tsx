'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { clienteService } from '@/lib/api';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  ArrowLeft,
  Loader2,
  Navigation,
  CalendarDays,
  Repeat
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

interface ReservaForm {
  origen: string;
  destino: string;
  fechaInicio: string;
  horaInicio: string;
  tipoReserva: 'unica' | 'periodica';
  fechaFin?: string;
  diasSemana: string[];
  horaFin?: string;
  observaciones: string;
}

export default function NuevaReserva() {
  const { user } = useAuth();
  const router = useRouter();
  useAppTracking('CLIENTE_NUEVA_RESERVA');
  
  const [isLoading, setIsLoading] = useState(false);
  const [ubicacionActual, setUbicacionActual] = useState<{ lat: number; lng: number; direccion: string } | null>(null);
  
  const [formData, setFormData] = useState<ReservaForm>({
    origen: '',
    destino: '',
    fechaInicio: '',
    horaInicio: '',
    tipoReserva: 'unica',
    diasSemana: [],
    observaciones: ''
  });

  const diasSemana = [
    { value: 'lunes', label: 'Lunes' },
    { value: 'martes', label: 'Martes' },
    { value: 'miercoles', label: 'Miércoles' },
    { value: 'jueves', label: 'Jueves' },
    { value: 'viernes', label: 'Viernes' },
    { value: 'sabado', label: 'Sábado' },
    { value: 'domingo', label: 'Domingo' }
  ];

  const obtenerUbicacionActual = async () => {
    try {
      const response = await clienteService.getUbicacionActual();
      if (response.success && response.data) {
        setUbicacionActual(response.data);
        setFormData(prev => ({
          ...prev,
          origen: response.data?.direccion || ''
        }));
        toast.success('Ubicación actual obtenida');
      }
    } catch (error) {
      toast.error('Error al obtener ubicación actual');
    }
  };

  const handleDiaSemanaChange = (dia: string) => {
    setFormData(prev => ({
      ...prev,
      diasSemana: prev.diasSemana.includes(dia)
        ? prev.diasSemana.filter(d => d !== dia)
        : [...prev.diasSemana, dia]
    }));
  };

  const crearReserva = async () => {
    if (!formData.origen || !formData.destino || !formData.fechaInicio || !formData.horaInicio) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    if (formData.tipoReserva === 'periodica' && formData.diasSemana.length === 0) {
      toast.error('Selecciona al menos un día de la semana para reservas periódicas');
      return;
    }

    setIsLoading(true);
    try {
      const response = await clienteService.crearReserva({
        origen: formData.origen,
        destino: formData.destino,
        fechaInicio: formData.fechaInicio,
        horaInicio: formData.horaInicio,
        tipoReserva: formData.tipoReserva,
        fechaFin: formData.fechaFin,
        diasSemana: formData.diasSemana,
        horaFin: formData.horaFin,
        observaciones: formData.observaciones,
        latitudOrigen: ubicacionActual?.lat,
        longitudOrigen: ubicacionActual?.lng
      });

      if (response.success) {
        toast.success('Reserva creada exitosamente');
        router.push('/cliente/app');
      } else {
        toast.error(response.message || 'Error al crear reserva');
      }
    } catch (error) {
      toast.error('Error al crear reserva');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Link 
                href="/cliente/app"
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Nueva Reserva</h1>
                <p className="text-sm text-gray-600">Programa tu viaje</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Link 
                href="/cliente/perfil"
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <User className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Crear Nueva Reserva</h2>
            <p className="text-gray-600">Programa tu viaje para una fecha y hora específica</p>
          </div>

          <div className="space-y-6">
            {/* Origen y Destino */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Origen *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="¿Desde dónde?"
                    value={formData.origen}
                    onChange={(e) => setFormData(prev => ({ ...prev, origen: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                </div>
                <button
                  onClick={obtenerUbicacionActual}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Usar ubicación actual</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destino *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="¿A dónde?"
                    value={formData.destino}
                    onChange={(e) => setFormData(prev => ({ ...prev, destino: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Navigation className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Inicio *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.fechaInicio}
                    onChange={(e) => setFormData(prev => ({ ...prev, fechaInicio: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora de Inicio *
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.horaInicio}
                    onChange={(e) => setFormData(prev => ({ ...prev, horaInicio: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Clock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Tipo de Reserva */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Reserva *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tipoReserva: 'unica' }))}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    formData.tipoReserva === 'unica'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Calendar className="h-6 w-6 text-blue-600 mb-2" />
                  <h3 className="font-medium text-gray-900">Reserva Única</h3>
                  <p className="text-sm text-gray-600">Para una fecha y hora específica</p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tipoReserva: 'periodica' }))}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    formData.tipoReserva === 'periodica'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Repeat className="h-6 w-6 text-blue-600 mb-2" />
                  <h3 className="font-medium text-gray-900">Reserva Periódica</h3>
                  <p className="text-sm text-gray-600">Se repite en días específicos</p>
                </button>
              </div>
            </div>

            {/* Campos adicionales para reserva periódica */}
            {formData.tipoReserva === 'periodica' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha de Fin
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={formData.fechaFin || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, fechaFin: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de Fin
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={formData.horaFin || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, horaFin: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <Clock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Días de la Semana *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {diasSemana.map((dia) => (
                      <label key={dia.value} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.diasSemana.includes(dia.value)}
                          onChange={() => handleDiaSemanaChange(dia.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{dia.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                rows={4}
                placeholder="Información adicional (opcional)"
                value={formData.observaciones}
                onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Botones */}
            <div className="flex space-x-4 pt-6">
              <Link
                href="/cliente/app"
                className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors text-center"
              >
                Cancelar
              </Link>
              <button
                onClick={crearReserva}
                disabled={isLoading}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Calendar className="h-5 w-5" />
                )}
                <span>{isLoading ? 'Creando...' : 'Crear Reserva'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 