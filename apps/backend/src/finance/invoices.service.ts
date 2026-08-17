import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus, RoleType, OrderStatus, LedgerTransactionType, LedgerReferenceType } from '@prisma/client';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CreateInvoiceDto, CreateInvoiceFromSalesOrderDto, CreateInvoiceFromPurchaseOrderDto, InvoiceSourceType } from './dto/invoice.dto';
import { LedgerService } from './ledger.service';

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(LedgerService)
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Calculate computed dynamic fields (outstandingAmount & daysOverdue)
   */
  formatInvoiceResponse(invoice: any) {
    const totalAmount = Number(invoice.totalAmount || 0);
    const paidAmount = Number(invoice.paidAmount || 0);
    const outstandingAmount = Math.max(0, totalAmount - paidAmount);

    let daysOverdue = 0;
    if (invoice.status !== InvoiceStatus.PAID && outstandingAmount > 0 && invoice.dueDate) {
      const now = new Date();
      const due = new Date(invoice.dueDate);
      if (now > due) {
        daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    return {
      ...invoice,
      subtotal: Number(invoice.subtotal || 0),
      totalAmount,
      taxAmount: Number(invoice.taxAmount || 0),
      paidAmount,
      outstandingAmount,
      daysOverdue,
    };
  }

  /**
   * Helper: Check if currentUser is authorized to access an invoice by partner ownership / hierarchy
   */
  async authorizeInvoiceAccess(invoice: any, currentUser: JwtPayloadUser) {
    if (currentUser.role === RoleType.ADMIN) return;

    const authorizedIds = await this.ledgerService.getAuthorizedPartnerIds(currentUser);
    if (!authorizedIds) return;

    const isSeller = invoice.sellerPartnerId && authorizedIds.includes(invoice.sellerPartnerId);
    const isBuyer = invoice.buyerPartnerId && authorizedIds.includes(invoice.buyerPartnerId);

    if (!isSeller && !isBuyer) {
      throw new ForbiddenException('Access denied to this financial invoice');
    }
  }

  /**
   * Generate Invoice from a Sales Order
   */
  async createInvoiceFromSalesOrder(
    salesOrderId: string,
    currentUser: JwtPayloadUser,
    dto?: CreateInvoiceFromSalesOrderDto,
  ) {
    const salesOrder = await this.prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        lines: {
          include: { product: true },
        },
        sellerPartner: true,
        buyerPartner: true,
        customer: true,
      },
    });

    if (!salesOrder) {
      throw new NotFoundException(`Sales Order with ID '${salesOrderId}' not found`);
    }

    // Check authorization
    if (currentUser.role !== RoleType.ADMIN) {
      const authorizedIds = await this.ledgerService.getAuthorizedPartnerIds(currentUser);
      if (authorizedIds && !authorizedIds.includes(salesOrder.sellerPartnerId)) {
        throw new ForbiddenException('You are not authorized to generate an invoice for this Sales Order');
      }
    }

    // Check duplicate invoice
    const existing = await this.prisma.invoice.findFirst({
      where: { salesOrderId, status: { not: InvoiceStatus.CANCELLED } },
    });
    if (existing) {
      throw new ConflictException(`An active invoice '${existing.invoiceNumber}' already exists for this Sales Order`);
    }

    // Calculate line snapshots and totals
    let subtotal = 0;
    let taxAmount = 0;
    let totalAmount = 0;

    const lineSnapshots = (salesOrder.lines || []).map((line) => {
      const qty = line.quantity;
      const unitPrice = Number(line.unitPrice);
      const lineSubtotal = unitPrice * qty;
      const taxRate = Number(line.product?.tax || 0);
      const lineTax = (lineSubtotal * taxRate) / 100;
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      taxAmount += lineTax;
      totalAmount += lineTotal;

      return {
        productId: line.productId,
        productName: line.product?.name || 'Product',
        sku: line.product?.SKU || 'SKU',
        quantity: qty,
        unitPrice,
        taxRate,
        taxAmount: lineTax,
        total: lineTotal,
      };
    });

    const dueDate = dto?.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const invoiceNumber = `INV-SO-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Atomic transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          salesOrderId: salesOrder.id,
          customerId: salesOrder.customerId,
          sellerPartnerId: salesOrder.sellerPartnerId,
          buyerPartnerId: salesOrder.buyerPartnerId,
          subtotal,
          taxAmount,
          totalAmount,
          paidAmount: 0,
          status: InvoiceStatus.UNPAID,
          dueDate,
          lines: {
            create: lineSnapshots,
          },
        },
        include: {
          lines: true,
          customer: true,
          sellerPartner: true,
          buyerPartner: true,
        },
      });

      // Post Debit Ledger Record
      await tx.ledger.create({
        data: {
          partnerId: salesOrder.sellerPartnerId,
          transactionType: LedgerTransactionType.DEBIT,
          amount: totalAmount,
          balance: totalAmount,
          referenceType: LedgerReferenceType.INVOICE,
          referenceId: createdInvoice.id,
          description: `Invoice ${invoiceNumber} issued for Sales Order ${salesOrder.orderNumber}`,
        },
      });

      // Optionally update Sales Order status to INVOICED
      if (salesOrder.status !== OrderStatus.INVOICED) {
        await tx.salesOrder.update({
          where: { id: salesOrder.id },
          data: { status: OrderStatus.INVOICED },
        });
      }

      return createdInvoice;
    });

    return this.formatInvoiceResponse(invoice);
  }

  /**
   * Generate Invoice from a Purchase Order
   */
  async createInvoiceFromPurchaseOrder(
    purchaseOrderId: string,
    currentUser: JwtPayloadUser,
    dto?: CreateInvoiceFromPurchaseOrderDto,
  ) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        lines: {
          include: { product: true },
        },
        sellerPartner: true,
        buyerPartner: true,
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase Order with ID '${purchaseOrderId}' not found`);
    }

    // Check authorization
    if (currentUser.role !== RoleType.ADMIN) {
      const authorizedIds = await this.ledgerService.getAuthorizedPartnerIds(currentUser);
      if (
        authorizedIds &&
        !authorizedIds.includes(purchaseOrder.sellerPartnerId) &&
        !authorizedIds.includes(purchaseOrder.buyerPartnerId)
      ) {
        throw new ForbiddenException('You are not authorized to generate an invoice for this Purchase Order');
      }
    }

    // Check duplicate invoice
    const existing = await this.prisma.invoice.findFirst({
      where: { purchaseOrderId, status: { not: InvoiceStatus.CANCELLED } },
    });
    if (existing) {
      throw new ConflictException(`An active invoice '${existing.invoiceNumber}' already exists for this Purchase Order`);
    }

    // Calculate line snapshots and totals
    let subtotal = 0;
    let taxAmount = 0;
    let totalAmount = 0;

    const lineSnapshots = (purchaseOrder.lines || []).map((line) => {
      const qty = line.quantity;
      const unitPrice = Number(line.unitPrice);
      const lineSubtotal = unitPrice * qty;
      const taxRate = Number(line.product?.tax || 0);
      const lineTax = (lineSubtotal * taxRate) / 100;
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      taxAmount += lineTax;
      totalAmount += lineTotal;

      return {
        productId: line.productId,
        productName: line.product?.name || 'Product',
        sku: line.product?.SKU || 'SKU',
        quantity: qty,
        unitPrice,
        taxRate,
        taxAmount: lineTax,
        total: lineTotal,
      };
    });

    const dueDate = dto?.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const invoiceNumber = `INV-PO-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Atomic transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          purchaseOrderId: purchaseOrder.id,
          sellerPartnerId: purchaseOrder.sellerPartnerId,
          buyerPartnerId: purchaseOrder.buyerPartnerId,
          subtotal,
          taxAmount,
          totalAmount,
          paidAmount: 0,
          status: InvoiceStatus.UNPAID,
          dueDate,
          lines: {
            create: lineSnapshots,
          },
        },
        include: {
          lines: true,
          sellerPartner: true,
          buyerPartner: true,
        },
      });

      // Post Debit Ledger Record
      await tx.ledger.create({
        data: {
          partnerId: purchaseOrder.sellerPartnerId,
          transactionType: LedgerTransactionType.DEBIT,
          amount: totalAmount,
          balance: totalAmount,
          referenceType: LedgerReferenceType.INVOICE,
          referenceId: createdInvoice.id,
          description: `Invoice ${invoiceNumber} issued for Purchase Order ${purchaseOrder.orderNumber}`,
        },
      });

      // Optionally update Purchase Order status to INVOICED
      if (purchaseOrder.status !== OrderStatus.INVOICED) {
        await tx.purchaseOrder.update({
          where: { id: purchaseOrder.id },
          data: { status: OrderStatus.INVOICED },
        });
      }

      return createdInvoice;
    });

    return this.formatInvoiceResponse(invoice);
  }

  /**
   * Generic Create Invoice Endpoint
   */
  async createInvoice(dto: CreateInvoiceDto, currentUser: JwtPayloadUser) {
    if (dto.sourceType === InvoiceSourceType.SALES_ORDER) {
      return this.createInvoiceFromSalesOrder(dto.sourceId, currentUser, { dueDate: dto.dueDate });
    } else if (dto.sourceType === InvoiceSourceType.PURCHASE_ORDER) {
      return this.createInvoiceFromPurchaseOrder(dto.sourceId, currentUser, { dueDate: dto.dueDate });
    } else {
      throw new BadRequestException('Invalid invoice source type');
    }
  }

  /**
   * List Invoices with partner scoping
   */
  async listInvoices(currentUser: JwtPayloadUser) {
    const authorizedPartnerIds = await this.ledgerService.getAuthorizedPartnerIds(currentUser);

    const whereClause: any = {};
    if (authorizedPartnerIds !== null) {
      whereClause.OR = [
        { sellerPartnerId: { in: authorizedPartnerIds } },
        { buyerPartnerId: { in: authorizedPartnerIds } },
      ];
    }

    const invoices = await this.prisma.invoice.findMany({
      where: whereClause,
      include: {
        customer: true,
        sellerPartner: { select: { id: true, name: true, type: true } },
        buyerPartner: { select: { id: true, name: true, type: true } },
        lines: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map((inv) => this.formatInvoiceResponse(inv));
  }

  /**
   * Get Invoice by ID
   */
  async getInvoiceById(id: string, currentUser: JwtPayloadUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        sellerPartner: { select: { id: true, name: true, type: true } },
        buyerPartner: { select: { id: true, name: true, type: true } },
        lines: { include: { product: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        salesOrder: true,
        purchaseOrder: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }

    await this.authorizeInvoiceAccess(invoice, currentUser);
    return this.formatInvoiceResponse(invoice);
  }
}
