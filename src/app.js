import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { env } from './config/env.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.APP_ORIGIN === '*' ? true : env.APP_ORIGIN }));
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp());
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
