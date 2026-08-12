import { prisma } from '../src/lib/prisma';
import { ensureDefaultProductCategories } from '../src/services/categoryService';

async function main() {
  const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
  for (const business of businesses) {
    const result = await ensureDefaultProductCategories(business.id);
    console.log(business.name, result);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
