// Seed standalone — crea (o resetea la contraseña de) un único perfil
// role: 'superadmin', sin business_id ni branch_id (no pertenece a ningún
// negocio). Requiere 002_superadmin_role.sql ya aplicado en la BD.
//
// Uso: npx ts-node prisma/seed-superadmin.ts
// Opcional: SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD como env vars,
// si no se pasan usa valores por defecto de desarrollo.

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const DEFAULT_EMAIL = 'superadmin@pippo.dev';
const DEFAULT_PASSWORD = 'superadmin-dev-2026';

async function main() {
  const email = process.env.SUPERADMIN_EMAIL ?? DEFAULT_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD ?? DEFAULT_PASSWORD;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const superadmin = await prisma.profile.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        role: 'superadmin',
        businessId: null,
        branchId: null,
        fullName: 'Superadmin',
      },
      update: {
        passwordHash,
        role: 'superadmin',
        businessId: null,
        branchId: null,
        isBanned: false,
      },
    });

    console.log('Superadmin listo:');
    console.log('  id:', superadmin.id);
    console.log('  email:', email);
    console.log('  password:', password);
    console.log('(Solo para dev — cambiar antes de cualquier uso real.)');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Error creando el superadmin:', err);
  process.exit(1);
});
