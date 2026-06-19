'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { MapPin, Navigation, Car, CreditCard, Clock } from 'lucide-react';

export default function ClienteApp() {
  const { user } = useAuth();
  const router = useRouter();

  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [isCalculando, setIsCalculando] = useState(false);
  const [presupuesto, setPresupuesto] = useState<any>(null);
  const [estadoViaje, setEstadoViaje] = useState<'IDLE' | 'BUSCANDO' | 'ACEPTADO' | 'EN_CAMINO'>('IDLE');

  useEffect(() => {
    if (!user || user.rol !== 'CLIENTE') {
      router.push('/login');
      return;
    }
  }, [user, router]);

  // Simulación de auto-completar mi ubicación actual
  const usarUbicacionActual = () => {
    toast.success('Ubicación obtenida');
    setOrigen('Av. Corrientes 1234, CABA');
  };

  const calcularPrecio = () => {
    if (!origen || !destino) {
      toast.error('Por favor ingresa un origen y un destino');
      return;
    }
    
    setIsCalculando(true);
    // Simulamos un delay de API y cálculo
    setTimeout(() => {
      setPresupuesto({
        precio: 3500,
        distancia: '2.5 km',
        tiempo: '10 min',
      });
      setIsCalculando(false);
    }, 1000);
  };

  const pedirAuto = () => {
    setEstadoViaje('BUSCANDO');
    toast.success('Buscando el auto más cercano...');
    
    // Simulamos que un chofer acepta el viaje a los 4 segundos
    setTimeout(() => {
      setEstadoViaje('ACEPTADO');
      toast.success('¡Un chofer ha aceptado tu viaje!');
    }, 4000);
  };

  const cancelarViaje = () => {
    if (window.confirm('¿Estás seguro de que quieres cancelar el viaje?')) {
      setEstadoViaje('IDLE');
      setPresupuesto(null);
      setOrigen('');
      setDestino('');
      toast.error('Viaje cancelado');
    }
  };

  if (!user) return null;

  return (
    <div className="relative flex flex-col h-[calc(100vh-8rem)]">
      
      {/* MAPA PLACEHOLDER */}
      <div className="absolute inset-0 bg-gray-200 z-0">
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
          <MapPin className="w-12 h-12 mb-2" />
          <span>(Mapa interactivo irá aquí)</span>
        </div>
      </div>

      {/* CONTROLES SUPERIORES */}
      {estadoViaje === 'IDLE' && (
        <div className="z-10 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-4 space-y-4">
              
              {/* Input de Origen */}
              <div className="flex gap-3 items-center">
                <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={origen}
                    onChange={(e) => setOrigen(e.target.value)}
                    placeholder="¿Dónde estás?"
                    className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                  <button 
                    onClick={usarUbicacionActual}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-600"
                    title="Usar mi ubicación actual"
                  >
                    <Navigation className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="w-0.5 h-6 bg-gray-200 ml-[11px] -my-2"></div>

              {/* Input de Destino */}
              <div className="flex gap-3 items-center">
                <div className="w-4 h-4 bg-gray-200 flex items-center justify-center">
                  <div className="w-2 h-2 bg-red-500"></div>
                </div>
                <div className="flex-1">
                  <input 
                    type="text" 
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    placeholder="¿A dónde vas?"
                    className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ÁREA INFERIOR (Presupuesto o Estado del Viaje) */}
      <div className="mt-auto z-10 w-full animate-slide-up">
        
        {/* Caso 1: Ingresó origen y destino pero no calculó */}
        {estadoViaje === 'IDLE' && origen && destino && !presupuesto && !isCalculando && (
          <div className="p-4 bg-gradient-to-t from-white via-white to-transparent">
            <button 
              onClick={calcularPrecio}
              className="w-full bg-primary-600 text-white font-bold rounded-xl py-4 shadow-lg active:scale-95 transition-transform"
            >
              Confirmar Destino
            </button>
          </div>
        )}

        {/* Caso 2: Calculando */}
        {isCalculando && (
          <div className="p-6 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Calculando mejor ruta...</p>
          </div>
        )}

        {/* Caso 3: Presupuesto Listo para pedir */}
        {estadoViaje === 'IDLE' && presupuesto && !isCalculando && (
          <div className="bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] overflow-hidden">
            <div className="p-6 space-y-6">
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-3 rounded-xl">
                    <Car className="w-6 h-6 text-gray-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Remís Clásico</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {presupuesto.tiempo} ({presupuesto.distancia})
                    </p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-gray-900">${presupuesto.precio}</span>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 py-2 rounded-xl flex items-center justify-center gap-2 font-medium text-sm">
                  <CreditCard className="w-4 h-4" />
                  Efectivo
                </button>
              </div>

              <button 
                onClick={pedirAuto}
                className="w-full bg-primary-600 text-white font-bold rounded-xl py-4 shadow-lg shadow-primary-500/30 active:scale-95 transition-transform"
              >
                PEDIR AUTO AHORA
              </button>
            </div>
          </div>
        )}

        {/* Caso 4: Buscando Chofer */}
        {estadoViaje === 'BUSCANDO' && (
          <div className="bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-6 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping"></div>
              <div className="relative bg-blue-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
                <Navigation className="w-8 h-8" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-xl text-gray-900">Buscando conductor...</h3>
              <p className="text-gray-500 mt-1">Conectando con el remís más cercano</p>
            </div>
            
            <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden mt-6">
              <div className="h-full bg-blue-600 w-1/2 animate-slide-right"></div>
            </div>

            <button 
              onClick={cancelarViaje}
              className="mt-6 text-red-500 font-semibold"
            >
              Cancelar búsqueda
            </button>
          </div>
        )}

        {/* Caso 5: Viaje Aceptado / Chofer en camino */}
        {estadoViaje === 'ACEPTADO' && (
          <div className="bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] overflow-hidden">
            <div className="bg-green-600 text-white p-4 text-center">
              <h3 className="font-bold text-lg">¡Tu remís está en camino!</h3>
              <p className="text-sm text-green-100">Llegará en aprox. 5 minutos</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <Car className="w-8 h-8 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-lg">Carlos Pérez</h4>
                  <div className="flex gap-2 text-sm text-gray-600 mt-1">
                    <span className="font-semibold bg-gray-100 px-2 py-0.5 rounded">AF 123 CD</span>
                    <span>• Fiat Cronos</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500">Total</span>
                  <p className="font-bold text-xl">${presupuesto.precio}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 py-3 bg-gray-100 font-bold text-gray-700 rounded-xl">
                  Llamar
                </button>
                <button className="flex-1 py-3 bg-gray-100 font-bold text-gray-700 rounded-xl">
                  Mensaje
                </button>
              </div>

              <button 
                onClick={cancelarViaje}
                className="w-full text-red-500 font-semibold mt-2"
              >
                Cancelar viaje
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}