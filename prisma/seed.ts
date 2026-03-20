/**
 * Prisma seed — run with:  npm run db:seed
 *
 * Creates (or resets) a user. Password must be provided via SEED_USER_PASSWORD in .env.
 * The user will be forced to change it on first login (mustChangePassword = true).
 *
 * Configure via .env:
 *   SEED_USER_EMAIL=user@novastrid.com
 *   SEED_USER_NAME=User Name
 *   SEED_USER_PASSWORD=your_chosen_password
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  const email    = process.env.SEED_USER_EMAIL;
  const name     = process.env.SEED_USER_NAME || 'Dashboard User';
  const password = process.env.SEED_USER_PASSWORD;

  if (!email)    throw new Error('SEED_USER_EMAIL is not set in .env');
  if (!password) throw new Error('SEED_USER_PASSWORD is not set in .env');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

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
  console.log(`  Id:    ${user.id}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Name:  ${user.name}\n`);
}

main()
  .catch(e => { console.error('Seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
