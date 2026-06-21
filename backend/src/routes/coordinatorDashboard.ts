import express from 'express';
import { coordinatorDashboardController } from '../controllers/coordinatorDashboardController';
import { liquidacionController } from '../controllers/liquidacionController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);

// Obtener viajes en curso
router.get('/viajes/en-curso', coordinatorDashboardController.getViajesEnCurso);

// Obtener viajes sin asignar
router.get('/viajes/sin-asignar', coordinatorDashboardController.getViajesSinAsignar);

// Obtener reservas activas
router.get('/reservas', coordinatorDashboardController.getViajesReservados);

// Crear nuevo viaje
router.post('/viajes', coordinatorDashboardController.createViaje);

// Crear nuevo cliente al vuelo
router.post('/clientes', coordinatorDashboardController.createCliente);

// Calcular precio del viaje
router.post('/viajes/calcular-precio', coordinatorDashboardController.calcularPrecio);

// Buscar direcciones en mapa
router.get('/geocode', coordinatorDashboardController.geocode);

// Crear nueva reserva
router.post('/reservas', coordinatorDashboardController.createReserva);

// Obtener vehículos en tiempo real
router.get('/vehiculos/tiempo-real', coordinatorDashboardController.getVehiculosTiempoReal);

// Obtener choferes en tiempo real
router.get('/choferes/tiempo-real', coordinatorDashboardController.getChoferesTiempoReal);

// Obtener estadísticas del dashboard
router.get('/stats', coordinatorDashboardController.getDashboardStats);

// Liquidaciones y Cierre de Caja
router.get('/liquidaciones/resumen-coordinador', liquidacionController.getResumenCoordinador);
router.get('/liquidaciones/duenio/historial', liquidacionController.getHistorialDuenio);
router.get('/liquidaciones/chofer/historial', liquidacionController.getHistorialChofer);
router.get('/liquidaciones/pendientes/:choferId', liquidacionController.getPendientes);
router.post('/liquidaciones/crear', liquidacionController.crear);

export default router; 