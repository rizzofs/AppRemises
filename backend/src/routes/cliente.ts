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
  getUbicacionActual
} from '../controllers/clienteController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Rutas públicas
router.post('/register', registerCliente);
router.post('/viajes/calcular-precio', calcularPrecio);

// Rutas protegidas
router.get('/profile', authenticateToken, getClienteProfile);
router.put('/profile', authenticateToken, updateClienteProfile);
router.get('/viajes', authenticateToken, getClienteViajes);
router.get('/reservas', authenticateToken, getClienteReservas);

// Nuevas rutas para funcionalidades del cliente
router.post('/viajes/solicitar', authenticateToken, solicitarViaje);
router.post('/reservas', authenticateToken, crearReserva);
router.patch('/viajes/:id/cancelar', authenticateToken, cancelarViaje);
router.patch('/reservas/:id/cancelar', authenticateToken, cancelarReserva);
router.get('/ubicacion-actual', authenticateToken, getUbicacionActual);

export default router; 