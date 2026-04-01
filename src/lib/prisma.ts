import pkg from '../generated/prisma/index.js';
import type { PrismaClient as PrismaClientType } from '../generated/prisma/index.js';

const { PrismaClient } = pkg;

let prismaInstance: PrismaClientType | null = null;

export function getPrisma(): PrismaClientType {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      errorFormat: 'pretty',
    });
  }
  return prismaInstance;
}

export async function disconnectPrisma() {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

// Export default for backward compatibility
export default getPrisma();
