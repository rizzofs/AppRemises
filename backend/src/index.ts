import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { validationResult } from 'express-validator';
import http from 'http';
import { initSocket } from './lib/socket';

// Importar rutas
import authRoutes from './routes/auth';
import remiseriasRoutes from './routes/remiserias';
import dueniosRoutes from './routes/duenios';
import coordinadoresRoutes from './routes/coordinadores';
import choferesRoutes from './routes/choferes';
import vehiculosRoutes from './routes/vehiculos';
import appUsageRoutes from './routes/appUsage';
import coordinatorDashboardRoutes from './routes/coordinatorDashboard';
import clienteRoutes from './routes/cliente';
import reportesRoutes from './routes/reportes';


// Cargar variables de entorno
dotenv.config();

const app = express();
const server = http.createServer(app);

// Inicializar sockets
initSocket(server);

const PORT = process.env.PORT || 3001;

// Middleware de seguridad
app.use(helmet());

// Configuración de CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 2000 : 20000, // Permitir más requests para evitar 429
  message: {
    success: false,
    error: 'Demasiadas requests desde esta IP'
  }
});
app.use(limiter);


// Middleware para parsear JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware para manejar errores de validación
app.use((req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Datos inválidos',
      details: errors.array()
    });
  }
  next();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/remiserias', remiseriasRoutes);
app.use('/api/duenios', dueniosRoutes);
app.use('/api/coordinadores', coordinadoresRoutes);
app.use('/api/choferes', choferesRoutes);
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/app-usage', appUsageRoutes);
app.use('/api/coordinator-dashboard', coordinatorDashboardRoutes);
app.use('/api/cliente', clienteRoutes);
app.use('/api/reportes', reportesRoutes);


// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Middleware para manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// Middleware para manejar errores globales
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error global:', error);
  
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
});

export default app; 