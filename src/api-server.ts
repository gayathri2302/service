import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

import app from './app.js';
import { disconnectPrisma } from './lib/prisma.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`GitLab MR Dashboard API running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await disconnectPrisma();
    console.log('Prisma disconnected');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(async () => {
    await disconnectPrisma();
    console.log('Prisma disconnected');
    process.exit(0);
  });
});
