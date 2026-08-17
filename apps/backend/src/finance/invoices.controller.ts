import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { CreateInvoiceDto, CreateInvoiceFromSalesOrderDto, CreateInvoiceFromPurchaseOrderDto } from './dto/invoice.dto';
import { CreatePaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InvoicesController {
  constructor(
    @Inject(InvoicesService)
    private readonly invoicesService: InvoicesService,
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('from-sales-order/:id')
  async createFromSalesOrder(
    @Param('id') salesOrderId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateInvoiceFromSalesOrderDto,
  ) {
    return this.invoicesService.createInvoiceFromSalesOrder(salesOrderId, user, dto);
  }

  @Post('from-purchase-order/:id')
  async createFromPurchaseOrder(
    @Param('id') purchaseOrderId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateInvoiceFromPurchaseOrderDto,
  ) {
    return this.invoicesService.createInvoiceFromPurchaseOrder(purchaseOrderId, user, dto);
  }

  @Post()
  async create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.invoicesService.createInvoice(dto, user);
  }

  @Get()
  async findAll(@CurrentUser() user: JwtPayloadUser) {
    return this.invoicesService.listInvoices(user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.invoicesService.getInvoiceById(id, user);
  }

  @Post(':id/payments')
  async createPayment(
    @Param('id') invoiceId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(invoiceId, user, dto);
  }

  @Get(':id/payments')
  async findPayments(
    @Param('id') invoiceId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.paymentsService.listPaymentsForInvoice(invoiceId, user);
  }
}
