import { Router } from 'express';
import { whatsappController } from '../controllers/whatsappController';

const router = Router();

// Handshake de verificación de Meta (GET)
router.get('/', whatsappController.verificarWebhook);

// Receptor de mensajes y eventos entrantes de Meta (POST)
router.post('/', whatsappController.recibirWebhook);

export default router;
