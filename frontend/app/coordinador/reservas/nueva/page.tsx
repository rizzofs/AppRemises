'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { 
  ArrowLeft, 
  Save, 
  Phone, 
  MapPin, 
  Clock, 
  User, 
  Calendar,
  Repeat,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface ReservaFormData {
  nombreCliente: string;
  telefonoCliente: string;
  direccionOrigen: string;
  direccionDestino: string;
  fechaInicio: string;
  horaInicio: string;
  tipoReserva: 'unica' | 'periodica';
  // Para reservas periódicas
  fechaFin?: string;
  diasSemana?: string[];
  horaFin?: string;
  // Detalles adicionales
  observaciones: string;
  prioridad: 'normal' | 'alta' | 'urgente';
  metodoContacto: 'app' | 'telefono' | 'personal';
}

export default function NuevaReserva() {
  const router = useRouter();
  const { user } = useAuth();
  useAppTracking('COORDINADOR_NUEVA_RESERVA');
  
  const [formData, setFormData] = useState<ReservaFormData>({
    nombreCliente: '',
    telefonoCliente: '',
    direccionOrigen: '',
    direccionDestino: '',
    fechaInicio: new Date().toISOString().split('T')[0],
    horaInicio: '08:00',
    tipoReserva: 'unica',
    observaciones: '',
    prioridad: 'normal',
    metodoContacto: 'telefono'
  });

  const [isLoading, setIsLoading] = useState(false);

  const diasSemana = [
    { value: '1', label: 'Lunes' },
    { value: '2', label: 'Martes' },
    { value: '3', label: 'Miércoles' },
    { value: '4', label: 'Jueves' },
    { value: '5', label: 'Viernes' },
    { value: '6', label: 'Sábado' },
    { value: '0', label: 'Domingo' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Aquí irá la llamada a la API
      console.log('Datos de la reserva:', formData);
      
      toast.success('Reserva creada exitosamente');
      router.push('/coordinador/dashboard');
    } catch (error) {
      toast.error('Error al crear la reserva');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof ReservaFormData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDiaSemanaChange = (dia: string) => {
    const currentDias = formData.diasSemana || [];
    const newDias = currentDias.includes(dia)
      ? currentDias.filter(d => d !== dia)
      : [...currentDias, dia];
    
    handleInputChange('diasSemana', newDias);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <Link 
              href="/coordinador/dashboard"
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nueva Reserva</h1>
              <p className="text-sm text-gray-600">Crear una nueva reserva única o periódica</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información del Cliente */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Información del Cliente
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombreCliente}
                  onChange={(e) => handleInputChange('nombreCliente', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nombre completo"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="tel"
                    required
                    value={formData.telefonoCliente}
                    onChange={(e) => handleInputChange('telefonoCliente', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="11 1234-5678"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Detalles del Viaje */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Detalles del Viaje
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección de Origen *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      required
                      value={formData.direccionOrigen}
                      onChange={(e) => handleInputChange('direccionOrigen', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Calle y número"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección de Destino *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      required
                      value={formData.direccionDestino}
                      onChange={(e) => handleInputChange('direccionDestino', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Calle y número"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Configuración de la Reserva */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Configuración de la Reserva
            </h2>
            
            <div className="space-y-6">
              {/* Tipo de Reserva */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Tipo de Reserva
                </label>
                <div className="flex space-x-6">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tipoReserva"
                      value="unica"
                      checked={formData.tipoReserva === 'unica'}
                      onChange={(e) => handleInputChange('tipoReserva', e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">Reserva Única</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tipoReserva"
                      value="periodica"
                      checked={formData.tipoReserva === 'periodica'}
                      onChange={(e) => handleInputChange('tipoReserva', e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">Reserva Periódica</span>
                  </label>
                </div>
              </div>

              {/* Fechas y Horarios */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Inicio *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="date"
                      required
                      value={formData.fechaInicio}
                      onChange={(e) => handleInputChange('fechaInicio', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora de Inicio *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="time"
                      required
                      value={formData.horaInicio}
                      onChange={(e) => handleInputChange('horaInicio', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridad
                  </label>
                  <select
                    value={formData.prioridad}
                    onChange={(e) => handleInputChange('prioridad', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              {/* Configuración para reservas periódicas */}
              {formData.tipoReserva === 'periodica' && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 flex items-center">
                    <Repeat className="h-4 w-4 mr-2" />
                    Configuración Periódica
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha de Fin
                      </label>
                      <input
                        type="date"
                        value={formData.fechaFin || ''}
                        onChange={(e) => handleInputChange('fechaFin', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hora de Fin (opcional)
                      </label>
                      <input
                        type="time"
                        value={formData.horaFin || ''}
                        onChange={(e) => handleInputChange('horaFin', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Días de la Semana
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {diasSemana.map((dia) => (
                        <label key={dia.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.diasSemana?.includes(dia.value) || false}
                            onChange={() => handleDiaSemanaChange(dia.value)}
                            className="mr-2"
                          />
                          <span className="text-sm">{dia.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Método de Contacto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Contacto
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="metodoContacto"
                      value="app"
                      checked={formData.metodoContacto === 'app'}
                      onChange={(e) => handleInputChange('metodoContacto', e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">App</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="metodoContacto"
                      value="telefono"
                      checked={formData.metodoContacto === 'telefono'}
                      onChange={(e) => handleInputChange('metodoContacto', e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">Teléfono</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="metodoContacto"
                      value="personal"
                      checked={formData.metodoContacto === 'personal'}
                      onChange={(e) => handleInputChange('metodoContacto', e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">Personal</span>
                  </label>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => handleInputChange('observaciones', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Información adicional, instrucciones especiales..."
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end space-x-4">
            <Link
              href="/coordinador/dashboard"
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
            
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{isLoading ? 'Creando...' : 'Crear Reserva'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 