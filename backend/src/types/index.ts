import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    rol: 'ADMIN' | 'DUENIO' | 'COORDINADOR' | 'CLIENTE' | 'CHOFER';
    duenio?: {
      id: string;
      nombre: string;
      telefono: string;
      dni: string;
      userId: string;
    };
    coordinador?: {
      id: string;
      nombre: string;
      email: string;
      activo: boolean;
      remiseriaId: string;
      userId: string;
    };
    cliente?: {
      id: string;
      nombre: string;
      apellido: string;
      dni: string;
      telefono: string;
      email: string;
      direccion: string;
      fechaNacimiento: Date;
      genero?: string;
      activo: boolean;
      userId: string;
    };
    chofer?: {
      id: string;
      numeroChofer: string;
      nombre: string;
      apellido: string;
      remiseriaId: string;
    };
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nombre: string;
  telefono: string;
}

export interface CreateRemiseriaRequest {
  nombreFantasia: string;
  razonSocial: string;
  cuit: string;
  direccion: string;
  telefono: string;
  duenioIds: string[];
}

export interface UpdateRemiseriaRequest {
  nombreFantasia?: string;
  razonSocial?: string;
  cuit?: string;
  direccion?: string;
  telefono?: string;
  estado?: boolean;
  duenioIds?: string[];
  valorKm?: number;
  bajadaBandera?: number;
  valorHoraEspera?: number;
  comisionDuenioAuto?: number;
  comisionPorcentaje?: number;
}

export interface CreateDuenioRequest {
  email: string;
  password: string;
  nombre: string;
  telefono: string;
  dni: string;
  remiseriaIds?: string[];
}

export interface UpdateDuenioRequest {
  nombre?: string;
  telefono?: string;
  dni?: string;
  activo?: boolean;
  email?: string;
  password?: string;
  remiseriaIds?: string[];
}

export interface JwtPayload {
  id: string;
  email: string;
  rol: 'ADMIN' | 'DUENIO' | 'COORDINADOR' | 'CLIENTE' | 'CHOFER';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
} 