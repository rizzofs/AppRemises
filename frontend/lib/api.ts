import axios from 'axios';
import { 
  LoginCredentials, 
  RegisterData, 
  ApiResponse, 
  AuthResponse,
  Remiseria,
  Duenio,
  CreateRemiseriaData,
  UpdateRemiseriaData,
  CreateDuenioData,
  UpdateDuenioData,
  Coordinador,
  CreateCoordinadorData,
  UpdateCoordinadorData,
  Chofer,
  CreateChoferData,
  UpdateChoferData,
  Vehiculo,
  CreateVehiculoData,
  UpdateVehiculoData,
  SolicitudViajeData,
  CalculoPrecioData,
  ReservaClienteData,
  ViajeCliente,
  ReservaCliente
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Crear instancia de axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos de timeout
});

// Interceptor para agregar token de autorización
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de token expirado
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Función helper para manejar respuestas de la API
const handleApiResponse = <T>(response: any): ApiResponse<T> => {
  if (response.data) {
    return response.data;
  }
  return {
    success: false,
    message: 'Respuesta inválida del servidor',
  };
};

// Servicios de autenticación
export const authService = {
  login: async (credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> => {
    try {
      const response = await api.post('/auth/login', credentials);
      return handleApiResponse<AuthResponse>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al iniciar sesión',
      };
    }
  },
  
  validateToken: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/auth/validate');
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error validando token',
      };
    }
  },

  register: async (data: RegisterData): Promise<ApiResponse<AuthResponse>> => {
    try {
      const response = await api.post('/auth/register', data);
      return handleApiResponse<AuthResponse>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al registrar usuario',
      };
    }
  },

  refreshToken: async (refreshToken: string): Promise<ApiResponse<{ accessToken: string }>> => {
    try {
      const response = await api.post('/auth/refresh', { refreshToken });
      return handleApiResponse<{ accessToken: string }>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al renovar token',
      };
    }
  },
};

// Servicios de remiserías
export const remiseriaService = {
  getAll: async (): Promise<ApiResponse<Remiseria[]>> => {
    try {
      const response = await api.get('/remiserias');
      return handleApiResponse<Remiseria[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar remiserías',
      };
    }
  },

  getById: async (id: string): Promise<ApiResponse<Remiseria>> => {
    try {
      const response = await api.get(`/remiserias/${id}`);
      return handleApiResponse<Remiseria>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar remisería',
      };
    }
  },

  create: async (data: CreateRemiseriaData): Promise<ApiResponse<Remiseria>> => {
    try {
      const response = await api.post('/remiserias', data);
      return handleApiResponse<Remiseria>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear remisería',
      };
    }
  },

  update: async (id: string, data: UpdateRemiseriaData): Promise<ApiResponse<Remiseria>> => {
    try {
      const response = await api.put(`/remiserias/${id}`, data);
      return handleApiResponse<Remiseria>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar remisería',
      };
    }
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    try {
      const response = await api.delete(`/remiserias/${id}`);
      return handleApiResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar remisería',
      };
    }
  },
};

// Servicios de dueños
export const duenioService = {
  getAll: async (): Promise<ApiResponse<Duenio[]>> => {
    try {
      const response = await api.get('/duenios');
      return handleApiResponse<Duenio[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar dueños',
      };
    }
  },

  getById: async (id: string): Promise<ApiResponse<Duenio>> => {
    try {
      const response = await api.get(`/duenios/${id}`);
      return handleApiResponse<Duenio>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar dueño',
      };
    }
  },

  create: async (data: CreateDuenioData): Promise<ApiResponse<Duenio>> => {
    try {
      const response = await api.post('/duenios', data);
      return handleApiResponse<Duenio>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear dueño',
      };
    }
  },

  update: async (id: string, data: UpdateDuenioData): Promise<ApiResponse<Duenio>> => {
    try {
      const response = await api.put(`/duenios/${id}`, data);
      return handleApiResponse<Duenio>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar dueño',
      };
    }
  },

  toggleStatus: async (id: string): Promise<ApiResponse<Duenio>> => {
    try {
      const response = await api.patch(`/duenios/${id}/toggle-status`);
      return handleApiResponse<Duenio>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cambiar estado del dueño',
      };
    }
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    try {
      const response = await api.delete(`/duenios/${id}`);
      return handleApiResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar dueño',
      };
    }
  },
};

// Servicios de coordinadores
export const coordinadorService = {
  getAll: async (): Promise<ApiResponse<Coordinador[]>> => {
    try {
      const response = await api.get('/coordinadores');
      return handleApiResponse<Coordinador[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar coordinadores',
      };
    }
  },

  getByRemiseria: async (remiseriaId: string): Promise<ApiResponse<Coordinador[]>> => {
    try {
      const response = await api.get(`/coordinadores/remiseria/${remiseriaId}`);
      return handleApiResponse<Coordinador[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar coordinadores',
      };
    }
  },

  getById: async (id: string): Promise<ApiResponse<Coordinador>> => {
    try {
      const response = await api.get(`/coordinadores/${id}`);
      return handleApiResponse<Coordinador>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar coordinador',
      };
    }
  },

  create: async (data: CreateCoordinadorData): Promise<ApiResponse<Coordinador>> => {
    try {
      const response = await api.post('/coordinadores', data);
      return handleApiResponse<Coordinador>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear coordinador',
      };
    }
  },

  update: async (id: string, data: UpdateCoordinadorData): Promise<ApiResponse<Coordinador>> => {
    try {
      const response = await api.put(`/coordinadores/${id}`, data);
      return handleApiResponse<Coordinador>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar coordinador',
      };
    }
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    try {
      const response = await api.delete(`/coordinadores/${id}`);
      return handleApiResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar coordinador',
      };
    }
  },

  toggleStatus: async (id: string): Promise<ApiResponse<Coordinador>> => {
    try {
      const response = await api.patch(`/coordinadores/${id}/toggle-status`);
      return handleApiResponse<Coordinador>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cambiar estado del coordinador',
      };
    }
  },
};

// Servicios de choferes
export const choferService = {
  getAll: async (): Promise<ApiResponse<Chofer[]>> => {
    try {
      const response = await api.get('/choferes');
      return handleApiResponse<Chofer[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar choferes',
      };
    }
  },

  getByRemiseria: async (remiseriaId: string): Promise<ApiResponse<Chofer[]>> => {
    try {
      const response = await api.get(`/choferes/remiseria/${remiseriaId}`);
      return handleApiResponse<Chofer[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar choferes',
      };
    }
  },

  getById: async (id: string): Promise<ApiResponse<Chofer>> => {
    try {
      const response = await api.get(`/choferes/${id}`);
      return handleApiResponse<Chofer>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar chofer',
      };
    }
  },

  create: async (data: CreateChoferData): Promise<ApiResponse<Chofer>> => {
    try {
      const response = await api.post('/choferes', data);
      return handleApiResponse<Chofer>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear chofer',
      };
    }
  },

  update: async (id: string, data: UpdateChoferData): Promise<ApiResponse<Chofer>> => {
    try {
      const response = await api.put(`/choferes/${id}`, data);
      return handleApiResponse<Chofer>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar chofer',
      };
    }
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    try {
      const response = await api.delete(`/choferes/${id}`);
      return handleApiResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar chofer',
      };
    }
  },

  toggleStatus: async (id: string): Promise<ApiResponse<Chofer>> => {
    try {
      const response = await api.patch(`/choferes/${id}/toggle-status`);
      return handleApiResponse<Chofer>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cambiar estado del chofer',
      };
    }
  },
};

// Servicios de vehículos
export const vehiculoService = {
  getAll: async (): Promise<ApiResponse<Vehiculo[]>> => {
    try {
      const response = await api.get('/vehiculos');
      return handleApiResponse<Vehiculo[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar vehículos',
      };
    }
  },

  getByRemiseria: async (remiseriaId: string): Promise<ApiResponse<Vehiculo[]>> => {
    try {
      const response = await api.get(`/vehiculos/remiseria/${remiseriaId}`);
      return handleApiResponse<Vehiculo[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar vehículos',
      };
    }
  },

  getById: async (id: string): Promise<ApiResponse<Vehiculo>> => {
    try {
      const response = await api.get(`/vehiculos/${id}`);
      return handleApiResponse<Vehiculo>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar vehículo',
      };
    }
  },

  create: async (data: CreateVehiculoData): Promise<ApiResponse<Vehiculo>> => {
    try {
      const response = await api.post('/vehiculos', data);
      return handleApiResponse<Vehiculo>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear vehículo',
      };
    }
  },

  update: async (id: string, data: UpdateVehiculoData): Promise<ApiResponse<Vehiculo>> => {
    try {
      const response = await api.put(`/vehiculos/${id}`, data);
      return handleApiResponse<Vehiculo>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar vehículo',
      };
    }
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    try {
      const response = await api.delete(`/vehiculos/${id}`);
      return handleApiResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar vehículo',
      };
    }
  },

  updateStatus: async (id: string, estado: 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO'): Promise<ApiResponse<Vehiculo>> => {
    try {
      const response = await api.patch(`/vehiculos/${id}/status`, { estado });
      return handleApiResponse<Vehiculo>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cambiar estado del vehículo',
      };
    }
  },
};

// App Usage Tracking
export const appUsageService = {
  track: async (action: string, details?: any) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return { success: false, message: 'No hay token de acceso' };

      const response = await fetch(`${API_BASE_URL}/app-usage/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, details })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error tracking app usage:', error);
      return { success: false, message: 'Error al registrar uso' };
    }
  },

  getStats: async (period: string = '7d') => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return { success: false, message: 'No hay token de acceso' };

      const response = await fetch(`${API_BASE_URL}/app-usage/stats?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting app usage stats:', error);
      return { success: false, message: 'Error al obtener estadísticas' };
    }
  }
};

// Servicios para clientes (registro y perfil)
export const clienteAuthService = {
  register: async (data: any): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/cliente/register', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error en el registro',
      };
    }
  },

  getProfile: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/cliente/profile');
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar perfil',
      };
    }
  },

  updateProfile: async (data: any): Promise<ApiResponse<any>> => {
    try {
      const response = await api.put('/cliente/profile', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar perfil',
      };
    }
  }
};

// Servicios para coordinadores
export const coordinadorDashboardService = {
  // Viajes
  getViajesEnCurso: async (): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/coordinator-dashboard/viajes/en-curso');
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar viajes en curso',
      };
    }
  },

  getViajesSinAsignar: async (): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/coordinator-dashboard/viajes/sin-asignar');
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar viajes sin asignar',
      };
    }
  },

  getViajesReservados: async (): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/coordinator-dashboard/reservas');
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar viajes reservados',
      };
    }
  },

  createViaje: async (data: any): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/coordinator-dashboard/viajes', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear viaje',
      };
    }
  },

  createReserva: async (data: any): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/coordinator-dashboard/reservas', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear reserva',
      };
    }
  },

  // Mapa y ubicaciones
  getVehiculosTiempoReal: async (): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/coordinator-dashboard/vehiculos/tiempo-real');
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar ubicaciones',
      };
    }
  },

  getChoferesTiempoReal: async (): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/coordinator-dashboard/choferes/tiempo-real');
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar choferes',
      };
    }
  },

  // Reportes
  getReportes: async (periodo: string = 'hoy'): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get(`/coordinator-dashboard/reportes?periodo=${periodo}`);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar reportes',
      };
    }
  },

  // Estadísticas del dashboard
  getDashboardStats: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/coordinator-dashboard/stats');
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar estadísticas',
      };
    }
  },
};

// Servicios del cliente
export const clienteService = {
  // Solicitud de viaje
  solicitarViaje: async (data: SolicitudViajeData): Promise<ApiResponse<ViajeCliente>> => {
    try {
      const response = await api.post('/cliente/viajes/solicitar', data);
      return handleApiResponse<ViajeCliente>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al solicitar viaje',
      };
    }
  },

  // Cálculo de precio
  calcularPrecio: async (origen: string, destino: string): Promise<ApiResponse<CalculoPrecioData>> => {
    try {
      const response = await api.post('/cliente/viajes/calcular-precio', { origen, destino });
      return handleApiResponse<CalculoPrecioData>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al calcular precio',
      };
    }
  },

  // Crear reserva
  crearReserva: async (data: ReservaClienteData): Promise<ApiResponse<ReservaCliente>> => {
    try {
      const response = await api.post('/cliente/reservas', data);
      return handleApiResponse<ReservaCliente>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear reserva',
      };
    }
  },

  // Obtener viajes del cliente
  getViajes: async (): Promise<ApiResponse<ViajeCliente[]>> => {
    try {
      const response = await api.get('/cliente/viajes');
      return handleApiResponse<ViajeCliente[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar viajes',
      };
    }
  },

  // Obtener reservas del cliente
  getReservas: async (): Promise<ApiResponse<ReservaCliente[]>> => {
    try {
      const response = await api.get('/cliente/reservas');
      return handleApiResponse<ReservaCliente[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar reservas',
      };
    }
  },

  // Cancelar viaje
  cancelarViaje: async (viajeId: string): Promise<ApiResponse<void>> => {
    try {
      const response = await api.patch(`/cliente/viajes/${viajeId}/cancelar`);
      return handleApiResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cancelar viaje',
      };
    }
  },

  // Cancelar reserva
  cancelarReserva: async (reservaId: string): Promise<ApiResponse<void>> => {
    try {
      const response = await api.patch(`/cliente/reservas/${reservaId}/cancelar`);
      return handleApiResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cancelar reserva',
      };
    }
  },

  // Obtener ubicación actual
  getUbicacionActual: async (): Promise<ApiResponse<{ lat: number; lng: number; direccion: string }>> => {
    try {
      const response = await api.get('/cliente/ubicacion-actual');
      return handleApiResponse<{ lat: number; lng: number; direccion: string }>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener ubicación',
      };
    }
  },
};

export default api; 