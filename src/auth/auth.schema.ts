import { z } from 'zod';

const emailField    = z.string({ required_error: 'Email is required' }).email('Invalid email address').toLowerCase().trim();
const passwordField = z.string({ required_error: 'Password is required' }).min(1, 'Password is required');
const newPasswordField = z
  .string({ required_error: 'New password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const LoginSchema = z.object({
  email:    emailField,
  password: passwordField,
});

export const ChangePasswordSchema = z.object({
  email:           emailField,
  currentPassword: z.string({ required_error: 'Current password is required' }).min(1),
  newPassword:     newPasswordField,
});

export const ForgotPasswordSchema = z.object({
  email: emailField,
});

export const ResetPasswordSchema = z.object({
  token:       z.string({ required_error: 'Token is required' }).min(1, 'Token is required'),
  newPassword: newPasswordField,
});

export type LoginInput          = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput  = z.infer<typeof ResetPasswordSchema>;
