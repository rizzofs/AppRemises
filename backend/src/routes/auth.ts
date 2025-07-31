import { Router } from 'express';
import { login, register, refreshToken } from '../controllers/authController';
import { body } from 'express-validator';

const router = Router();

// Validaciones
const loginValidation = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
];

const registerValidation = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('telefono').notEmpty().withMessage('El teléfono es requerido')
];

// Rutas
router.post('/login', loginValidation, login);
router.post('/register', registerValidation, register);
router.post('/refresh', refreshToken);

export default router; 