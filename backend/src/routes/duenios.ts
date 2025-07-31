import { Router } from 'express';
import { 
  getAllDuenios, 
  getDuenioById, 
  createDuenio, 
  updateDuenio, 
  toggleDuenioStatus 
} from '../controllers/duenioController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { body } from 'express-validator';

const router = Router();

// Validaciones
const createDuenioValidation = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('telefono').notEmpty().withMessage('El teléfono es requerido')
];

const updateDuenioValidation = [
  body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
  body('telefono').optional().notEmpty().withMessage('El teléfono no puede estar vacío')
];

// Rutas públicas (requieren autenticación)
router.get('/', authenticateToken, getAllDuenios);
router.get('/:id', authenticateToken, getDuenioById);

// Rutas de administrador
router.post('/', authenticateToken, requireAdmin, createDuenioValidation, createDuenio);
router.put('/:id', authenticateToken, updateDuenioValidation, updateDuenio);
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, toggleDuenioStatus);

export default router; 