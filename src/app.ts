import express from 'express';
import cors from 'cors';
import authRouter      from './auth/auth.router.js';
import dashboardRouter from './dashboard/dashboard.router.js';
import { authLimiter, apiLimiter } from './lib/rateLimiter.js';
import { requireAuth }             from './middleware/authMiddleware.js';

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authLimiter, authRouter);
app.use('/api',  apiLimiter, requireAuth, dashboardRouter);

export default app;
