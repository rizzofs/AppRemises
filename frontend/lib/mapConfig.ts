// Configuración del mapa para la aplicación

export const CHIVILCOY_COORDS = {
  LAT: -34.8957,
  LNG: -60.0189,
  NAME: 'Chivilcoy, Buenos Aires'
};

export const MAP_CONFIG = {
  // Coordenadas por defecto (Chivilcoy, Provincia de Buenos Aires, Argentina)
  DEFAULT_CENTER: [-34.8957, -60.0189] as [number, number],
  DEFAULT_ZOOM: 13,
  CHIVILCOY_CENTER: [-34.8957, -60.0189] as [number, number],
  
  // Límites amplios de la provincia y alrededores (para permitir ver vehículos en ruta sin restringir)
  BOUNDS: {
    NORTH: -33.0,
    SOUTH: -39.0,
    EAST: -56.5,
    WEST: -63.5
  },
  
  // Configuración de tiles (mapas base)
  TILE_LAYERS: {
    OPENSTREETMAP: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    CARTODB: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  
  // Colores para los estados de los vehículos
  VEHICLE_COLORS: {
    DISPONIBLE: '#10B981', // green-500
    EN_VIAJE: '#3B82F6',   // blue-500
    FUERA_SERVICIO: '#EF4444', // red-500
    MANTENIMIENTO: '#F59E0B'  // yellow-500
  },
  
  // Configuración de marcadores
  MARKER_CONFIG: {
    SIZE: 24,
    BORDER_WIDTH: 2,
    BORDER_COLOR: '#FFFFFF',
    SHADOW: true
  },
  
  // Configuración de popups
  POPUP_CONFIG: {
    MAX_WIDTH: 300,
    MIN_WIDTH: 200,
    AUTO_PAN: true,
    CLOSE_BUTTON: true
  }
};

// Función para obtener el color según el estado del vehículo
export const getVehicleColor = (estado: string): string => {
  switch (estado.toLowerCase()) {
    case 'disponible':
      return MAP_CONFIG.VEHICLE_COLORS.DISPONIBLE;
    case 'en_viaje':
      return MAP_CONFIG.VEHICLE_COLORS.EN_VIAJE;
    case 'fuera_servicio':
      return MAP_CONFIG.VEHICLE_COLORS.FUERA_SERVICIO;
    case 'mantenimiento':
      return MAP_CONFIG.VEHICLE_COLORS.MANTENIMIENTO;
    default:
      return '#6B7280'; // gray-500
  }
};

// Función para obtener el texto del estado
export const getVehicleStatusText = (estado: string): string => {
  switch (estado.toLowerCase()) {
    case 'disponible':
      return 'Disponible';
    case 'en_viaje':
      return 'En Viaje';
    case 'fuera_servicio':
      return 'Fuera de Servicio';
    case 'mantenimiento':
      return 'En Mantenimiento';
    default:
      return 'Desconocido';
  }
};

// Función para calcular la distancia entre dos puntos (en km)
export const calculateDistance = (
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Función para formatear la distancia
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
};

// Función para determinar si una coordenada está dentro del radio urbano de Chivilcoy (aprox 12 km)
export const isEnChivilcoy = (lat: number, lng: number): boolean => {
  const distancia = calculateDistance(lat, lng, CHIVILCOY_COORDS.LAT, CHIVILCOY_COORDS.LNG);
  return distancia <= 12;
};
