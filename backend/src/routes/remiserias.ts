import { Router } from 'express';
import { 
  getAllRemiserias, 
  getRemiseriaById, 
  createRemiseria, 
  updateRemiseria, 
  deleteRemiseria 
} from '../controllers/remiseriaController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { body } from 'express-validator';

const router = Router();

// Validaciones
const createRemiseriaValidation = [
  body('nombreFantasia').notEmpty().withMessage('El nombre de fantasía es requerido'),
  body('razonSocial').notEmpty().withMessage('La razón social es requerida'),
  body('direccion').notEmpty().withMessage('La dirección es requerida'),
  body('telefono').notEmpty().withMessage('El teléfono es requerido')
];

const updateRemiseriaValidation = [
  body('nombreFantasia').optional().notEmpty().withMessage('El nombre de fantasía no puede estar vacío'),
  body('razonSocial').optional().notEmpty().withMessage('La razón social no puede estar vacía'),
  body('direccion').optional().notEmpty().withMessage('La dirección no puede estar vacía'),
  body('telefono').optional().notEmpty().withMessage('El teléfono no puede estar vacío')
];

// Rutas públicas (requieren autenticación)
router.get('/', authenticateToken, getAllRemiserias);
router.get('/:id', authenticateToken, getRemiseriaById);

// Rutas de administrador
router.post('/', authenticateToken, requireAdmin, createRemiseriaValidation, createRemiseria);
router.put('/:id', authenticateToken, updateRemiseriaValidation, updateRemiseria);
router.delete('/:id', authenticateToken, requireAdmin, deleteRemiseria);

export default router; 