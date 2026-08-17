import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoicesController } from './invoices.controller';
import { LedgerController } from './ledger.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { LedgerService } from './ledger.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController, LedgerController],
  providers: [InvoicesService, PaymentsService, LedgerService],
  exports: [InvoicesService, PaymentsService, LedgerService],
})
export class FinanceModule {}
