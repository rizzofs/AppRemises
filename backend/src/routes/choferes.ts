import express from 'express';
import { choferController } from '../controllers/choferController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);

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

export default router; 