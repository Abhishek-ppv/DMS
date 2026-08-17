import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { SalesEventService, SaleCompletedEventPayload } from './sales-event.service';
import {
  PartnerType,
  RoleType,
  OrderStatus,
  InventoryItemStatus,
  StockMovementType,
  Prisma,
} from '@prisma/client';

@Injectable()
export class SalesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SalesEventService)
    private readonly salesEventService: SalesEventService,
  ) {}

  /**
   * Helper to generate unique order number (SO-YYYYMMDD-XXXX).
   */
  private async generateOrderNumber(): Promise<string> {
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `SO-${datePrefix}-${randomDigits}`;

    const existing = await this.prisma.salesOrder.findUnique({ where: { orderNumber } });
    if (existing) {
      return this.generateOrderNumber();
    }
    return orderNumber;
  }

  /**
   * 1. CREATE SALES ORDER + ATOMIC STOCK DEDUCTION
   * Security & Business Rules:
   * - ONLY DEALER and DIRECT_DEALER (and ADMIN) can create sales orders.
   * - SUPPLIER and DISTRIBUTOR partners are DENIED.
   * - partnerId comes strictly from JWT currentUser.partnerId.
   * - Customer must belong to current partner organization.
   * - IMEI items must exist, belong to partner, and have status AVAILABLE.
   * - Non-IMEI items must have available stock quantity >= requested quantity.
   * - Atomic transaction: SO + Lines + Stock deduction + IMEI SOLD.
   * - Triggers SaleCompleted event ONLY after transaction commit.
   */
  async create(currentUser: JwtPayloadUser, dto: CreateSalesOrderDto) {
    if (!currentUser.partnerId && currentUser.role !== RoleType.ADMIN) {
      throw new ForbiddenException('User is not associated with any seller partner organization');
    }

    let sellerPartnerId = currentUser.partnerId;
    if (!sellerPartnerId && currentUser.role === RoleType.ADMIN) {
      // Fallback for Admin testing: resolve first available partner or error
      const firstPartner = await this.prisma.partner.findFirst({
        where: { type: { in: [PartnerType.DEALER, PartnerType.DIRECT_DEALER] } },
      });
      if (!firstPartner) {
        throw new BadRequestException('No Dealer or Direct Dealer partner found in system for Admin');
      }
      sellerPartnerId = firstPartner.id;
    }

    // Verify Seller Partner and Role Restriction
    const sellerPartner = await this.prisma.partner.findUnique({
      where: { id: sellerPartnerId! },
    });

    if (!sellerPartner) {
      throw new NotFoundException(`Partner '${sellerPartnerId}' not found`);
    }

    // ROLE RESTRICTION: ONLY DEALER & DIRECT_DEALER (and ADMIN) allowed
    if (
      sellerPartner.type !== PartnerType.DEALER &&
      sellerPartner.type !== PartnerType.DIRECT_DEALER &&
      currentUser.role !== RoleType.ADMIN
    ) {
      throw new ForbiddenException(
        `${sellerPartner.type} partners are not authorized to create sales orders. Only Dealers and Direct-Dealers can perform end-customer sales.`,
      );
    }

    // CUSTOMER VALIDATION & SCOPING: Customer MUST exist and belong to current partner
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        partnerId: sellerPartner.id,
      },
    });

    if (!customer) {
      throw new BadRequestException(
        `Customer '${dto.customerId}' not found or does not belong to your organization`,
      );
    }

    // PRE-TRANSACTION VALIDATION & LINE PREPARATION
    let grandTotal = 0;
    const validatedLines: {
      productId: string;
      productName: string;
      inventoryItemId?: string | null;
      imei?: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      inventoryRecordId?: string;
      warehouseId?: string;
    }[] = [];

    for (const lineDto of dto.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: lineDto.productId } });
      if (!product || product.status !== 'ACTIVE') {
        throw new BadRequestException(`Product '${lineDto.productId}' not found or inactive`);
      }

      // Determine Authoritative Unit Price based on Seller Partner Type
      let unitPrice = Number(product.MRP);
      if (sellerPartner.type === PartnerType.DEALER) {
        unitPrice = Number(product.dealerPrice) || Number(product.MRP);
      } else if (sellerPartner.type === PartnerType.DIRECT_DEALER) {
        unitPrice = Number(product.directDealerPrice) || Number(product.MRP);
      }

      if (product.IMEITracked) {
        // IMEI TRACKED PRODUCT VALIDATION
        if (!lineDto.inventoryItemId) {
          throw new BadRequestException(
            `Product '${product.name}' is IMEI tracked and requires a valid inventoryItemId`,
          );
        }

        const invItem = await this.prisma.inventoryItem.findFirst({
          where: {
            id: lineDto.inventoryItemId,
            partnerId: sellerPartner.id,
            productId: product.id,
          },
        });

        if (!invItem) {
          throw new BadRequestException(
            `Inventory item '${lineDto.inventoryItemId}' not found or does not belong to your partner organization`,
          );
        }

        if (invItem.status !== InventoryItemStatus.AVAILABLE) {
          throw new ConflictException(
            `Inventory item (IMEI: ${invItem.IMEI}) is not available (Status: ${invItem.status}) or has already been sold`,
          );
        }

        const lineQuantity = 1; // IMEI items always quantity = 1
        const lineTotal = unitPrice * lineQuantity;
        grandTotal += lineTotal;

        validatedLines.push({
          productId: product.id,
          productName: product.name,
          inventoryItemId: invItem.id,
          imei: invItem.IMEI,
          quantity: lineQuantity,
          unitPrice,
          lineTotal,
          inventoryRecordId: invItem.inventoryId,
          warehouseId: invItem.warehouseId,
        });
      } else {
        // NON-IMEI QUANTITY PRODUCT VALIDATION
        if (!lineDto.quantity || lineDto.quantity <= 0) {
          throw new BadRequestException(`Quantity for product '${product.name}' must be greater than zero`);
        }

        const inventory = await this.prisma.inventory.findFirst({
          where: {
            partnerId: sellerPartner.id,
            productId: product.id,
          },
        });

        if (!inventory) {
          throw new BadRequestException(`No inventory record found for product '${product.name}' in your partner stock`);
        }

        const availableQty = inventory.quantity - inventory.reservedQuantity;
        if (availableQty < lineDto.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product '${product.name}'. Available: ${availableQty}, Requested: ${lineDto.quantity}`,
          );
        }

        const lineTotal = unitPrice * lineDto.quantity;
        grandTotal += lineTotal;

        validatedLines.push({
          productId: product.id,
          productName: product.name,
          inventoryItemId: null,
          imei: null,
          quantity: lineDto.quantity,
          unitPrice,
          lineTotal,
          inventoryRecordId: inventory.id,
          warehouseId: inventory.warehouseId,
        });
      }
    }

    // ATOMIC DATABASE TRANSACTION
    const orderNumber = await this.generateOrderNumber();
    let createdSalesOrder: any = null;
    const eventLines: any[] = [];

    // Safely check if currentUser.userId exists in User table
    let validUserId: string | null = null;
    if (currentUser.userId) {
      const userExists = await this.prisma.user.findUnique({ where: { id: currentUser.userId } });
      if (userExists) {
        validUserId = userExists.id;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Create SalesOrder
      const salesOrder = await tx.salesOrder.create({
        data: {
          orderNumber,
          sellerPartnerId: sellerPartner.id,
          customerId: customer.id,
          status: OrderStatus.COMPLETED,
          totalAmount: new Prisma.Decimal(grandTotal),
        },
      });

      // 2. Process Lines & Deduct Stock
      for (const line of validatedLines) {
        // Create SalesOrderLine
        const soLine = await tx.salesOrderLine.create({
          data: {
            salesOrderId: salesOrder.id,
            productId: line.productId,
            inventoryItemId: line.inventoryItemId || null,
            quantity: line.quantity,
            unitPrice: new Prisma.Decimal(line.unitPrice),
            total: new Prisma.Decimal(line.lineTotal),
          },
        });

        if (line.inventoryItemId) {
          // Double-Sale Protection: atomic update returning count
          const updateCount = await tx.inventoryItem.updateMany({
            where: {
              id: line.inventoryItemId,
              status: InventoryItemStatus.AVAILABLE,
            },
            data: {
              status: InventoryItemStatus.SOLD,
              customerId: customer.id,
              saleDate: new Date(),
            },
          });

          if (updateCount.count === 0) {
            throw new ConflictException(
              `Failed to complete sale. IMEI ${line.imei} was concurrently modified or sold.`,
            );
          }

          // Decrement parent Inventory quantity
          if (line.inventoryRecordId) {
            await tx.inventory.update({
              where: { id: line.inventoryRecordId },
              data: { quantity: { decrement: 1 } },
            });
          }

          // Record Stock Movement
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              inventoryItemId: line.inventoryItemId,
              fromPartnerId: sellerPartner.id,
              fromWarehouseId: line.warehouseId || null,
              movementType: StockMovementType.OUTBOUND,
              quantity: 1,
              referenceNumber: orderNumber,
              performedByUserId: validUserId,
              salesOrderId: salesOrder.id,
              salesOrderLineId: soLine.id,
            },
          });
        } else {
          // Non-IMEI Stock Deduction
          if (line.inventoryRecordId) {
            const updatedInv = await tx.inventory.update({
              where: { id: line.inventoryRecordId },
              data: { quantity: { decrement: line.quantity } },
            });

            if (updatedInv.quantity < 0) {
              throw new BadRequestException(`Stock deduction resulted in negative quantity for product ID '${line.productId}'`);
            }
          }

          // Record Stock Movement
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              fromPartnerId: sellerPartner.id,
              fromWarehouseId: line.warehouseId || null,
              movementType: StockMovementType.OUTBOUND,
              quantity: line.quantity,
              referenceNumber: orderNumber,
              performedByUserId: validUserId,
              salesOrderId: salesOrder.id,
              salesOrderLineId: soLine.id,
            },
          });
        }

        eventLines.push({
          salesOrderLineId: soLine.id,
          productId: line.productId,
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          imei: line.imei,
        });
      }

      // Fetch full created order inside tx for response
      createdSalesOrder = await tx.salesOrder.findUnique({
        where: { id: salesOrder.id },
        include: {
          customer: true,
          sellerPartner: true,
          lines: {
            include: {
              product: true,
              inventoryItem: true,
            },
          },
        },
      });
    });

    // TRIGGER SaleCompleted EVENT ONLY AFTER TRANSACTION COMMITS
    const eventPayload: SaleCompletedEventPayload = {
      salesOrderId: createdSalesOrder.id,
      orderNumber: createdSalesOrder.orderNumber,
      customerId: createdSalesOrder.customerId,
      partnerId: createdSalesOrder.sellerPartnerId,
      totalAmount: Number(createdSalesOrder.totalAmount),
      createdAt: createdSalesOrder.createdAt,
      lines: eventLines,
    };

    this.salesEventService.emitSaleCompleted(eventPayload);

    return createdSalesOrder;
  }

  /**
   * 2. FIND ALL SALES ORDERS (QUERY SCOPED)
   */
  async findAll(currentUser: JwtPayloadUser, query?: SalesOrderQueryDto) {
    const where: Prisma.SalesOrderWhereInput = {};

    if (currentUser.role !== RoleType.ADMIN) {
      if (!currentUser.partnerId) {
        return [];
      }
      where.sellerPartnerId = currentUser.partnerId;
    }

    if (query?.customerId) {
      where.customerId = query.customerId;
    }
    if (query?.status) {
      where.status = query.status;
    }

    return this.prisma.salesOrder.findMany({
      where,
      include: {
        customer: true,
        sellerPartner: true,
        lines: {
          include: {
            product: true,
            inventoryItem: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 3. FIND ONE SALES ORDER BY ID (QUERY SCOPED)
   */
  async findOne(id: string, currentUser: JwtPayloadUser) {
    const salesOrder = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        sellerPartner: true,
        lines: {
          include: {
            product: true,
            inventoryItem: true,
          },
        },
      },
    });

    if (!salesOrder) {
      throw new NotFoundException(`Sales Order '${id}' not found`);
    }

    if (currentUser.role !== RoleType.ADMIN) {
      if (!currentUser.partnerId || salesOrder.sellerPartnerId !== currentUser.partnerId) {
        throw new ForbiddenException(`You are not authorized to view Sales Order '${id}'`);
      }
    }

    return salesOrder;
  }
}
