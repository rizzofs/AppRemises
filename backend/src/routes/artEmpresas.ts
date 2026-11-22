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

// Asignar viaje a ART o programar nuevo viaje ART
router.patch('/viajes/:viajeId/asignar', artEmpresaController.asignarViajeArt);
router.post('/viajes/programar', artEmpresaController.crearViajeArt);
router.get('/viajes/programados', artEmpresaController.getViajesArtProgramados);

// 1. Reasignar chofer por avería/rotura antes de salir
router.patch('/viajes/:viajeId/reasignar-chofer', artEmpresaController.reasignarChoferViajeArt);

// 2. Auxilio mecánico y trasbordo en viaje (rotura de vehículo en recorrido)
router.post('/viajes/:viajeId/auxilio-mecanico', artEmpresaController.auxilioMecanicoTrasbordo);

// 3. Modificar o anular siniestro por error de tipeo de la ART
router.patch('/viajes/:viajeId/siniestro', artEmpresaController.modificarSiniestroArt);
router.post('/viajes/:viajeId/anular-siniestro', artEmpresaController.anularViajeSiniestroArt);

// 4. Coordinación y contacto con el paciente (confirmar / desistimiento / no contesta)
router.patch('/viajes/:viajeId/coordinacion-paciente', artEmpresaController.actualizarCoordinacionPaciente);

// 5. Período actual de facturación de la ART (semanal, quincenal, mensual)
router.get('/:id/periodo-actual', artEmpresaController.getPeriodoActualArt);

// 6. Peajes abonados por el chofer
router.patch('/viajes/:viajeId/peajes', artEmpresaController.actualizarPeajesViajeArt);

// 7. Cierres de facturación y control riguroso de cobranzas
router.get('/cierres/listar', artEmpresaController.getCierresFacturacion);
router.post('/cierres/generar', artEmpresaController.generarCierreFacturacion);
router.patch('/cierres/:id/factura', artEmpresaController.registrarFacturaCierre);
router.patch('/cierres/:id/cobro', artEmpresaController.marcarCierreCobrado);
router.delete('/cierres/:id', artEmpresaController.anularCierreFacturacion);

export default router;
