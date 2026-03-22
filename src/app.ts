import express from 'express';
import cors from 'cors';
import authRouter      from './auth/auth.router.js';
import dashboardRouter from './dashboard/dashboard.router.js';
import { authLimiter, apiLimiter } from './lib/rateLimiter.js';
import { requireAuth }             from './middleware/authMiddleware.js';

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  process.env.APP_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authLimiter, authRouter);
app.use('/api',  apiLimiter, requireAuth, dashboardRouter);

export default app;
