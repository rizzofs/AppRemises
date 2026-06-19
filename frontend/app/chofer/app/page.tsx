'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { MapPin, Navigation, Car, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ChoferApp() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [isActive, setIsActive] = useState(false);
  const [viajeActual, setViajeActual] = useState<any>(null);
  // Simulación de una alerta entrante
  const [alertaViaje, setAlertaViaje] = useState<any>(null);

  useEffect(() => {
    if (!user || user.rol !== 'CHOFER') {
      router.push('/login');
      return;
    }
    // TODO: Cargar estado real del chofer desde el backend
  }, [user, router]);

  const toggleStatus = async () => {
    // TODO: Actualizar estado en el backend
    setIsActive(!isActive);
    if (!isActive) {
      toast.success('Ahora estás Activo. Esperando viajes...');
    } else {
      toast.success('Te has desconectado.');
    }
  };

  const simularViaje = () => {
    if (!isActive) {
      toast.error('Debes estar activo para recibir viajes');
      return;
    }
    setAlertaViaje({
      id: 'viaje-test-123',
      origen: 'Av. Corrientes 1234, CABA',
      destino: 'Obelisco, CABA',
      precioEstimado: 2500,
      distancia: '2.5 km',
      tiempo: '10 min'
    });
  };

  const aceptarViaje = () => {
    setViajeActual({ ...alertaViaje, estado: 'ACEPTADO' });
    setAlertaViaje(null);
    toast.success('¡Viaje aceptado!');
  };

  const rechazarViaje = () => {
    setAlertaViaje(null);
  };

  const avisarLlegada = () => {
    setViajeActual({ ...viajeActual, estado: 'EN_CAMINO' });
    toast.success('Avisamos al cliente que estás esperando afuera');
  };

  const iniciarViaje = () => {
    setViajeActual({ ...viajeActual, estado: 'EN_CURSO' });
  };

  const finalizarViaje = () => {
    // Validación de seguridad para evitar finalización accidental
    const confirmacion = window.confirm(
      '¿Estás seguro de que deseas finalizar el viaje ahora? Verifica que hayas llegado a destino.'
    );
    
    if (confirmacion) {
      setViajeActual(null);
      toast.success('Viaje completado. ¡Buen trabajo!');
    }
  };

  const anularViaje = () => {
    const confirmacion = window.confirm(
      '¿Estás seguro de que deseas anular este viaje? Esta acción no se puede deshacer.'
    );

    if (confirmacion) {
      setViajeActual(null);
      toast.error('Viaje anulado.');
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 space-y-6">
      {/* Botón de Estado / Toggle Activo */}
      {!isActive ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-xl font-bold text-gray-800 mb-8">Comenzar Turno</h2>
          <button
            onClick={toggleStatus}
            className="relative w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-lg bg-gradient-to-br from-gray-100 to-gray-300 text-gray-500 shadow-gray-500/20 active:scale-95"
          >
            <Car className="w-12 h-12 mb-2" />
            <span className="font-bold text-xl">CONECTARSE</span>
          </button>
          <p className="text-sm text-gray-500 mt-8 text-center px-4">
            Pulsa el botón para ponerte en línea y empezar a recibir viajes.
          </p>
        </div>
      ) : (
        <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-ping absolute"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full relative"></div>
            </div>
            <div>
              <p className="font-bold text-green-800 leading-tight">ACTIVO</p>
              <p className="text-xs text-green-600">Buscando viajes...</p>
            </div>
          </div>
          
          <button
            onClick={toggleStatus}
            className="px-4 py-2 bg-white text-gray-600 text-sm font-semibold rounded-lg shadow-sm border border-gray-200 active:bg-gray-50"
          >
            Desconectarse
          </button>
        </div>
      )}

      {/* Botón para simular (Solo para desarrollo) */}
      {isActive && !alertaViaje && !viajeActual && (
        <div className="text-center mt-8">
          <button onClick={simularViaje} className="text-xs text-blue-500 underline bg-blue-50 px-4 py-2 rounded-full">
            [Simular viaje entrante - Solo Test]
          </button>
        </div>
      )}

      {/* Alerta de Nuevo Viaje */}
      {alertaViaje && (
        <div className="fixed inset-x-0 bottom-16 p-4 z-50 animate-slide-up">
          <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden">
            <div className="bg-blue-600 text-white p-3 flex items-center justify-between">
              <span className="font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
                ¡NUEVO VIAJE!
              </span>
              <span className="font-bold">${alertaViaje.precioEstimado}</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <MapPin className="w-5 h-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">ORIGEN</p>
                  <p className="text-sm font-bold text-gray-900">{alertaViaje.origen}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Navigation className="w-5 h-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">DESTINO</p>
                  <p className="text-sm font-bold text-gray-900">{alertaViaje.destino}</p>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 border-t">
                <button 
                  onClick={rechazarViaje}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl active:bg-gray-200"
                >
                  RECHAZAR
                </button>
                <button 
                  onClick={aceptarViaje}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 active:bg-blue-700"
                >
                  ACEPTAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viaje Actual */}
      {viajeActual && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-slate-800 text-white p-4">
            <h3 className="font-bold text-lg mb-1">Viaje en progreso</h3>
            <span className="inline-flex px-2 py-1 bg-white/20 text-xs font-semibold rounded-md">
              {viajeActual.estado === 'ACEPTADO' && 'YENDO AL ORIGEN'}
              {viajeActual.estado === 'EN_CAMINO' && 'ESPERANDO AL CLIENTE'}
              {viajeActual.estado === 'EN_CURSO' && 'EN VIAJE HACIA DESTINO'}
            </span>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="flex gap-3 items-start">
              <div className="mt-1 w-6 flex flex-col items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-0.5 h-10 bg-gray-200"></div>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs text-gray-500">ORIGEN</p>
                  <p className="text-sm font-semibold">{viajeActual.origen}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">DESTINO</p>
                  <p className="text-sm font-semibold">{viajeActual.destino}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
              {viajeActual.estado === 'ACEPTADO' && (
                <button 
                  onClick={avisarLlegada}
                  className="w-full py-4 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  AVISAR "ESTOY LLEGANDO"
                </button>
              )}

              {viajeActual.estado === 'EN_CAMINO' && (
                <button 
                  onClick={iniciarViaje}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30"
                >
                  INICIAR VIAJE
                </button>
              )}

              {viajeActual.estado === 'EN_CURSO' && (
                <button 
                  onClick={finalizarViaje}
                  className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30"
                >
                  FINALIZAR VIAJE (${viajeActual.precioEstimado})
                </button>
              )}

              {/* Botón para anular el viaje (Visible en todos los estados del viaje) */}
              <button 
                onClick={anularViaje}
                className="w-full py-3 mt-2 bg-white text-red-500 font-semibold rounded-xl border border-red-200 shadow-sm"
              >
                Anular Viaje
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
