import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthRepository } from './auth.repository.js';
import { sendPasswordResetEmail } from '../lib/mailer.js';
import type {
  LoginInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth.schema.js';

const JWT_EXPIRES_IN = '8h';
const RESET_TTL_MS   = 60 * 60 * 1000; // 1 hour
const SALT_ROUNDS    = 12;

// ── POST /auth/login ────────────────────────────────────────────────────────

export async function login(req: Request<{}, {}, LoginInput>, res: Response) {
  try {
    const { email, password } = req.body;

    const user = await AuthRepository.findByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is inactive. Contact your administrator.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = {
      id:                 user.id,
      email:              user.email,
      name:               user.name,
      mustChangePassword: user.mustChangePassword,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });

    return res.json({ token, user: payload });
  } catch (e: any) {
    console.error('[auth] login error:', e.message);
    return res.status(500).json({ error: 'Login failed' });
  }
}

// ── POST /auth/change-password ──────────────────────────────────────────────

export async function changePassword(req: Request<{}, {}, ChangePasswordInput>, res: Response) {
  try {
    const { email, currentPassword, newPassword } = req.body;

    const user = await AuthRepository.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await AuthRepository.updatePassword(user.id, hash);

    return res.json({ message: 'Password changed successfully' });
  } catch (e: any) {
    console.error('[auth] change-password error:', e.message);
    return res.status(500).json({ error: 'Failed to change password' });
  }
}

// ── POST /auth/forgot-password ─────────────────────────────────────────────

export async function forgotPassword(req: Request<{}, {}, ForgotPasswordInput>, res: Response) {
  // Always 200 — never reveal whether the email exists
  res.json({ message: 'If that email exists, a reset link has been sent.' });

  try {
    const { email } = req.body;
    const user = await AuthRepository.findByEmail(email);
    if (!user || !user.isActive) return;

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TTL_MS);

    await AuthRepository.saveResetToken(user.id, token, expires);
    await sendPasswordResetEmail(user.email, user.name, token);
  } catch (e: any) {
    console.error('[auth] forgot-password error:', e.message);
  }
}

// ── POST /auth/reset-password ──────────────────────────────────────────────

export async function resetPassword(req: Request<{}, {}, ResetPasswordInput>, res: Response) {
  try {
    const { token, newPassword } = req.body;

    const user = await AuthRepository.findByResetToken(token);
    if (!user) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired' });
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await AuthRepository.clearResetTokenAndSetPassword(user.id, hash);

    return res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (e: any) {
    console.error('[auth] reset-password error:', e.message);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}
