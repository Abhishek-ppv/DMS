import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus, PaymentStatus, LedgerTransactionType, LedgerReferenceType } from '@prisma/client';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CreatePaymentDto } from './dto/payment.dto';
import { InvoicesService } from './invoices.service';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  /**
   * Record a payment for an invoice atomically.
   */
  async createPayment(invoiceId: string, currentUser: JwtPayloadUser, dto: CreatePaymentDto) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    // Check existence and authorization
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID '${invoiceId}' not found`);
    }

    await this.invoicesService.authorizeInvoiceAccess(invoice, currentUser);

    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Re-query fresh invoice state
      const freshInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!freshInvoice) {
        throw new NotFoundException(`Invoice with ID '${invoiceId}' not found`);
      }

      const totalAmount = Number(freshInvoice.totalAmount);
      const currentPaidAmount = Number(freshInvoice.paidAmount);
      const currentOutstanding = Math.max(0, totalAmount - currentPaidAmount);

      if (freshInvoice.status === InvoiceStatus.PAID || currentOutstanding <= 0) {
        throw new BadRequestException('Invoice is already fully paid');
      }

      if (dto.amount > currentOutstanding) {
        throw new BadRequestException(
          `Payment amount ₹${dto.amount} exceeds remaining outstanding balance of ₹${currentOutstanding}`,
        );
      }

      const newPaidAmount = currentPaidAmount + dto.amount;
      const newStatus =
        newPaidAmount >= totalAmount ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId: freshInvoice.id,
          partnerId: freshInvoice.sellerPartnerId,
          customerId: freshInvoice.customerId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
          status: PaymentStatus.COMPLETED,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        },
      });

      // 2. Update Invoice paidAmount and status
      const updatedInvoice = await tx.invoice.update({
        where: { id: freshInvoice.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });

      // 3. Post Credit entry in Ledger
      await tx.ledger.create({
        data: {
          partnerId: freshInvoice.sellerPartnerId,
          transactionType: LedgerTransactionType.CREDIT,
          amount: dto.amount,
          balance: Math.max(0, totalAmount - newPaidAmount),
          referenceType: LedgerReferenceType.PAYMENT,
          referenceId: payment.id,
          description: `Payment ${paymentNumber} recorded for Invoice ${freshInvoice.invoiceNumber}`,
        },
      });

      return { payment, updatedInvoice };
    });

    const formattedInvoice = this.invoicesService.formatInvoiceResponse(result.updatedInvoice);

    return {
      payment: result.payment,
      invoice: formattedInvoice,
    };
  }

  /**
   * List payments associated with an invoice
   */
  async listPaymentsForInvoice(invoiceId: string, currentUser: JwtPayloadUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID '${invoiceId}' not found`);
    }

    await this.invoicesService.authorizeInvoiceAccess(invoice, currentUser);

    const payments = await this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paymentDate: 'desc' },
    });

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalAmount = Number(invoice.totalAmount);
    const outstandingAmount = Math.max(0, totalAmount - totalPaid);

    return {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount,
      totalPaid,
      outstandingAmount,
      payments,
    };
  }
}
