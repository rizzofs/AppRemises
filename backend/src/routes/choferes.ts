import express from 'express';
import { choferController } from '../controllers/choferController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Rutas públicas de auto-registro del chofer (sin token)
router.post('/registro', choferController.registroPublico);
router.get('/remiserias-disponibles', choferController.getRemiseriasDisponibles);

// Aplicar middleware de autenticación a todas las rutas protegidas
router.use(authenticateToken);

// Rutas de la App del Chofer (deben ir antes de /:id)
router.get('/mi-estado', choferController.getMiEstado);
router.get('/mis-viajes', choferController.getMisViajes);
router.get('/vehiculos-disponibles', choferController.getVehiculosDisponibles);
router.patch('/mi-perfil', choferController.updateMiPerfil);
router.patch('/online-status', choferController.updateOnlineStatus);
router.post('/viajes/:viajeId/aceptar', choferController.aceptarViaje);
router.patch('/viajes/:viajeId/estado', choferController.actualizarEstadoViaje);

// Rutas de Turno y Tracking de Kilometraje
router.get('/turno/activo', choferController.getTurnoActivo);
router.get('/turnos', choferController.getMisTurnos);
router.post('/turno/iniciar', choferController.iniciarTurno);
router.post('/turno/finalizar', choferController.finalizarTurno);
router.patch('/turno/actualizar-km', choferController.actualizarKmTurno);
router.post('/turno/pausa', choferController.togglePausa);

// Rutas de Gastos y Finanzas del Chofer
router.get('/gastos', choferController.getMisGastos);
router.post('/gastos', choferController.crearGasto);
router.delete('/gastos/:gastoId', choferController.eliminarGasto);
router.get('/resumen-financiero', choferController.getResumenFinanciero);

// Obtener todos los choferes
router.get('/', choferController.getAll);

// Obtener choferes por remisería
router.get('/remiseria/:remiseriaId', choferController.getByRemiseria);

// Obtener chofer por ID
router.get('/:id', choferController.getById);

// Crear chofer
router.post('/', choferController.create);

// Actualizar chofer
router.put('/:id', choferController.update);

// Baja lógica del chofer
router.delete('/:id', choferController.delete);

// Cambiar estado del chofer
router.patch('/:id/toggle-status', choferController.toggleStatus);

// Aprobar o rechazar solicitud de chofer (Dueño / Coordinador)
router.patch('/:id/aprobar', choferController.aprobarChofer);
router.patch('/:id/rechazar', choferController.rechazarChofer);

export default router; 