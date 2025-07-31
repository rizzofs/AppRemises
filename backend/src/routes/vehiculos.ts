import express from 'express';
import { vehiculoController } from '../controllers/vehiculoController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);

// Obtener todos los vehículos
router.get('/', vehiculoController.getAll);

// Obtener vehículos por remisería
router.get('/remiseria/:remiseriaId', vehiculoController.getByRemiseria);

// Obtener vehículo por ID
router.get('/:id', vehiculoController.getById);

// Crear vehículo
router.post('/', vehiculoController.create);

// Actualizar vehículo
router.put('/:id', vehiculoController.update);

// Baja lógica del vehículo
router.delete('/:id', vehiculoController.delete);

// Cambiar estado del vehículo
router.patch('/:id/status', vehiculoController.updateStatus);

export default router; 