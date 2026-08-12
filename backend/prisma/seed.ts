import 'dotenv/config';
import {
  ACCOUNT_TYPE_CUSTOMER,
  ACCOUNT_TYPE_SUPPLIER,
  ROLE_ADMINISTRATOR,
  ROLE_EXTERNAL_CUSTOMER,
  ROLE_EXTERNAL_SUPPLIER,
  ROLE_OWNER_MANAGER,
  ROLE_STAFF,
} from '../src/constants/permissions';
import { hashPassword } from '../src/lib/password';
import { prisma } from '../src/lib/prisma';
import { ensureSystemRoles } from '../src/services/authService';

async function main() {
  const {
    ownerRole,
    administratorRole,
    staffRole,
    externalCustomerRole,
    externalSupplierRole,
  } = await ensureSystemRoles();

  const demoBusinessEmail = 'contact@demo-sme.local';
  let business = await prisma.business.findFirst({
    where: { email: demoBusinessEmail },
  });

  if (!business) {
    business = await prisma.business.create({
      data: {
        name: 'Demo SME Retail',
        email: demoBusinessEmail,
        phone: '+260000000000',
        address: 'Lusaka',
      },
    });
    console.log('Seeded demo business:', business.name);
  }

  const ownerEmail = 'owner@demo-sme.local';
  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });

  if (!existingOwner) {
    const ownerPasswordHash = await hashPassword('OwnerDemo1');
    const owner = await prisma.user.create({
      data: {
        businessId: business.id,
        email: ownerEmail,
        passwordHash: ownerPasswordHash,
        firstName: 'Alex',
        lastName: 'Owner',
        roles: {
          create: [{ roleId: ownerRole.id }],
        },
      },
    });
    console.log('Seeded demo owner:', owner.email);
    console.log('Owner password: OwnerDemo1');
    console.log('Owner role:', ROLE_OWNER_MANAGER);
  } else {
    console.log('Demo owner already exists:', ownerEmail);
  }

  const adminEmail = 'admin@demo-sme.local';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const adminPasswordHash = await hashPassword('AdminDemo1');
    const admin = await prisma.user.create({
      data: {
        businessId: business.id,
        email: adminEmail,
        passwordHash: adminPasswordHash,
        firstName: 'Sam',
        lastName: 'Admin',
        roles: {
          create: [{ roleId: administratorRole.id }],
        },
      },
    });
    console.log('Seeded demo administrator:', admin.email);
    console.log('Admin password: AdminDemo1');
    console.log('Admin role:', ROLE_ADMINISTRATOR);
  } else {
    console.log('Demo administrator already exists:', adminEmail);
  }

  const staffEmail = 'staff@demo-sme.local';
  const existingStaff = await prisma.user.findUnique({ where: { email: staffEmail } });

  if (!existingStaff) {
    const staffPasswordHash = await hashPassword('StaffDemo1');
    const staff = await prisma.user.create({
      data: {
        businessId: business.id,
        email: staffEmail,
        passwordHash: staffPasswordHash,
        firstName: 'Riley',
        lastName: 'Staff',
        roles: {
          create: [{ roleId: staffRole.id }],
        },
      },
    });
    console.log('Seeded demo staff:', staff.email);
    console.log('Staff password: StaffDemo1');
    console.log('Staff role:', ROLE_STAFF);
  } else {
    console.log('Demo staff already exists:', staffEmail);
  }

  const demoCustomerEmail = 'portal-customer@demo-sme.local';
  let demoCustomer = await prisma.customer.findFirst({
    where: {
      businessId: business.id,
      email: demoCustomerEmail,
    },
  });

  if (!demoCustomer) {
    demoCustomer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Demo Portal Customer',
        email: demoCustomerEmail,
        phone: '+260911000001',
      },
    });
    console.log('Seeded demo portal customer:', demoCustomer.name);
  }

  const customerEmail = 'customer@demo-sme.local';
  const existingCustomerUser = await prisma.user.findUnique({ where: { email: customerEmail } });

  if (!existingCustomerUser) {
    const customerPasswordHash = await hashPassword('CustomerDemo1');
    const customerUser = await prisma.user.create({
      data: {
        businessId: business.id,
        email: customerEmail,
        passwordHash: customerPasswordHash,
        firstName: 'Casey',
        lastName: 'Customer',
        accountType: ACCOUNT_TYPE_CUSTOMER,
        customerId: demoCustomer.id,
        roles: {
          create: [{ roleId: externalCustomerRole.id }],
        },
      },
    });
    console.log('Seeded demo external customer:', customerUser.email);
    console.log('Customer password: CustomerDemo1');
    console.log('Customer role:', ROLE_EXTERNAL_CUSTOMER);
  } else {
    console.log('Demo external customer already exists:', customerEmail);
  }

  const demoSupplierEmail = 'portal-supplier@demo-sme.local';
  let demoSupplier = await prisma.supplier.findFirst({
    where: {
      businessId: business.id,
      email: demoSupplierEmail,
    },
  });

  if (!demoSupplier) {
    demoSupplier = await prisma.supplier.create({
      data: {
        businessId: business.id,
        name: 'Demo Portal Supplier',
        email: demoSupplierEmail,
        phone: '+260911000002',
      },
    });
    console.log('Seeded demo portal supplier:', demoSupplier.name);
  }

  const supplierEmail = 'supplier@demo-sme.local';
  const existingSupplierUser = await prisma.user.findUnique({ where: { email: supplierEmail } });

  if (!existingSupplierUser) {
    const supplierPasswordHash = await hashPassword('SupplierDemo1');
    const supplierUser = await prisma.user.create({
      data: {
        businessId: business.id,
        email: supplierEmail,
        passwordHash: supplierPasswordHash,
        firstName: 'Sid',
        lastName: 'Supplier',
        accountType: ACCOUNT_TYPE_SUPPLIER,
        supplierId: demoSupplier.id,
        roles: {
          create: [{ roleId: externalSupplierRole.id }],
        },
      },
    });
    console.log('Seeded demo external supplier:', supplierUser.email);
    console.log('Supplier password: SupplierDemo1');
    console.log('Supplier role:', ROLE_EXTERNAL_SUPPLIER);
  } else {
    console.log('Demo external supplier already exists:', supplierEmail);
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
