import express from 'express';
import { trackAppUsage, getAppUsageStats } from '../controllers/appUsageController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Ruta para trackear uso (requiere autenticación)
router.post('/track', authenticateToken, trackAppUsage);

// Ruta para obtener estadísticas (solo admin)
router.get('/stats', authenticateToken, getAppUsageStats);

export default router; 