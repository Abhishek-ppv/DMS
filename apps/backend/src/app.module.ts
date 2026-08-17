import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PartnersModule } from './partners/partners.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { SalesModule } from './sales/sales.module';
import { FinanceModule } from './finance/finance.module';
import { CrmModule } from './crm/crm.module';
import { WarrantyModule } from './warranty/warranty.module';
import { ServiceModule } from './service/service.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PartnersModule,
    CustomersModule,
    ProductsModule,
    CategoriesModule,
    WarehousesModule,
    InventoryModule,
    OrdersModule,
    SalesModule,
    FinanceModule,
    CrmModule,
    WarrantyModule,
    ServiceModule,
    ReportsModule,
    NotificationsModule,
    AuditModule,
  ],
})
export class AppModule {}
