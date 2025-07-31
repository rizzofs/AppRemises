import express from 'express';
import { coordinadorController } from '../controllers/coordinadorController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);

// Obtener todos los coordinadores
router.get('/', coordinadorController.getAll);

// Obtener coordinadores por remisería
router.get('/remiseria/:remiseriaId', coordinadorController.getByRemiseria);

// Obtener coordinador por ID
router.get('/:id', coordinadorController.getById);

// Crear coordinador
router.post('/', coordinadorController.create);

// Actualizar coordinador
router.put('/:id', coordinadorController.update);

// Baja lógica del coordinador
router.delete('/:id', coordinadorController.delete);

// Cambiar estado del coordinador
router.patch('/:id/toggle-status', coordinadorController.toggleStatus);

export default router; 