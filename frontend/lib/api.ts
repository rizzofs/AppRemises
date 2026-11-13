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
  ReservaCliente,
  Cliente,
  PagoCuentaCorriente,
  Viaje,
  ArtEmpresa,
  CreateArtEmpresaData,
  UpdateArtEmpresaData,
  FacturacionArtResponse
} from '@/types';

export const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001/api`;
  }
  return 'http://localhost:3001/api';
};

export const getSocketUrl = (): string => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

const API_BASE_URL = getApiBaseUrl();

// Crear instancia de axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos de timeout
});

// Interceptor para agregar token de autorización y auto-detectar host dinámico (PC o Celular en red local)
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL) {
    config.baseURL = `http://${window.location.hostname}:3001/api`;
  }
  const token =
    (typeof window !== 'undefined' && sessionStorage.getItem('accessToken')) ||
    localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de token expirado (401 o 403 por token vencido)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken =
          (typeof window !== 'undefined' && sessionStorage.getItem('refreshToken')) ||
          localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${getApiBaseUrl()}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data.data;
          if (typeof window !== 'undefined' && sessionStorage.getItem('refreshToken')) {
            sessionStorage.setItem('accessToken', accessToken);
          }
          localStorage.setItem('accessToken', accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('refreshToken');
          sessionStorage.removeItem('user');
        }
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    const status = error.response?.status;
    const reqUrl = String(originalRequest?.url || '');
    const reqMethod = String(originalRequest?.method || 'get').toLowerCase();
    const isSilentPolling =
      reqMethod === 'get' &&
      (reqUrl.includes('/disponibilidad') ||
        reqUrl.includes('/mi-estado') ||
        reqUrl.includes('/cliente/viajes') ||
        reqUrl.includes('/tracking/'));

    if (
      typeof window !== 'undefined' &&
      !isSilentPolling &&
      (!status || status >= 500 || status === 429)
    ) {
      window.dispatchEvent(
        new CustomEvent('remiseria-system-error', {
          detail: {
            status,
            message: error.response?.data?.message || error.response?.data?.error,
          },
        })
      );
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
    message: 'Tuvimos un inconveniente en el sistema. Comunicate a nuestros teléfonos fijos: 2346-427637 o 2346-433000.',
  };
};

// Formateador amigable de errores (400, 404, 429, 500, red) con derivación a teléfonos fijos
const formatEmergencyError = (error: any, actionLabel?: string, showModal: boolean = false): string => {
  const status = error?.response?.status;
  const backendMsg = error?.response?.data?.message || error?.response?.data?.error || '';
  const telefonosSuffix = 'Por favor comunicate a los teléfonos fijos 2346-427637 o 2346-433000.';

  if (showModal && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('remiseria-system-error', {
        detail: {
          status,
          action: actionLabel,
          message: backendMsg,
        },
      })
    );
  }

  // Si el mensaje del backend ya incluye los teléfonos fijos, devolverlo directo
  if (backendMsg && (backendMsg.includes('2346-427637') || backendMsg.includes('2346-433000'))) {
    return backendMsg;
  }

  // Si es un error 500+, caída de red o error genérico ("Error interno...", "Error 500", etc.)
  if (!status || status >= 500 || status === 404 || status === 429 || /error interno|500|400|network/i.test(backendMsg)) {
    return `Tuvimos un inconveniente momentáneo${actionLabel ? ` al ${actionLabel.toLowerCase()}` : ''}. ${telefonosSuffix}`;
  }

  // Si es un 400 con mensaje específico, lo acompañamos de los teléfonos fijos para que no pierda el viaje
  if (backendMsg) {
    return `${backendMsg}. Si necesitás asistencia inmediata, llamanos al 2346-427637 o 2346-433000.`;
  }

  return `No pudimos completar la solicitud. ${telefonosSuffix}`;
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

  registerCliente: async (data: any): Promise<ApiResponse<AuthResponse>> => {
    try {
      const response = await api.post('/auth/register-cliente', data);
      return handleApiResponse<AuthResponse>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || error.response?.data?.message || 'Error al registrar cliente',
      };
    }
  },

  verificarDni: async (dni: string): Promise<ApiResponse<any>> => {
    try {
      const cleanDni = dni.replace(/\D/g, '');
      const response = await api.get(`/auth/verificar-dni/${cleanDni}`);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || error.response?.data?.message || 'No se pudo verificar el DNI en ARCA / AFIP',
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
  getActiva: async (): Promise<ApiResponse<Remiseria>> => {
    try {
      const response = await api.get('/remiserias/activa');
      return handleApiResponse<Remiseria>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar remisería activa',
      };
    }
  },
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

  updateOnlineStatus: async (
    isOnline: boolean,
    choferId?: string,
    odometros?: { odometroInicio?: number; odometroFin?: number }
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch('/choferes/online-status', {
        isOnline,
        choferId,
        ...(odometros || {}),
      });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al actualizar estado online',
      };
    }
  },

  getMiEstado: async (choferId?: string): Promise<ApiResponse<{ chofer: any; viajeActual: any; viajesDisponibles: any[]; viajeEnColaTabla?: any; turnoActivo?: any; enPausa?: boolean; motivoPausa?: string | null; pausaInicio?: string | null; puestoEnTabla?: number | null; totalEnTabla?: number }>> => {
    try {
      const response = await api.get('/choferes/mi-estado', { params: choferId ? { choferId } : undefined });
      return handleApiResponse<{ chofer: any; viajeActual: any; viajesDisponibles: any[]; viajeEnColaTabla?: any; turnoActivo?: any; enPausa?: boolean; motivoPausa?: string | null; pausaInicio?: string | null; puestoEnTabla?: number | null; totalEnTabla?: number }>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al obtener estado del chofer',
      };
    }
  },

  togglePausa: async (enPausa: boolean, motivo?: string, choferId?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/choferes/turno/pausa', { enPausa, motivo, choferId });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al cambiar pausa de turno',
      };
    }
  },

  aceptarViaje: async (viajeId: string, choferId?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/choferes/viajes/${viajeId}/aceptar`, { choferId });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al aceptar viaje',
      };
    }
  },

  rechazarViaje: async (viajeId: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/choferes/viajes/${viajeId}/rechazar`);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al rechazar viaje',
      };
    }
  },

  actualizarEstadoViaje: async (
    viajeId: string,
    estado: 'ACEPTADO' | 'EN_CAMINO' | 'EN_CURSO' | 'COMPLETADO' | 'CANCELADO',
    distancias?: {
      distanciaKmConPasajero?: number;
      distanciaKmSinPasajero?: number;
      metodoPago?: 'EFECTIVO' | 'TRANSFERENCIA' | 'CUENTA_CORRIENTE';
      precioFinal?: number;
    }
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch(`/choferes/viajes/${viajeId}/estado`, {
        estado,
        ...(distancias || {}),
      });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al actualizar estado del viaje',
      };
    }
  },

  agregarParada: async (
    viajeId: string,
    parada: { direccion: string; lat?: number; lon?: number }
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/choferes/viajes/${viajeId}/paradas`, parada);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al agregar parada',
      };
    }
  },

  avisarLlegando: async (viajeId: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/choferes/viajes/${viajeId}/avisar-llegando`);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al avisar llegada',
      };
    }
  },

  controlarEspera: async (viajeId: string, accion: 'INICIAR' | 'PAUSAR'): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/choferes/viajes/${viajeId}/espera`, { accion });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al controlar espera',
      };
    }
  },

  enviarMensajeChat: async (viajeId: string, texto: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/choferes/viajes/${viajeId}/chat`, { texto });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al enviar mensaje',
      };
    }
  },

  getVehiculosDisponibles: async (): Promise<ApiResponse<Vehiculo[]>> => {
    try {
      const response = await api.get('/choferes/vehiculos-disponibles');
      return handleApiResponse<Vehiculo[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar vehículos disponibles',
      };
    }
  },

  updateMiPerfil: async (data: { vehiculoId?: string | null; fotoUrl?: string | null }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch('/choferes/mi-perfil', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar perfil',
      };
    }
  },

  getMisViajes: async (
    choferId?: string,
    filters?: { fecha?: string; desde?: string; hasta?: string }
  ): Promise<ApiResponse<any[]>> => {
    try {
      const params: any = {};
      if (choferId) params.choferId = choferId;
      if (filters?.fecha) params.fecha = filters.fecha;
      if (filters?.desde) params.desde = filters.desde;
      if (filters?.hasta) params.hasta = filters.hasta;

      const response = await api.get('/choferes/mis-viajes', { params });
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al cargar viajes del chofer',
      };
    }
  },

  getMisTurnos: async (
    choferId?: string,
    filters?: { fecha?: string; desde?: string; hasta?: string }
  ): Promise<ApiResponse<any[]>> => {
    try {
      const params: any = {};
      if (choferId) params.choferId = choferId;
      if (filters?.fecha) params.fecha = filters.fecha;
      if (filters?.desde) params.desde = filters.desde;
      if (filters?.hasta) params.hasta = filters.hasta;

      const response = await api.get('/choferes/turnos', { params });
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al cargar turnos del chofer',
      };
    }
  },

  // Turnos y Tracking de Kilometraje
  getTurnoActivo: async (choferId?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/choferes/turno/activo', { params: choferId ? { choferId } : undefined });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener turno activo',
      };
    }
  },

  iniciarTurno: async (data: { odometroInicio?: number; observaciones?: string; choferId?: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/choferes/turno/iniciar', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al iniciar turno',
      };
    }
  },

  finalizarTurno: async (data: { odometroFin?: number; observaciones?: string; choferId?: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/choferes/turno/finalizar', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al finalizar turno',
      };
    }
  },

  getResumenCierreTurno: async (params?: { choferId?: string; turnoId?: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/choferes/turno/resumen-cierre', { params });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener resumen de arqueo de turno',
      };
    }
  },

  calificarPasajero: async (
    viajeId: string,
    data: { estrellas: number; tags?: string[]; comentario?: string; pasajeroConflictivo?: boolean }
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/choferes/viajes/${viajeId}/calificar-pasajero`, data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al calificar pasajero',
      };
    }
  },

  anotarseParadaVirtual: async (choferId?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/choferes/parada-virtual/anotarse', { choferId });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al anotarse en la parada virtual',
      };
    }
  },

  salirParadaVirtual: async (choferId?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/choferes/parada-virtual/salir', { choferId });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al salir de la parada virtual',
      };
    }
  },

  getEstadoParadaVirtual: async (choferId?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/choferes/parada-virtual/estado', { params: choferId ? { choferId } : undefined });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener estado de parada virtual',
      };
    }
  },

  crearViajeCalle: async (data: {
    origen?: string;
    destino?: string;
    origenDetallado?: string;
    destinoDetallado?: string;
    clienteNombre?: string;
    clienteTelefono?: string;
    pinPasajero?: string;
    precioInicial?: number;
  }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/choferes/viaje-calle', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al iniciar viaje de calle',
      };
    }
  },

  actualizarKmTurno: async (data: { kmConPasajeroDelta?: number; kmSinPasajeroDelta?: number; choferId?: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch('/choferes/turno/actualizar-km', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar km del turno',
      };
    }
  },

  // Gastos del Chofer
  getMisGastos: async (params?: { tipo?: string; fechaDesde?: string; fechaHasta?: string; choferId?: string }): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/choferes/gastos', { params });
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener gastos',
      };
    }
  },

  crearGasto: async (data: {
    tipo: 'COMBUSTIBLE' | 'REPARACION' | 'MANTENIMIENTO' | 'PEAJE' | 'LAVADO' | 'OTRO';
    subtipoCombustible?: 'NAFTA_GASOIL' | 'GNC';
    monto: number;
    kilometraje?: number;
    litros?: number;
    descripcion?: string;
    comprobanteUrl?: string;
    fecha?: string;
    choferId?: string;
  }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/choferes/gastos', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al registrar gasto',
      };
    }
  },

  eliminarGasto: async (gastoId: string, choferId?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.delete(`/choferes/gastos/${gastoId}`, { params: choferId ? { choferId } : undefined });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al eliminar gasto',
      };
    }
  },

  getResumenFinanciero: async (params?: { fechaDesde?: string; fechaHasta?: string; choferId?: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/choferes/resumen-financiero', { params });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener resumen financiero',
      };
    }
  },

  // Auto-registro y Aprobación
  verificarDni: async (dni: string): Promise<ApiResponse<any>> => {
    try {
      const cleanDni = dni.replace(/\D/g, '');
      const response = await api.get(`/auth/verificar-dni/${cleanDni}`);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || error.response?.data?.message || 'No se pudo verificar el DNI en ARCA / AFIP',
      };
    }
  },

  registroPublico: async (data: any): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/choferes/registro', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al enviar registro de chofer',
      };
    }
  },

  getRemiseriasDisponibles: async (): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/choferes/remiserias-disponibles');
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener remiserías',
      };
    }
  },

  aprobar: async (
    id: string,
    data?: { comisionPorcentaje?: number; vehiculoId?: string; numeroChofer?: string }
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch(`/choferes/${id}/aprobar`, data || {});
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al aprobar chofer',
      };
    }
  },

  rechazar: async (id: string, motivoRechazo?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch(`/choferes/${id}/rechazar`, { motivoRechazo });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al rechazar solicitud',
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

      const response = await fetch(`${getApiBaseUrl()}/app-usage/track`, {
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

      const response = await fetch(`${getApiBaseUrl()}/app-usage/stats?period=${period}`, {
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

  verificarDni: async (dni: string): Promise<ApiResponse<any>> => {
    try {
      const cleanDni = dni.replace(/\D/g, '');
      const response = await api.get(`/auth/verificar-dni/${cleanDni}`);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || error.response?.data?.message || 'No se pudo verificar el DNI en ARCA / AFIP',
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
  },

  buscarClientePorDni: async (dni: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get(`/cliente/buscar-dni/${dni}`);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al buscar cliente',
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

  getViajesHistorial: async (params?: {
    estado?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    limit?: number;
  }): Promise<ApiResponse<any[]>> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.estado) queryParams.append('estado', params.estado);
      if (params?.fechaDesde) queryParams.append('fechaDesde', params.fechaDesde);
      if (params?.fechaHasta) queryParams.append('fechaHasta', params.fechaHasta);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      const query = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const response = await api.get(`/coordinator-dashboard/viajes/historial${query}`);
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar historial de viajes',
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

  asignarViaje: async (
    viajeId: string,
    data: { choferId: string; vehiculoId?: string }
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch(`/coordinator-dashboard/viajes/${viajeId}/asignar`, data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al asignar el viaje',
      };
    }
  },

  actualizarEstadoViaje: async (
    viajeId: string,
    estado: string
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch(`/coordinator-dashboard/viajes/${viajeId}/estado`, { estado });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar estado del viaje',
      };
    }
  },

  createCliente: async (data: any): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/coordinator-dashboard/clientes', data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear cliente',
      };
    }
  },

  calcularPrecio: async (origen: string, destino: string, coords?: { latOrigen?: number; lonOrigen?: number; latDestino?: number; lonDestino?: number; artEmpresaId?: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/coordinator-dashboard/viajes/calcular-precio', { 
        origen, 
        destino,
        latOrigen: coords?.latOrigen,
        lonOrigen: coords?.lonOrigen,
        latDestino: coords?.latDestino,
        lonDestino: coords?.lonDestino,
        artEmpresaId: coords?.artEmpresaId
      });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al calcular precio',
      };
    }
  },

  geocode: async (q: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/coordinator-dashboard/geocode', { params: { q } });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al buscar direcciones',
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

  // Datos de la Remisería asignada al coordinador
  getMiRemiseria: async (): Promise<ApiResponse<Remiseria>> => {
    try {
      const response = await api.get('/coordinator-dashboard/mi-remiseria');
      return handleApiResponse<Remiseria>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar datos de la remisería',
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

  getLiquidacionesPendientes: async (choferId: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get(`/coordinator-dashboard/liquidaciones/pendientes/${choferId}`);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar liquidaciones pendientes',
      };
    }
  },

  crearLiquidacion: async (payload: { choferId: string; combustible: number; observaciones?: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/coordinator-dashboard/liquidaciones/crear', payload);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al registrar liquidación',
      };
    }
  },

  getResumenCoordinador: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/coordinator-dashboard/liquidaciones/resumen-coordinador');
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar resumen del turno',
      };
    }
  },

  getHistorialDuenio: async (): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/coordinator-dashboard/liquidaciones/duenio/historial');
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar historial de liquidaciones',
      };
    }
  },

  getHistorialChofer: async (): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/coordinator-dashboard/liquidaciones/chofer/historial');
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar historial de liquidaciones del chofer',
      };
    }
  },

  // Despacho Óptimo por Lotes (Batch Matching tipo Uber)
  getDespachoOptimo: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/coordinator-dashboard/despacho-optimo');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al calcular lote óptimo',
      };
    }
  },

  aplicarDespachoOptimo: async (matches: Array<{ viajeId: string; choferId: string; vehiculoId?: string | null }>): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/coordinator-dashboard/despacho-optimo/aplicar', { matches });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al aplicar asignaciones en lote',
      };
    }
  },

  // 1. Búsqueda predictiva de pasajeros habituales por teléfono o nombre
  searchClientesPredictivo: async (q: string): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get(`/coordinator-dashboard/clientes/predictivo?q=${encodeURIComponent(q)}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al buscar clientes',
      };
    }
  },

  // 2. Carga ultrarrápida de viaje telefónico (< 5s)
  crearViajeExpress: async (data: any): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post('/coordinator-dashboard/viajes/express', data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al crear viaje express',
      };
    }
  },

  // 3. Reasignación rápida de móvil en caliente (1 clic)
  reasignarViaje: async (id: string, data: { nuevoChoferId: string; nuevoVehiculoId?: string; motivo?: string }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch(`/coordinator-dashboard/viajes/${id}/reasignar`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al reasignar el viaje',
      };
    }
  },

  // 4. Auditoría de cancelaciones
  getAuditoriaCancelaciones: async (params?: { fechaDesde?: string; fechaHasta?: string; canceladoPor?: string }): Promise<ApiResponse<any>> => {
    try {
      const query = new URLSearchParams(params as any).toString();
      const response = await api.get(`/coordinator-dashboard/auditoria/cancelaciones${query ? `?${query}` : ''}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener auditoría de cancelaciones',
      };
    }
  },

  // 5. Configuración de tarifas especiales (Lluvia, Nocturna, Feriado)
  getConfiguracionTarifas: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/coordinator-dashboard/tarifas');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener tarifas',
      };
    }
  },

  updateConfiguracionTarifas: async (data: any): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch('/coordinator-dashboard/tarifas', data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar tarifas',
      };
    }
  },
};

// Servicios de reportes para el Dueño

export const duenioReportesService = {
  getMisRemiserias: async (): Promise<ApiResponse<{ id: string; nombre: string }[]>> => {
    try {
      const response = await api.get('/reportes/mis-remiserias');
      return handleApiResponse<{ id: string; nombre: string }[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar remiserías del dueño',
      };
    }
  },

  getInformeDiario: async (remiseriaId?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/reportes/diario', { params: { remiseriaId } });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar informe diario',
      };
    }
  },

  getInformeSemanal: async (remiseriaId?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/reportes/semanal', { params: { remiseriaId } });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar informe semanal',
      };
    }
  },

  getInformeMensual: async (remiseriaId?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get('/reportes/mensual', { params: { remiseriaId } });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar informe mensual',
      };
    }
  },

  getInformeChoferes: async (remiseriaId?: string): Promise<ApiResponse<any[]>> => {
    try {
      const response = await api.get('/reportes/choferes', { params: { remiseriaId } });
      return handleApiResponse<any[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al cargar liquidación de choferes',
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
        message: formatEmergencyError(error, 'solicitar tu remís', true),
      };
    }
  },

  // Cálculo de precio
  calcularPrecio: async (
    origen: string,
    destino: string,
    latitudOrigen?: number,
    longitudOrigen?: number,
    latitudDestino?: number,
    longitudDestino?: number,
    paradas?: Array<{ direccion: string; lat?: number; lon?: number }>,
    clienteId?: string,
    metodoPago?: string
  ): Promise<ApiResponse<CalculoPrecioData & { esTarifaDiferenciada?: boolean }>> => {
    try {
      const response = await api.post('/cliente/viajes/calcular-precio', {
        origen,
        destino,
        latitudOrigen,
        longitudOrigen,
        latitudDestino,
        longitudDestino,
        paradas,
        clienteId,
        metodoPago
      });
      return handleApiResponse<CalculoPrecioData & { esTarifaDiferenciada?: boolean }>(response);
    } catch (error: any) {
      return {
        success: false,
        message: formatEmergencyError(error, 'cotizar el viaje', true),
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
        message: formatEmergencyError(error, 'confirmar tu reserva', true),
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
        message: formatEmergencyError(error, 'cargar tus viajes', false),
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
        message: formatEmergencyError(error, 'cargar tus reservas', false),
      };
    }
  },

  // Cancelar viaje con motivo opcional
  cancelarViaje: async (viajeId: string, motivo?: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch(`/cliente/viajes/${viajeId}/cancelar`, { motivo });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: formatEmergencyError(error, 'cancelar el viaje', true),
      };
    }
  },

  // Calificar viaje completado
  calificarViaje: async (
    viajeId: string,
    data: { estrellasChofer: number; estrellasVehiculo: number; tags?: string[]; comentario?: string }
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/cliente/viajes/${viajeId}/calificar`, data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: formatEmergencyError(error, 'enviar tu calificación', false),
      };
    }
  },

  // Agregar parada intermedia dinámicamente
  agregarParada: async (
    viajeId: string,
    data: { direccion: string; lat?: number; lon?: number }
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/cliente/viajes/${viajeId}/paradas`, data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: formatEmergencyError(error, 'agregar la parada', true),
      };
    }
  },

  // Chat rápido / mensajería predefinida
  enviarMensajeChat: async (viajeId: string, texto: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/cliente/viajes/${viajeId}/chat`, { texto });
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: formatEmergencyError(error, 'enviar el mensaje', false),
      };
    }
  },

  // Botón SOS de emergencia
  enviarAlertaSOS: async (viajeId: string, coords?: { lat: number; lon: number }): Promise<ApiResponse<any>> => {
    try {
      const response = await api.post(`/cliente/viajes/${viajeId}/sos`, coords || {});
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: formatEmergencyError(error, 'emitir alerta SOS', true),
      };
    }
  },

  // Obtener datos públicos de tracking en tiempo real
  getViajeTracking: async (token: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.get(`/cliente/tracking/${token}`);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al consultar tracking',
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

  // Obtener disponibilidad de vehículos y demora estimada
  getDisponibilidad: async (): Promise<
    ApiResponse<{
      hayAutosDisponibles: boolean;
      autosDisponibles: number;
      autosEnViaje: number;
      choferesConectados: number;
      totalVehiculosActivos: number;
      viajesPendientes: number;
      todosOcupados: boolean;
      demoraMin: number;
      demoraMax: number;
    }>
  > => {
    try {
      const response = await api.get('/cliente/disponibilidad');
      return handleApiResponse(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al consultar disponibilidad',
      };
    }
  },

  // Perfil del cliente
  getProfile: async (): Promise<ApiResponse<Cliente>> => {
    try {
      const response = await api.get('/cliente/profile');
      return handleApiResponse<Cliente>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al obtener perfil',
      };
    }
  },

  updateProfile: async (data: any): Promise<ApiResponse<Cliente>> => {
    try {
      const response = await api.put('/cliente/profile', data);
      return handleApiResponse<Cliente>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al actualizar perfil',
      };
    }
  },
};

// Servicio para gestión de ART y Facturación Corporativa
export const artEmpresaService = {
  getAll: async (params?: { remiseriaId?: string; activas?: boolean }): Promise<ApiResponse<ArtEmpresa[]>> => {
    try {
      const response = await api.get('/art-empresas', { params });
      return handleApiResponse<ArtEmpresa[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al obtener ARTs',
      };
    }
  },

  getById: async (id: string): Promise<ApiResponse<ArtEmpresa>> => {
    try {
      const response = await api.get(`/art-empresas/${id}`);
      return handleApiResponse<ArtEmpresa>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al obtener detalle de ART',
      };
    }
  },

  create: async (data: CreateArtEmpresaData): Promise<ApiResponse<ArtEmpresa>> => {
    try {
      const response = await api.post('/art-empresas', data);
      return handleApiResponse<ArtEmpresa>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al crear ART',
      };
    }
  },

  update: async (id: string, data: UpdateArtEmpresaData): Promise<ApiResponse<ArtEmpresa>> => {
    try {
      const response = await api.put(`/art-empresas/${id}`, data);
      return handleApiResponse<ArtEmpresa>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al actualizar ART',
      };
    }
  },

  toggleActivo: async (id: string): Promise<ApiResponse<ArtEmpresa>> => {
    try {
      const response = await api.patch(`/art-empresas/${id}/toggle-activo`);
      return handleApiResponse<ArtEmpresa>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al alternar estado de ART',
      };
    }
  },

  delete: async (id: string): Promise<ApiResponse<any>> => {
    try {
      const response = await api.delete(`/art-empresas/${id}`);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al eliminar ART',
      };
    }
  },

  getFacturacion: async (params?: {
    artEmpresaId?: string;
    desde?: string;
    hasta?: string;
    estado?: string;
    remiseriaId?: string;
  }): Promise<ApiResponse<FacturacionArtResponse>> => {
    try {
      const response = await api.get('/art-empresas/facturacion', { params });
      return handleApiResponse<FacturacionArtResponse>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al obtener reporte de facturación',
      };
    }
  },

  asignarViajeArt: async (
    viajeId: string,
    data: { artEmpresaId?: string | null; numeroSiniestro?: string; recalcularTarifa?: boolean }
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await api.patch(`/art-empresas/viajes/${viajeId}/asignar`, data);
      return handleApiResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al asignar viaje a ART',
      };
    }
  }
};

// Servicio exclusivo del Dueño para Clientes y Cuenta Corriente
export const duenioClienteService = {
  getClientes: async (params?: { q?: string; filtroCC?: string }): Promise<ApiResponse<Cliente[]>> => {
    try {
      const response = await api.get('/duenios/clientes/listado', { params });
      return handleApiResponse<Cliente[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al obtener clientes',
      };
    }
  },

  toggleCuentaCorriente: async (
    id: string,
    data: {
      habilitada?: boolean;
      limite?: number;
      tipoTarifa?: 'LISTA_NORMAL' | 'PERSONALIZADA';
      tarifaValorKm?: number;
      tarifaPrecioTramo?: number;
      tarifaValorHoraEspera?: number;
      pagaChoferTipo?: 'LISTA_NORMAL' | 'PERSONALIZADO';
      choferValorKm?: number;
      choferPrecioTramo?: number;
      choferValorHoraEspera?: number;
    }
  ): Promise<ApiResponse<Cliente>> => {
    try {
      const response = await api.patch(`/duenios/clientes/${id}/cuenta-corriente`, data);
      return handleApiResponse<Cliente>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al actualizar cuenta corriente',
      };
    }
  },

  getViajesCliente: async (id: string): Promise<ApiResponse<{ cliente: Cliente; viajes: Viaje[]; pagos?: PagoCuentaCorriente[] }>> => {
    try {
      const response = await api.get(`/duenios/clientes/${id}/viajes`);
      return handleApiResponse<{ cliente: Cliente; viajes: Viaje[]; pagos?: PagoCuentaCorriente[] }>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al obtener viajes del cliente',
      };
    }
  },

  registrarPago: async (
    id: string,
    data: { monto: number; metodoPago?: string; observaciones?: string }
  ): Promise<ApiResponse<{ cliente: Cliente; pago: PagoCuentaCorriente; esPagoParcial: boolean }>> => {
    try {
      const response = await api.post(`/duenios/clientes/${id}/pago`, data);
      return handleApiResponse<{ cliente: Cliente; pago: PagoCuentaCorriente; esPagoParcial: boolean }>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || 'Error al registrar abono',
      };
    }
  }
};

export default api;
