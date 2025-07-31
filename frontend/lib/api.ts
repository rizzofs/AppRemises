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
  UpdateVehiculoData
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

export default api; 