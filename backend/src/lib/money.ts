import { Prisma } from '@prisma/client';

export function toMoneyNumber(value: Prisma.Decimal | number | string): number {
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

export function parseMoney(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}
