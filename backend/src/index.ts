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
import artEmpresasRoutes from './routes/artEmpresas';

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
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      process.env.NODE_ENV !== 'production' ||
      /^https:\/\/([a-z0-9-]+\.)?brunoremises\.com\.ar$/i.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:[0-9]+)?$/i.test(origin) ||
      (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Bloqueado por CORS: ' + origin));
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 2000 : 20000, // Permitir más requests para evitar 429
  message: {
    success: false,
    message: 'Alta demanda en el sistema. Para pedir tu remís sin demoras, comunicate a nuestros teléfonos fijos: 2346-427637 o 2346-433000.',
    error: 'Alta demanda en el sistema. Comunicate a los teléfonos fijos 2346-427637 o 2346-433000.'
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
      message: 'No pudimos procesar los datos ingresados. Si necesitás pedir un auto de inmediato, comunicate a los teléfonos fijos 2346-427637 o 2346-433000.',
      error: 'No pudimos procesar los datos ingresados. Comunicate al 2346-427637 o 2346-433000.',
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
app.use('/api/art-empresas', artEmpresasRoutes);
app.use('/api/art', artEmpresasRoutes);

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
    message: 'No pudimos completar la solicitud en este momento. Por favor comunicate a nuestros teléfonos fijos: 2346-427637 o 2346-433000.',
    error: 'No pudimos completar la solicitud. Comunicate a los teléfonos fijos 2346-427637 o 2346-433000.'
  });
});

// Middleware para manejar errores globales
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error global:', error);
  
  res.status(500).json({
    success: false,
    message: 'Tuvimos un inconveniente técnico momentáneo. Para no perder tu viaje, comunicate a nuestros teléfonos fijos: 2346-427637 o 2346-433000.',
    error: 'Tuvimos un inconveniente técnico momentáneo. Comunicate a los teléfonos fijos 2346-427637 o 2346-433000.'
  });
});

// Iniciar servidor en 0.0.0.0 para acceso en red local (móvil) y localhost
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL Local: http://localhost:${PORT}`);
  console.log(`📱 Acceso Red Local/Móvil disponible en el puerto ${PORT}`);
});

export default app;
