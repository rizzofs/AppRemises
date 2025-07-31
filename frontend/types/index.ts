export interface User {
  id: string;
  email: string;
  rol: 'ADMIN' | 'DUENIO' | 'COORDINADOR' | 'CLIENTE';
  duenio?: Duenio;
  coordinador?: Coordinador;
  cliente?: Cliente;
}

export interface Duenio {
  id: string;
  nombre: string;
  telefono: string;
  dni: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    activo: boolean;
    createdAt: string;
  };
  remiserias?: RemiseriaDuenio[];
}

export interface Remiseria {
  id: string;
  nombreFantasia: string;
  razonSocial: string;
  cuit: string;
  direccion: string;
  telefono: string;
  estado: boolean;
  createdAt: string;
  updatedAt: string;
  duenios?: RemiseriaDuenio[];
  coordinadores?: Coordinador[];
  choferes?: Chofer[];
  vehiculos?: Vehiculo[];
  viajes?: Viaje[];
}

export interface RemiseriaDuenio {
  id: string;
  remiseriaId: string;
  duenioId: string;
  createdAt: string;
  remiseria?: Remiseria;
  duenio?: Duenio;
}

// Coordinador (solo nombre, email y contraseña)
export interface Coordinador {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  remiseriaId: string;
  remiseria?: Remiseria;
}

export interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  direccion: string;
  fechaNacimiento: string;
  genero?: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user?: User;
}

export interface CreateCoordinadorData {
  nombre: string;
  email: string;
  password: string;
  remiseriaId: string;
}

export interface UpdateCoordinadorData {
  nombre?: string;
  email?: string;
  password?: string;
  activo?: boolean;
}

// Chofer
export interface Chofer {
  id: string;
  numeroChofer: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email?: string;
  direccion?: string;
  categoriaLicencia: string;
  vtoLicencia: string;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'DADO_DE_BAJA';
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
  remiseriaId: string;
  remiseria?: Remiseria;
  viajes?: Viaje[];
  vehiculoId?: string;
  vehiculo?: Vehiculo;
}

export interface CreateChoferData {
  numeroChofer: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email?: string;
  direccion?: string;
  categoriaLicencia: string;
  vtoLicencia: string;
  remiseriaId: string;
  vehiculoId?: string;
}

export interface UpdateChoferData {
  numeroChofer?: string;
  nombre?: string;
  apellido?: string;
  dni?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  categoriaLicencia?: string;
  vtoLicencia?: string;
  estado?: 'ACTIVO' | 'SUSPENDIDO' | 'DADO_DE_BAJA';
  observaciones?: string;
  vehiculoId?: string;
}

// Vehículo
export interface Vehiculo {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  tipo: string;
  capacidad: number;
  estado: 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO';
  propietario: string;
  vtoVtv?: string;
  vtoMatafuego?: string;
  vtoSeguro?: string;
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
  remiseriaId: string;
  remiseria?: Remiseria;
  viajes?: Viaje[];
  choferes?: Chofer[];
}

export interface CreateVehiculoData {
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  tipo: string;
  capacidad: number;
  propietario: string;
  vtoVtv?: string;
  vtoMatafuego?: string;
  vtoSeguro?: string;
  observaciones?: string;
  remiseriaId: string;
}

export interface UpdateVehiculoData {
  patente?: string;
  marca?: string;
  modelo?: string;
  anio?: number;
  color?: string;
  tipo?: string;
  capacidad?: number;
  propietario?: string;
  vtoVtv?: string;
  vtoMatafuego?: string;
  vtoSeguro?: string;
  observaciones?: string;
  estado?: 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO';
}

// Viaje (recaudación)
export interface Viaje {
  id: string;
  origen: string;
  destino: string;
  precio: number;
  fecha: string;
  estado: 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADO' | 'CANCELADO';
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
  remiseriaId: string;
  choferId: string;
  vehiculoId: string;
  remiseria?: Remiseria;
  chofer?: Chofer;
  vehiculo?: Vehiculo;
}

export interface CreateViajeData {
  origen: string;
  destino: string;
  precio: number;
  fecha: string;
  observaciones?: string;
  remiseriaId: string;
  choferId: string;
  vehiculoId: string;
}

export interface UpdateViajeData {
  origen?: string;
  destino?: string;
  precio?: number;
  fecha?: string;
  estado?: 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADO' | 'CANCELADO';
  observaciones?: string;
  choferId?: string;
  vehiculoId?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nombre: string;
  telefono: string;
}

export interface CreateRemiseriaData {
  nombreFantasia: string;
  razonSocial: string;
  cuit: string;
  direccion: string;
  telefono: string;
  duenioIds: string[];
}

export interface UpdateRemiseriaData {
  nombreFantasia?: string;
  razonSocial?: string;
  cuit?: string;
  direccion?: string;
  telefono?: string;
  estado?: boolean;
  duenioIds?: string[];
}

export interface CreateDuenioData {
  email: string;
  password: string;
  nombre: string;
  telefono: string;
  dni: string;
  remiseriaIds?: string[];
}

export interface UpdateDuenioData {
  nombre?: string;
  telefono?: string;
  dni?: string;
  activo?: boolean;
  email?: string;
  password?: string;
  remiseriaIds?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Interfaces para el dashboard de coordinadores
export interface ViajeCoordinador {
  id: string;
  nombreCliente: string;
  telefonoCliente: string;
  direccionOrigen: string;
  direccionDestino: string;
  fechaHora: string;
  estado: 'pendiente' | 'en_curso' | 'completado' | 'cancelado';
  prioridad: 'normal' | 'alta' | 'urgente';
  metodoContacto: 'app' | 'telefono' | 'personal';
  choferAsignado?: string;
  vehiculoAsignado?: string;
  observaciones?: string;
  createdAt: string;
}

export interface ReservaCoordinador {
  id: string;
  nombreCliente: string;
  telefonoCliente: string;
  direccionOrigen: string;
  direccionDestino: string;
  fechaInicio: string;
  horaInicio: string;
  tipoReserva: 'unica' | 'periodica';
  fechaFin?: string;
  diasSemana?: string[];
  horaFin?: string;
  estado: 'activa' | 'completada' | 'cancelada';
  observaciones?: string;
  createdAt: string;
}

export interface VehiculoTiempoReal {
  id: string;
  patente: string;
  chofer: string;
  estado: 'disponible' | 'en_viaje' | 'fuera_servicio';
  ubicacion: {
    lat: number;
    lng: number;
  };
  ultimaActualizacion: string;
  direccionActual: string;
}

export interface ChoferTiempoReal {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  estado: 'disponible' | 'en_viaje' | 'fuera_servicio' | 'descanso';
  vehiculo?: {
    patente: string;
    modelo: string;
  };
  ubicacion?: {
    lat: number;
    lng: number;
    direccion: string;
  };
  ultimaActualizacion: string;
  viajesHoy: number;
  calificacion: number;
}

export interface CreateViajeCoordinadorData {
  nombreCliente: string;
  telefonoCliente: string;
  direccionOrigen: string;
  direccionDestino: string;
  fechaHora: string;
  tipoViaje: 'inmediato' | 'programado';
  observaciones: string;
  prioridad: 'normal' | 'alta' | 'urgente';
  metodoContacto: 'app' | 'telefono' | 'personal';
}

export interface CreateReservaData {
  nombreCliente: string;
  telefonoCliente: string;
  direccionOrigen: string;
  direccionDestino: string;
  fechaInicio: string;
  horaInicio: string;
  tipoReserva: 'unica' | 'periodica';
  fechaFin?: string;
  diasSemana?: string[];
  horaFin?: string;
  observaciones: string;
  prioridad: 'normal' | 'alta' | 'urgente';
  metodoContacto: 'app' | 'telefono' | 'personal';
}

export interface ReporteData {
  periodo: string;
  totalViajes: number;
  viajesCompletados: number;
  viajesCancelados: number;
  totalRecaudado: number;
  promedioCalificacion: number;
  choferesActivos: number;
  tiempoPromedioViaje: number;
  topChoferes: Array<{
    nombre: string;
    viajes: number;
    calificacion: number;
    recaudacion: number;
  }>;
  viajesPorHora: Array<{
    hora: string;
    cantidad: number;
  }>;
} 

// Tipos para funcionalidad del cliente
export interface SolicitudViajeData {
  origen: string;
  destino: string;
  fechaHora?: string; // Para viajes programados
  observaciones?: string;
  usarUbicacionActual?: boolean;
  latitudOrigen?: number;
  longitudOrigen?: number;
  latitudDestino?: number;
  longitudDestino?: number;
}

export interface CalculoPrecioData {
  origen: string;
  destino: string;
  distancia?: number;
  tiempoEstimado?: number;
  precioEstimado: number;
  tarifaBase: number;
  tarifaPorKm: number;
  tarifaPorMinuto: number;
}

export interface ReservaClienteData {
  origen: string;
  destino: string;
  fechaInicio: string;
  horaInicio: string;
  tipoReserva: 'unica' | 'periodica';
  fechaFin?: string;
  diasSemana?: string[];
  horaFin?: string;
  observaciones?: string;
  latitudOrigen?: number;
  longitudOrigen?: number;
  latitudDestino?: number;
  longitudDestino?: number;
}

export interface ViajeCliente {
  id: string;
  origen: string;
  destino: string;
  precio: number;
  fecha: string;
  estado: 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADO' | 'CANCELADO';
  observaciones?: string;
  createdAt: string;
  chofer?: {
    nombre: string;
    telefono: string;
    vehiculo?: {
      patente: string;
      marca: string;
      modelo: string;
    };
  };
  remiseria?: {
    nombreFantasia: string;
    telefono: string;
  };
}

export interface ReservaCliente {
  id: string;
  origen: string;
  destino: string;
  fechaInicio: string;
  horaInicio: string;
  tipoReserva: 'unica' | 'periodica';
  fechaFin?: string;
  diasSemana?: string[];
  horaFin?: string;
  estado: 'activa' | 'completada' | 'cancelada';
  observaciones?: string;
  createdAt: string;
  viajesGenerados?: ViajeCliente[];
} 