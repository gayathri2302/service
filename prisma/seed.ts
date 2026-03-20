/**
 * Prisma seed — run with:  npm run db:seed
 *
 * Creates (or resets) a user with the default password Welcome@123.
 * The user will be forced to change it on first login (mustChangePassword = true).
 *
 * Configure via .env:
 *   SEED_USER_EMAIL=user@novastrid.com
 *   SEED_USER_NAME=User Name
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Welcome@123';
const SALT_ROUNDS      = 12;

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  const name  = process.env.SEED_USER_NAME || 'Dashboard User';

  if (!email) {
    throw new Error('SEED_USER_EMAIL is not set in .env — cannot seed without an email.');
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where:  { email },
    update: {
      name,
      password:           passwordHash,
      mustChangePassword: true,
      isActive:           true,
    },
    create: {
      email,
      name,
      password:           passwordHash,
      mustChangePassword: true,
      isActive:           true,
    },
  });

  console.log(`\n✓ Seeded user:`);
  console.log(`  Id:               ${user.id}`);
  console.log(`  Email:            ${user.email}`);
  console.log(`  Name:             ${user.name}`);
  console.log(`  Default password: ${DEFAULT_PASSWORD}`);
  console.log(`  Must change:      yes\n`);
}

main()
  .catch(e => { console.error('Seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
