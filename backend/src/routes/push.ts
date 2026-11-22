import { Router } from 'express';
import { pushController } from '../controllers/pushController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Endpoint público para obtener la clave VAPID pública
router.get('/public-key', pushController.getPublicKey);

// Endpoints protegidos para gestionar la suscripción
router.post('/subscribe', authenticateToken, pushController.subscribe);
router.post('/unsubscribe', authenticateToken, pushController.unsubscribe);
router.post('/test', authenticateToken, pushController.enviarPrueba);

export default router;
