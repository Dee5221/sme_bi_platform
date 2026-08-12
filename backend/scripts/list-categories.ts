import { prisma } from '../src/lib/prisma';
const cats = await prisma.productCategory.findMany({ orderBy: { name: 'asc' }, select: { name: true } });
console.log(cats.map((c) => c.name).join('\n'));
await prisma.$disconnect();
