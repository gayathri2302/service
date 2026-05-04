import prisma from '../lib/prisma.js';

export const AuthRepository = {

  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id:                 true,
        name:               true,
        email:              true,
        password:           true,
        isActive:           true,
        mustChangePassword: true,
      },
    });
  },

  findByResetToken(token: string) {
    return prisma.user.findFirst({
      where: {
        resetToken:        token,
        resetTokenExpires: { gt: new Date() },
      },
      select: { id: true },
    });
  },

  updatePassword(id: number, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: {
        password:           passwordHash,
        mustChangePassword: false,
      },
    });
  },

  saveResetToken(id: number, token: string, expires: Date) {
    return prisma.user.update({
      where: { id },
      data: { resetToken: token, resetTokenExpires: expires },
    });
  },

  clearResetTokenAndSetPassword(id: number, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: {
        password:           passwordHash,
        mustChangePassword: false,
        resetToken:         null,
        resetTokenExpires:  null,
      },
    });
  },

};
