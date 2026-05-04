import { PrismaClient } from '@prisma/client';

// Singleton — one connection pool for the whole server process
const prisma = new PrismaClient();

export default prisma;
