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
const NOVA_PASSWORD    = 'nova@0099';
const SALT_ROUNDS      = 12;

async function main() {
  // ── Seed roles ──────────────────────────────────────────────────────────────
  const mergerRole = await prisma.role.upsert({
    where:  { name: 'merger' },
    update: {},
    create: { name: 'merger' },
  });

  const developerRole = await prisma.role.upsert({
    where:  { name: 'developer' },
    update: {},
    create: { name: 'developer' },
  });

  console.log(`\n✓ Seeded roles: merger (id=${mergerRole.id}), developer (id=${developerRole.id})`);

  // ── Seed default admin user from env ────────────────────────────────────────
  const email = process.env.SEED_USER_EMAIL;
  const name  = process.env.SEED_USER_NAME || 'Dashboard User';

  if (!email) {
    throw new Error('SEED_USER_EMAIL is not set in .env — cannot seed without an email.');
  }

  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where:  { email },
    update: {
      name,
      password:           defaultHash,
      mustChangePassword: true,
      isActive:           true,
      roleId:             mergerRole.id,
    },
    create: {
      email,
      name,
      password:           defaultHash,
      mustChangePassword: true,
      isActive:           true,
      roleId:             mergerRole.id,
    },
  });

  console.log(`\n✓ Seeded user:`);
  console.log(`  Id:    ${user.id}  Email: ${user.email}  Role: merger`);

  // ── Seed additional developer users ─────────────────────────────────────────
  const novaHash = await bcrypt.hash(NOVA_PASSWORD, SALT_ROUNDS);

  const additionalUsers = [
    { email: 'priyankapaluri@outlook.com', name: 'Priyanka Paluri' },
    { email: 'thendralarasan.18@outlook.com', name: 'Thendralarasan' },
  ];

  for (const u of additionalUsers) {
    const seeded = await prisma.user.upsert({
      where:  { email: u.email },
      update: {
        name:               u.name,
        password:           novaHash,
        mustChangePassword: false,
        isActive:           true,
        roleId:             developerRole.id,
      },
      create: {
        email:              u.email,
        name:               u.name,
        password:           novaHash,
        mustChangePassword: false,
        isActive:           true,
        roleId:             developerRole.id,
      },
    });
    console.log(`  Id:    ${seeded.id}  Email: ${seeded.email}  Role: developer`);
  }

  console.log();
}

main()
  .catch(e => { console.error('Seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
