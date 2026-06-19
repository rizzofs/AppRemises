import { Router } from 'express';
import { login, register, registerCliente, refreshToken, validateToken, forgotPassword, resetPassword } from '../controllers/authController';
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
router.post('/register-cliente', registerCliente);
router.post('/refresh', refreshToken);
router.get('/validate', validateToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router; 