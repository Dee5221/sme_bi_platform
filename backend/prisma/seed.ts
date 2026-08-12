import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import {
  clearAllBusinessData,
  seedAmFinancialSolutions,
} from '../src/services/seedService';

async function main() {
  await clearAllBusinessData();
  console.log('Cleared all businesses, users, and related records.');
  await seedAmFinancialSolutions();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
