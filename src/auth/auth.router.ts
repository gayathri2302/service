import { Router } from 'express';
import { validate } from '../lib/validate.js';
import {
  LoginSchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from './auth.schema.js';
import { login, changePassword, forgotPassword, resetPassword } from './auth.controller.js';

const router = Router();

router.post('/login',           validate(LoginSchema),          login);
router.post('/change-password', validate(ChangePasswordSchema), changePassword);
router.post('/forgot-password', validate(ForgotPasswordSchema), forgotPassword);
router.post('/reset-password',  validate(ResetPasswordSchema),  resetPassword);

export default router;
