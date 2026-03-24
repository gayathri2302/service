import { getPrisma } from '../lib/prisma.js';

export const AuthRepository = {

  findByEmail(email: string) {
    const prisma = getPrisma();
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
    const prisma = getPrisma();
    return prisma.user.findFirst({
      where: {
        resetToken:        token,
        resetTokenExpires: { gt: new Date() },
      },
      select: { id: true },
    });
  },

  updatePassword(id: number, passwordHash: string) {
    const prisma = getPrisma();
    return prisma.user.update({
      where: { id },
      data: {
        password:           passwordHash,
        mustChangePassword: false,
      },
    });
  },

  saveResetToken(id: number, token: string, expires: Date) {
    const prisma = getPrisma();
    return prisma.user.update({
      where: { id },
      data: { resetToken: token, resetTokenExpires: expires },
    });
  },

  clearResetTokenAndSetPassword(id: number, passwordHash: string) {
    const prisma = getPrisma();
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
