import { PrismaClient, RoleType, PartnerType, PartnerStatus, ProductStatus, WarehouseStatus, InventoryItemStatus } from '../../apps/backend/node_modules/.prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Roles
  console.log('Seeding Roles...');
  const roleTypes: RoleType[] = [
    RoleType.SUPPLIER,
    RoleType.DISTRIBUTOR,
    RoleType.DEALER,
    RoleType.DIRECT_DEALER,
    RoleType.ADMIN,
  ];

  const rolesMap: Record<string, string> = {};

  for (const roleType of roleTypes) {
    const role = await prisma.role.upsert({
      where: { name: roleType },
      update: {},
      create: {
        name: roleType,
        description: `Enterprise role for ${roleType}`,
      },
    });
    rolesMap[roleType] = role.id;
  }

  // 2. Seed RolePermissions Matrix
  console.log('Seeding RolePermissions Matrix...');
  const permissionMatrix: Array<{
    roleType: RoleType;
    permissions: Array<{ resource: string; action: string }>;
  }> = [
    {
      roleType: RoleType.ADMIN,
      permissions: [
        { resource: 'PRODUCT', action: 'CREATE' },
        { resource: 'PRODUCT', action: 'READ' },
        { resource: 'PRODUCT', action: 'UPDATE' },
        { resource: 'PRODUCT', action: 'DELETE' },
        { resource: 'INVENTORY', action: 'CREATE' },
        { resource: 'INVENTORY', action: 'READ' },
        { resource: 'INVENTORY', action: 'UPDATE' },
        { resource: 'INVENTORY', action: 'DELETE' },
        { resource: 'PARTNER', action: 'CREATE' },
        { resource: 'PARTNER', action: 'READ' },
        { resource: 'PARTNER', action: 'UPDATE' },
        { resource: 'PARTNER', action: 'DELETE' },
        { resource: 'ORDER', action: 'CREATE' },
        { resource: 'ORDER', action: 'READ' },
        { resource: 'ORDER', action: 'UPDATE' },
        { resource: 'ORDER', action: 'DELETE' },
        { resource: 'FINANCE', action: 'CREATE' },
        { resource: 'FINANCE', action: 'READ' },
        { resource: 'FINANCE', action: 'UPDATE' },
        { resource: 'FINANCE', action: 'DELETE' },
        { resource: 'CUSTOMER', action: 'CREATE' },
        { resource: 'CUSTOMER', action: 'READ' },
        { resource: 'CUSTOMER', action: 'UPDATE' },
        { resource: 'CUSTOMER', action: 'DELETE' },
        { resource: 'CATEGORY', action: 'CREATE' },
        { resource: 'CATEGORY', action: 'READ' },
        { resource: 'CATEGORY', action: 'UPDATE' },
        { resource: 'CATEGORY', action: 'DELETE' },
        { resource: 'WAREHOUSE', action: 'CREATE' },
        { resource: 'WAREHOUSE', action: 'READ' },
        { resource: 'WAREHOUSE', action: 'UPDATE' },
        { resource: 'WAREHOUSE', action: 'DELETE' },
      ],
    },
    {
      roleType: RoleType.SUPPLIER,
      permissions: [
        { resource: 'PRODUCT', action: 'CREATE' },
        { resource: 'PRODUCT', action: 'READ' },
        { resource: 'PRODUCT', action: 'UPDATE' },
        { resource: 'PRODUCT', action: 'DELETE' },
        { resource: 'INVENTORY', action: 'CREATE' },
        { resource: 'INVENTORY', action: 'READ' },
        { resource: 'INVENTORY', action: 'UPDATE' },
        { resource: 'INVENTORY', action: 'DELETE' },
        { resource: 'PARTNER', action: 'CREATE' },
        { resource: 'PARTNER', action: 'READ' },
        { resource: 'PARTNER', action: 'UPDATE' },
        { resource: 'ORDER', action: 'CREATE' },
        { resource: 'ORDER', action: 'READ' },
        { resource: 'ORDER', action: 'UPDATE' },
        { resource: 'FINANCE', action: 'CREATE' },
        { resource: 'FINANCE', action: 'READ' },
        { resource: 'FINANCE', action: 'UPDATE' },
        { resource: 'CUSTOMER', action: 'CREATE' },
        { resource: 'CUSTOMER', action: 'READ' },
        { resource: 'CUSTOMER', action: 'UPDATE' },
        { resource: 'CUSTOMER', action: 'DELETE' },
        { resource: 'CATEGORY', action: 'CREATE' },
        { resource: 'CATEGORY', action: 'READ' },
        { resource: 'CATEGORY', action: 'UPDATE' },
        { resource: 'CATEGORY', action: 'DELETE' },
        { resource: 'WAREHOUSE', action: 'CREATE' },
        { resource: 'WAREHOUSE', action: 'READ' },
        { resource: 'WAREHOUSE', action: 'UPDATE' },
        { resource: 'WAREHOUSE', action: 'DELETE' },
      ],
    },
    {
      roleType: RoleType.DISTRIBUTOR,
      permissions: [
        { resource: 'PRODUCT', action: 'READ' },
        { resource: 'CATEGORY', action: 'READ' },
        { resource: 'INVENTORY', action: 'CREATE' },
        { resource: 'INVENTORY', action: 'READ' },
        { resource: 'INVENTORY', action: 'UPDATE' },
        { resource: 'PARTNER', action: 'CREATE' },
        { resource: 'PARTNER', action: 'READ' },
        { resource: 'PARTNER', action: 'UPDATE' },
        { resource: 'ORDER', action: 'CREATE' },
        { resource: 'ORDER', action: 'READ' },
        { resource: 'ORDER', action: 'UPDATE' },
        { resource: 'FINANCE', action: 'READ' },
        { resource: 'WAREHOUSE', action: 'CREATE' },
        { resource: 'WAREHOUSE', action: 'READ' },
        { resource: 'WAREHOUSE', action: 'UPDATE' },
      ],
    },
    {
      roleType: RoleType.DEALER,
      permissions: [
        { resource: 'PRODUCT', action: 'READ' },
        { resource: 'CATEGORY', action: 'READ' },
        { resource: 'INVENTORY', action: 'READ' },
        { resource: 'INVENTORY', action: 'UPDATE' },
        { resource: 'PARTNER', action: 'READ' },
        { resource: 'ORDER', action: 'CREATE' },
        { resource: 'ORDER', action: 'READ' },
        { resource: 'FINANCE', action: 'READ' },
        { resource: 'CUSTOMER', action: 'CREATE' },
        { resource: 'CUSTOMER', action: 'READ' },
        { resource: 'CUSTOMER', action: 'UPDATE' },
        { resource: 'CUSTOMER', action: 'DELETE' },
        { resource: 'WAREHOUSE', action: 'READ' },
      ],
    },
    {
      roleType: RoleType.DIRECT_DEALER,
      permissions: [
        { resource: 'PRODUCT', action: 'READ' },
        { resource: 'CATEGORY', action: 'READ' },
        { resource: 'INVENTORY', action: 'READ' },
        { resource: 'INVENTORY', action: 'UPDATE' },
        { resource: 'PARTNER', action: 'READ' },
        { resource: 'ORDER', action: 'CREATE' },
        { resource: 'ORDER', action: 'READ' },
        { resource: 'FINANCE', action: 'READ' },
        { resource: 'CUSTOMER', action: 'CREATE' },
        { resource: 'CUSTOMER', action: 'READ' },
        { resource: 'CUSTOMER', action: 'UPDATE' },
        { resource: 'CUSTOMER', action: 'DELETE' },
        { resource: 'WAREHOUSE', action: 'READ' },
      ],
    },
  ];

  for (const entry of permissionMatrix) {
    const roleId = rolesMap[entry.roleType];
    for (const perm of entry.permissions) {
      const permissionKey = `${entry.roleType}:${perm.resource}:${perm.action}`;
      await prisma.rolePermission.upsert({
        where: { permissionKey },
        update: {
          roleId,
          resource: perm.resource,
          action: perm.action,
        },
        create: {
          roleId,
          resource: perm.resource,
          action: perm.action,
          permissionKey,
        },
      });
    }
  }

  // 3. Seed Partner Hierarchy
  console.log('Seeding Partner Hierarchy...');
  
  const supplier = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Apex Global Handsets Ltd',
      type: PartnerType.SUPPLIER,
      territory: 'National',
      address: '100 Tech Park, Silicon Bay',
      phone: '+1-800-555-0100',
      email: 'contact@apexglobal.com',
      creditLimit: 5000000.00,
      status: PartnerStatus.ACTIVE,
    },
  });

  const distributor = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Metro Wholesale Mobile Ltd',
      type: PartnerType.DISTRIBUTOR,
      parentPartnerId: supplier.id,
      territory: 'North Region',
      address: '45 Logistics Blvd, Metro City',
      phone: '+1-800-555-0200',
      email: 'orders@metrowholesale.com',
      creditLimit: 1000000.00,
      status: PartnerStatus.ACTIVE,
    },
  });

  const dealer = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Prime Electronics Retail',
      type: PartnerType.DEALER,
      parentPartnerId: distributor.id,
      territory: 'Downtown District',
      address: '12 Main Street, Cityville',
      phone: '+1-800-555-0300',
      email: 'info@primeretail.com',
      creditLimit: 250000.00,
      status: PartnerStatus.ACTIVE,
    },
  });

  const directDealer = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Direct Cellular Store',
      type: PartnerType.DIRECT_DEALER,
      parentPartnerId: supplier.id,
      territory: 'East Coast',
      address: '78 Ocean Avenue, Harbor City',
      phone: '+1-800-555-0400',
      email: 'sales@directcellular.com',
      creditLimit: 500000.00,
      status: PartnerStatus.ACTIVE,
    },
  });

  // 4. Seed Users with real bcrypt password hashes
  console.log('Seeding Sample Users...');
  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@apexglobal.com' },
    update: {
      passwordHash: defaultPasswordHash,
    },
    create: {
      email: 'admin@apexglobal.com',
      name: 'System Administrator',
      passwordHash: defaultPasswordHash,
      roleId: rolesMap[RoleType.ADMIN],
      partnerId: supplier.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'distributor@metrowholesale.com' },
    update: {
      passwordHash: defaultPasswordHash,
    },
    create: {
      email: 'distributor@metrowholesale.com',
      name: 'Metro Distributor Manager',
      passwordHash: defaultPasswordHash,
      roleId: rolesMap[RoleType.DISTRIBUTOR],
      partnerId: distributor.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'dealer@primeretail.com' },
    update: {
      passwordHash: defaultPasswordHash,
    },
    create: {
      email: 'dealer@primeretail.com',
      name: 'Prime Dealer Manager',
      passwordHash: defaultPasswordHash,
      roleId: rolesMap[RoleType.DEALER],
      partnerId: dealer.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'directdealer@cellular.com' },
    update: {
      passwordHash: defaultPasswordHash,
    },
    create: {
      email: 'directdealer@cellular.com',
      name: 'Direct Dealer Manager',
      passwordHash: defaultPasswordHash,
      roleId: rolesMap[RoleType.DIRECT_DEALER],
      partnerId: directDealer.id,
    },
  });

  // 5. Seed Category & Products
  console.log('Seeding Category & Products...');
  const category = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Smartphones',
      description: 'High-end 5G mobile handsets and devices',
    },
  });

  const product1 = await prisma.product.upsert({
    where: { SKU: 'APX-X200-128GB' },
    update: {},
    create: {
      SKU: 'APX-X200-128GB',
      name: 'Galaxy X200 128GB',
      brand: 'Apex',
      categoryId: category.id,
      model: 'X200',
      description: '6.7 inch AMOLED 120Hz 128GB Smartphone',
      MRP: 899.99,
      supplierPrice: 550.00,
      distributorPrice: 650.00,
      dealerPrice: 720.00,
      directDealerPrice: 680.00,
      tax: 18.00,
      warrantyPeriod: 12,
      IMEITracked: true,
      status: ProductStatus.ACTIVE,
    },
  });

  const product2 = await prisma.product.upsert({
    where: { SKU: 'APX-PRO-256GB' },
    update: {},
    create: {
      SKU: 'APX-PRO-256GB',
      name: 'Apex Pro 256GB',
      brand: 'Apex',
      categoryId: category.id,
      model: 'PRO-256',
      description: 'Flagship triple camera 256GB Smartphone',
      MRP: 1199.99,
      supplierPrice: 750.00,
      distributorPrice: 880.00,
      dealerPrice: 960.00,
      directDealerPrice: 910.00,
      tax: 18.00,
      warrantyPeriod: 24,
      IMEITracked: true,
      status: ProductStatus.ACTIVE,
    },
  });

  console.log('Seeding ProductPricing records...');
  const productsToPrice = [
    {
      product: product1,
      prices: [
        { partnerType: PartnerType.SUPPLIER, price: 550.00 },
        { partnerType: PartnerType.DISTRIBUTOR, price: 650.00 },
        { partnerType: PartnerType.DEALER, price: 720.00 },
        { partnerType: PartnerType.DIRECT_DEALER, price: 680.00 },
      ],
    },
    {
      product: product2,
      prices: [
        { partnerType: PartnerType.SUPPLIER, price: 750.00 },
        { partnerType: PartnerType.DISTRIBUTOR, price: 880.00 },
        { partnerType: PartnerType.DEALER, price: 960.00 },
        { partnerType: PartnerType.DIRECT_DEALER, price: 910.00 },
      ],
    },
  ];

  for (const item of productsToPrice) {
    for (const p of item.prices) {
      await prisma.productPricing.upsert({
        where: {
          productId_partnerType: {
            productId: item.product.id,
            partnerType: p.partnerType,
          },
        },
        update: { price: p.price },
        create: {
          productId: item.product.id,
          partnerType: p.partnerType,
          price: p.price,
        },
      });
    }
  }

  // 6. Seed Warehouse & Inventory

  console.log('Seeding Warehouse and Inventory...');
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-CENTRAL-01' },
    update: {},
    create: {
      partnerId: supplier.id,
      name: 'Central Distribution Center',
      code: 'WH-CENTRAL-01',
      location: 'Building A, Supply Hub, Metro City',
      status: WarehouseStatus.ACTIVE,
    },
  });

  const distWarehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-METRO-DIST-01' },
    update: {},
    create: {
      partnerId: distributor.id,
      name: 'Metro Wholesale Depot',
      code: 'WH-METRO-DIST-01',
      location: 'Logistics Park, North Region',
      status: WarehouseStatus.ACTIVE,
    },
  });

  const dealerWarehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-PRIME-RETAIL-01' },
    update: {},
    create: {
      partnerId: dealer.id,
      name: 'Prime Retail Store Warehouse',
      code: 'WH-PRIME-RETAIL-01',
      location: '12 Main Street, Cityville',
      status: WarehouseStatus.ACTIVE,
    },
  });

  const directDealerWarehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-DIRECT-CELL-01' },
    update: {},
    create: {
      partnerId: directDealer.id,
      name: 'Direct Cellular Store Hub',
      code: 'WH-DIRECT-CELL-01',
      location: '78 Ocean Avenue, Harbor City',
      status: WarehouseStatus.ACTIVE,
    },
  });

  const inventory1 = await prisma.inventory.upsert({
    where: {
      warehouseId_productId: {
        warehouseId: warehouse.id,
        productId: product1.id,
      },
    },
    update: {},
    create: {
      partnerId: supplier.id,
      warehouseId: warehouse.id,
      productId: product1.id,
      quantity: 10,
      reservedQuantity: 0,
    },
  });

  console.log('Seeding Physical Inventory Items with IMEIs...');
  for (let i = 1; i <= 5; i++) {
    const imei = `35698401000000${i}`;
    await prisma.inventoryItem.upsert({
      where: { IMEI: imei },
      update: {},
      create: {
        inventoryId: inventory1.id,
        productId: product1.id,
        IMEI: imei,
        serialNumber: `SN-APX-X200-00${i}`,
        warehouseId: warehouse.id,
        partnerId: supplier.id,
        status: InventoryItemStatus.AVAILABLE,
        purchaseDate: new Date(),
      },
    });
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
