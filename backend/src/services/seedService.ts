import {
  ACCOUNT_TYPE_CUSTOMER,
  ACCOUNT_TYPE_SUPPLIER,
  ROLE_ADMINISTRATOR,
  ROLE_EXTERNAL_CUSTOMER,
  ROLE_EXTERNAL_SUPPLIER,
  ROLE_OWNER_MANAGER,
  ROLE_STAFF,
} from '../constants/permissions';
import { hashPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { ensureSystemRoles } from './authService';
import { ensureDefaultProductCategories } from './categoryService';

export async function clearAllBusinessData() {
  await prisma.auditLog.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.business.deleteMany();
}

export async function seedAmFinancialSolutions() {
  const {
    ownerRole,
    administratorRole,
    staffRole,
    externalCustomerRole,
    externalSupplierRole,
  } = await ensureSystemRoles();

  const business = await prisma.business.create({
    data: {
      name: 'AM Financial Solutions',
      email: 'contact@amfinancial.local',
      phone: '+260211000000',
      address: 'Lusaka, Zambia',
    },
  });

  await ensureDefaultProductCategories(business.id);

  const [portalCustomer, customerTwo, customerThree] = await Promise.all([
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Grace Mwamba',
        email: 'grace.mwamba@example.local',
        phone: '+260977000001',
        address: 'Lusaka',
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'John Banda',
        email: 'john.banda@example.local',
        phone: '+260977000002',
        address: 'Ndola',
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Mary Phiri',
        email: 'mary.phiri@example.local',
        phone: '+260977000003',
        address: 'Kitwe',
      },
    }),
  ]);

  const supplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: 'Capital Supplies Ltd',
      email: 'orders@capitalsupplies.local',
      phone: '+260966000001',
      address: 'Lusaka Industrial Area',
    },
  });

  const [
    ownerPasswordHash,
    adminPasswordHash,
    staffPasswordHash,
    customerPasswordHash,
    supplierPasswordHash,
  ] = await Promise.all([
    hashPassword('OwnerPass1'),
    hashPassword('AdminPass1'),
    hashPassword('StaffPass1'),
    hashPassword('CustomerPass1'),
    hashPassword('SupplierPass1'),
  ]);

  const owner = await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'owner@amfinancial.local',
      passwordHash: ownerPasswordHash,
      firstName: 'Andrew',
      lastName: 'Mwanza',
      roles: { create: [{ roleId: ownerRole.id }] },
    },
  });

  const admin = await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'admin@amfinancial.local',
      passwordHash: adminPasswordHash,
      firstName: 'Alice',
      lastName: 'Mulenga',
      roles: { create: [{ roleId: administratorRole.id }] },
    },
  });

  const staff = await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'staff@amfinancial.local',
      passwordHash: staffPasswordHash,
      firstName: 'Brian',
      lastName: 'Zulu',
      roles: { create: [{ roleId: staffRole.id }] },
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'customer@amfinancial.local',
      passwordHash: customerPasswordHash,
      firstName: 'Grace',
      lastName: 'Mwamba',
      accountType: ACCOUNT_TYPE_CUSTOMER,
      customerId: portalCustomer.id,
      roles: { create: [{ roleId: externalCustomerRole.id }] },
    },
  });

  const supplierUser = await prisma.user.create({
    data: {
      businessId: business.id,
      email: 'supplier@amfinancial.local',
      passwordHash: supplierPasswordHash,
      firstName: 'Charles',
      lastName: 'Kapambwe',
      accountType: ACCOUNT_TYPE_SUPPLIER,
      supplierId: supplier.id,
      roles: { create: [{ roleId: externalSupplierRole.id }] },
    },
  });

  console.log('Seeded AM Financial Solutions demo accounts.');
  console.log(`${ROLE_OWNER_MANAGER}: ${owner.email} / OwnerPass1`);
  console.log(`${ROLE_ADMINISTRATOR}: ${admin.email} / AdminPass1`);
  console.log(`${ROLE_STAFF}: ${staff.email} / StaffPass1`);
  console.log(`${ROLE_EXTERNAL_CUSTOMER}: ${customerUser.email} / CustomerPass1`);
  console.log(`${ROLE_EXTERNAL_SUPPLIER}: ${supplierUser.email} / SupplierPass1`);
  console.log(
    'Customers:',
    portalCustomer.name,
    '|',
    customerTwo.name,
    '|',
    customerThree.name,
    '| Supplier:',
    supplier.name
  );
}

export async function seedIfEmpty() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    const businesses = await prisma.business.findMany({ select: { id: true } });
    for (const business of businesses) {
      await ensureDefaultProductCategories(business.id);
    }
    return;
  }

  console.log('No users found. Seeding AM Financial Solutions demo data...');
  await seedAmFinancialSolutions();
}
