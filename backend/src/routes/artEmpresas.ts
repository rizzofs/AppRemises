import { Router } from 'express';
import { artEmpresaController } from '../controllers/artEmpresaController';
import { authenticateToken } from '../middleware/auth';
import { body } from 'express-validator';

const router = Router();

// Todas las rutas requieren token
router.use(authenticateToken);

// Validaciones
const createArtValidation = [
  body('nombre').notEmpty().withMessage('El nombre de la ART es requerido')
];

// Listado y consulta
router.get('/', artEmpresaController.getAll);
router.get('/facturacion', artEmpresaController.getFacturacion);
router.get('/:id', artEmpresaController.getById);

// Operaciones CRUD
router.post('/', createArtValidation, artEmpresaController.create);
router.put('/:id', artEmpresaController.update);
router.patch('/:id/toggle-activo', artEmpresaController.toggleActivo);
router.delete('/:id', artEmpresaController.delete);

// Asignar viaje a ART
router.patch('/viajes/:viajeId/asignar', artEmpresaController.asignarViajeArt);

export default router;
