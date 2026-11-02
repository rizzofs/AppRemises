import express from 'express';
import {
  registerCliente,
  getClienteProfile,
  updateClienteProfile,
  getClienteViajes,
  getClienteReservas,
  solicitarViaje,
  calcularPrecio,
  crearReserva,
  cancelarViaje,
  cancelarReserva,
  getUbicacionActual,
  buscarClientePorDni,
  getDisponibilidad,
  calificarViaje,
  agregarParadaEnCurso,
  enviarMensajeChat,
  enviarAlertaSOS,
  getViajeTracking
} from '../controllers/clienteController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Rutas públicas
router.post('/register', registerCliente);
router.post('/viajes/calcular-precio', calcularPrecio);
router.get('/buscar-dni/:dni', buscarClientePorDni);
router.get('/disponibilidad', getDisponibilidad);
router.get('/tracking/:token', getViajeTracking);

// Rutas protegidas
router.get('/profile', authenticateToken, getClienteProfile);
router.put('/profile', authenticateToken, updateClienteProfile);
router.get('/viajes', authenticateToken, getClienteViajes);
router.get('/reservas', authenticateToken, getClienteReservas);

// Funcionalidades avanzadas del cliente
router.post('/viajes/solicitar', authenticateToken, solicitarViaje);
router.post('/reservas', authenticateToken, crearReserva);
router.patch('/viajes/:id/cancelar', authenticateToken, cancelarViaje);
router.post('/viajes/:id/calificar', authenticateToken, calificarViaje);
router.post('/viajes/:id/paradas', authenticateToken, agregarParadaEnCurso);
router.post('/viajes/:id/chat', authenticateToken, enviarMensajeChat);
router.post('/viajes/:id/sos', authenticateToken, enviarAlertaSOS);
router.patch('/reservas/:id/cancelar', authenticateToken, cancelarReserva);
router.get('/ubicacion-actual', authenticateToken, getUbicacionActual);

export default router;