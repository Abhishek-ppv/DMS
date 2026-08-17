import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface SaleCompletedEventLine {
  salesOrderLineId: string;
  productId: string;
  inventoryItemId?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imei?: string | null;
}

export interface SaleCompletedEventPayload {
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  partnerId: string;
  totalAmount: number;
  createdAt: Date;
  lines: SaleCompletedEventLine[];
}

@Injectable()
export class SalesEventService {
  private readonly logger = new Logger(SalesEventService.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    // Default internal handler logging successful SaleCompleted event
    this.emitter.on('SaleCompleted', (payload: SaleCompletedEventPayload) => {
      this.logger.log(
        `[SaleCompleted Event Triggered] Order: ${payload.orderNumber} (ID: ${payload.salesOrderId}), Customer: ${payload.customerId}, Total: ₹${payload.totalAmount}`,
      );
    });
  }

  /**
   * Internal hook to emit SaleCompleted event AFTER transaction commit.
   */
  emitSaleCompleted(payload: SaleCompletedEventPayload): void {
    this.emitter.emit('SaleCompleted', payload);
  }

  /**
   * Subscribe to SaleCompleted event for downstream Invoice & Warranty processing.
   */
  onSaleCompleted(listener: (payload: SaleCompletedEventPayload) => void): void {
    this.emitter.on('SaleCompleted', listener);
  }
}
