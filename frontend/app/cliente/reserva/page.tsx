'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { clienteService, coordinadorDashboardService } from '@/lib/api';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  ArrowLeft, 
  Loader2, 
  Navigation, 
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
  const [origenSuggestions, setOrigenSuggestions] = useState<any[]>([]);
  const [destinoSuggestions, setDestinoSuggestions] = useState<any[]>([]);
  const [isOrigenSelected, setIsOrigenSelected] = useState(false);
  const [isDestinoSelected, setIsDestinoSelected] = useState(false);
  const [origenCoords, setOrigenCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<{ lat: number; lon: number } | null>(null);
  
  const [formData, setFormData] = useState<ReservaForm>({
    origen: '',
    destino: '',
    fechaInicio: '',
    horaInicio: '',
    tipoReserva: 'unica',
    diasSemana: [],
    observaciones: ''
  });

  useEffect(() => {
    if (isOrigenSelected || !formData.origen || formData.origen.length < 3) {
      setOrigenSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(formData.origen);
        if (res.success && res.data) {
          setOrigenSuggestions(res.data);
        }
      } catch (err) {
        console.error(err);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.origen, isOrigenSelected]);

  useEffect(() => {
    if (isDestinoSelected || !formData.destino || formData.destino.length < 3) {
      setDestinoSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(formData.destino);
        if (res.success && res.data) {
          setDestinoSuggestions(res.data);
        }
      } catch (err) {
        console.error(err);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.destino, isDestinoSelected]);

  const handleSelectOrigen = (item: any) => {
    setFormData(prev => ({ ...prev, origen: item.display_name }));
    setOrigenCoords({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
    setIsOrigenSelected(true);
    setOrigenSuggestions([]);
  };

  const handleSelectDestino = (item: any) => {
    setFormData(prev => ({ ...prev, destino: item.display_name }));
    setDestinoCoords({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
    setIsDestinoSelected(true);
    setDestinoSuggestions([]);
  };

  const diasSemana = [
    { value: 'LUNES', label: 'Lunes' },
    { value: 'MARTES', label: 'Martes' },
    { value: 'MIERCOLES', label: 'Miércoles' },
    { value: 'JUEVES', label: 'Jueves' },
    { value: 'VIERNES', label: 'Viernes' },
    { value: 'SABADO', label: 'Sábado' },
    { value: 'DOMINGO', label: 'Domingo' }
  ];

  const handleDiaSemanaChange = (dia: string) => {
    setFormData(prev => ({
      ...prev,
      diasSemana: prev.diasSemana.includes(dia)
        ? prev.diasSemana.filter(d => d !== dia)
        : [...prev.diasSemana, dia]
    }));
  };

  const obtenerUbicacionActual = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            const direccion = data.display_name || `${latitude}, ${longitude}`;
            
            setUbicacionActual({ lat: latitude, lng: longitude, direccion });
            setFormData(prev => ({ ...prev, origen: direccion }));
            setOrigenCoords({ lat: latitude, lon: longitude });
            setIsOrigenSelected(true);
            setOrigenSuggestions([]);
          } catch (error) {
            console.error('Error al obtener dirección:', error);
            const direccion = `${latitude}, ${longitude}`;
            setUbicacionActual({ lat: latitude, lng: longitude, direccion });
            setFormData(prev => ({ ...prev, origen: direccion }));
            setOrigenCoords({ lat: latitude, lon: longitude });
            setIsOrigenSelected(true);
          }
        },
        (error) => {
          console.error('Error de geolocalización:', error);
          toast.error('No se pudo obtener tu ubicación actual');
        }
      );
    } else {
      toast.error('Geolocalización no soportada por el navegador');
    }
  };

  const validarFormulario = () => {
    if (!formData.origen.trim()) {
      toast.error('El origen es requerido');
      return false;
    }
    if (!formData.destino.trim()) {
      toast.error('El destino es requerido');
      return false;
    }
    if (!formData.fechaInicio) {
      toast.error('La fecha de inicio es requerida');
      return false;
    }
    if (!formData.horaInicio) {
      toast.error('La hora de inicio es requerida');
      return false;
    }

    const fechaHora = new Date(`${formData.fechaInicio}T${formData.horaInicio}`);
    if (fechaHora <= new Date()) {
      toast.error('La fecha y hora deben ser futuras');
      return false;
    }

    if (formData.tipoReserva === 'periodica') {
      if (formData.diasSemana.length === 0) {
        toast.error('Debes seleccionar al menos un día de la semana');
        return false;
      }
      if (formData.fechaFin && new Date(formData.fechaFin) <= new Date(formData.fechaInicio)) {
        toast.error('La fecha de fin debe ser posterior a la fecha de inicio');
        return false;
      }
    }

    return true;
  };

  const crearReserva = async () => {
    if (!validarFormulario()) return;

    setIsLoading(true);
    try {
      const datosReserva = {
        origen: formData.origen,
        destino: formData.destino,
        fechaInicio: formData.fechaInicio,
        horaInicio: formData.horaInicio,
        tipoReserva: formData.tipoReserva,
        fechaFin: formData.fechaFin || undefined,
        diasSemana: formData.tipoReserva === 'periodica' ? formData.diasSemana : undefined,
        horaFin: formData.horaFin || undefined,
        observaciones: formData.observaciones || undefined
      };

      const res = await clienteService.crearReserva(datosReserva);

      if (res.success) {
        toast.success('Reserva creada exitosamente');
        router.push('/cliente/viajes');
      } else {
        toast.error(res.message || 'Error al crear reserva');
      }
    } catch (error) {
      toast.error('Error al crear reserva');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 shadow-sm border-b border-gray-200 dark:border-slate-800 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Link 
                href="/cliente/app"
                className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nueva Reserva</h1>
                <p className="text-sm text-gray-600 dark:text-slate-400">Programa tu viaje</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Link 
                href="/cliente/perfil"
                className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <User className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 border border-gray-200 dark:border-slate-800 transition-colors">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Crear Nueva Reserva</h2>
            <p className="text-gray-600 dark:text-slate-400">Programa tu viaje para una fecha y hora específica</p>
          </div>

          <div className="space-y-6">
            {/* Origen y Destino */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Origen *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="¿Desde dónde?"
                    value={formData.origen}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, origen: e.target.value }));
                      setIsOrigenSelected(false);
                      setOrigenCoords(null);
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                  />
                  <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                  {origenSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                      {origenSuggestions.map((s, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => handleSelectOrigen(s)}
                          className="w-full text-left p-3 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800 last:border-0 text-gray-800 dark:text-slate-200 font-medium truncate block"
                        >
                          {s.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={obtenerUbicacionActual}
                  className="mt-2 text-sm text-blue-600 dark:text-primary-400 hover:text-blue-800 dark:hover:text-primary-300 flex items-center space-x-1"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Usar ubicación actual</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Destino *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="¿A dónde?"
                    value={formData.destino}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, destino: e.target.value }));
                      setIsDestinoSelected(false);
                      setDestinoCoords(null);
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                  />
                  <Navigation className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                  {destinoSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                      {destinoSuggestions.map((s, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => handleSelectDestino(s)}
                          className="w-full text-left p-3 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800 last:border-0 text-gray-800 dark:text-slate-200 font-medium truncate block"
                        >
                          {s.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Fecha de Inicio *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.fechaInicio}
                    onChange={(e) => setFormData(prev => ({ ...prev, fechaInicio: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Hora de Inicio *
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.horaInicio}
                    onChange={(e) => setFormData(prev => ({ ...prev, horaInicio: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Clock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
              </div>
            </div>

            {/* Tipo de Reserva */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Tipo de Reserva *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tipoReserva: 'unica' }))}
                  className={`p-4 border-2 rounded-xl text-left transition-colors ${
                    formData.tipoReserva === 'unica'
                      ? 'border-blue-500 dark:border-primary-500 bg-blue-50 dark:bg-primary-950/40 text-blue-900 dark:text-primary-200'
                      : 'border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600 bg-white dark:bg-slate-800/60 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  <Calendar className="h-6 w-6 text-blue-600 dark:text-primary-400 mb-2" />
                  <h3 className="font-medium text-gray-900 dark:text-white">Reserva Única</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Para una fecha y hora específica</p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tipoReserva: 'periodica' }))}
                  className={`p-4 border-2 rounded-xl text-left transition-colors ${
                    formData.tipoReserva === 'periodica'
                      ? 'border-blue-500 dark:border-primary-500 bg-blue-50 dark:bg-primary-950/40 text-blue-900 dark:text-primary-200'
                      : 'border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600 bg-white dark:bg-slate-800/60 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  <Repeat className="h-6 w-6 text-blue-600 dark:text-primary-400 mb-2" />
                  <h3 className="font-medium text-gray-900 dark:text-white">Reserva Periódica</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Se repite en días específicos</p>
                </button>
              </div>
            </div>

            {/* Campos adicionales para reserva periódica */}
            {formData.tipoReserva === 'periodica' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Fecha de Fin
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={formData.fechaFin || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, fechaFin: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Hora de Fin
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={formData.horaFin || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, horaFin: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <Clock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Días de la Semana *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {diasSemana.map((dia) => (
                      <label key={dia.value} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.diasSemana.includes(dia.value)}
                          onChange={() => handleDiaSemanaChange(dia.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                        />
                        <span className="text-sm text-gray-700 dark:text-slate-300">{dia.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Observaciones
              </label>
              <textarea
                rows={4}
                placeholder="Información adicional (opcional)"
                value={formData.observaciones}
                onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Botones */}
            <div className="flex space-x-4 pt-6">
              <Link
                href="/cliente/app"
                className="flex-1 bg-gray-600 dark:bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-slate-700 transition-colors text-center"
              >
                Cancelar
              </Link>
              <button
                onClick={crearReserva}
                disabled={isLoading}
                className="flex-1 bg-blue-600 dark:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
