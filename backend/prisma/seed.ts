import 'dotenv/config';
import { ROLE_OWNER_MANAGER } from '../src/constants/permissions';
import { hashPassword } from '../src/lib/password';
import { prisma } from '../src/lib/prisma';
import { ensureOwnerManagerRole } from '../src/services/authService';

async function main() {
  const role = await ensureOwnerManagerRole();

  const demoEmail = 'owner@demo-sme.local';
  const existing = await prisma.user.findUnique({ where: { email: demoEmail } });

  if (existing) {
    console.log('Demo owner already exists:', demoEmail);
    return;
  }

  const passwordHash = await hashPassword('OwnerDemo1');

  const business = await prisma.business.create({
    data: {
      name: 'Demo SME Retail',
      email: 'contact@demo-sme.local',
      phone: '+260000000000',
      address: 'Lusaka',
    },
  });

  const user = await prisma.user.create({
    data: {
      businessId: business.id,
      email: demoEmail,
      passwordHash,
      firstName: 'Alex',
      lastName: 'Owner',
      roles: {
        create: [{ roleId: role.id }],
      },
    },
  });

  console.log('Seeded demo business:', business.name);
  console.log('Seeded demo owner:', user.email);
  console.log('Demo password: OwnerDemo1');
  console.log('Assigned role:', ROLE_OWNER_MANAGER);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
