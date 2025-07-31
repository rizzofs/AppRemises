export interface User {
  id: string;
  email: string;
  rol: 'ADMIN' | 'DUENIO';
  duenio?: Duenio;
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