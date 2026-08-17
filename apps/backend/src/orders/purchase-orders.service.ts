import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ConfigService } from '@nestjs/config';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import {
  OrderStatus,
  PartnerType,
  RoleType,
  ProductStatus,
} from '@prisma/client';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderQueryDto } from './dto/purchase-order-query.dto';

@Injectable()
export class PurchaseOrdersService {
  private readonly approvalThreshold: number;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {
    this.approvalThreshold =
      Number(this.configService.get<string>('APPROVAL_THRESHOLD')) || 100000;
  }

  /**
   * Validate seller-buyer partner hierarchy for PO placement.
   */
  validateSellerBuyerHierarchy(sellerType: PartnerType, buyerType: PartnerType, buyerParentPartnerId?: string | null, sellerId?: string): void {
    if (sellerType === PartnerType.SUPPLIER) {
      if (buyerType !== PartnerType.DISTRIBUTOR && buyerType !== PartnerType.DIRECT_DEALER) {
        throw new BadRequestException(`Supplier can only accept POs from Distributor or Direct-Dealer (Received: ${buyerType})`);
      }
    } else if (sellerType === PartnerType.DISTRIBUTOR) {
      if (buyerType !== PartnerType.DEALER) {
        throw new BadRequestException(`Distributor can only accept POs from Dealer (Received: ${buyerType})`);
      }
      if (buyerParentPartnerId !== sellerId) {
        throw new ForbiddenException(`Dealer does not belong to this Distributor's hierarchy`);
      }
    } else {
      throw new BadRequestException(`Partner type '${sellerType}' cannot act as seller for Purchase Orders`);
    }
  }

  /**
   * Calculate authoritative unit price based on seller-buyer partner tier.
   */
  calculateUnitPrice(product: any, sellerType: PartnerType, buyerType: PartnerType): number {
    if (sellerType === PartnerType.SUPPLIER && buyerType === PartnerType.DISTRIBUTOR) {
      return Number(product.distributorPrice);
    }
    if (sellerType === PartnerType.SUPPLIER && buyerType === PartnerType.DIRECT_DEALER) {
      return Number(product.directDealerPrice);
    }
    if (sellerType === PartnerType.DISTRIBUTOR && buyerType === PartnerType.DEALER) {
      return Number(product.dealerPrice);
    }
    throw new BadRequestException(`Cannot calculate unit price for flow '${sellerType}' -> '${buyerType}'`);
  }

  /**
   * Calculate current outstanding credit exposure and available credit for buyer.
   */
  async getAvailableCredit(buyerPartnerId: string): Promise<{ creditLimit: number; outstanding: number; availableCredit: number }> {
    const buyer = await this.prisma.partner.findUnique({ where: { id: buyerPartnerId } });
    if (!buyer) {
      throw new NotFoundException(`Buyer partner '${buyerPartnerId}' not found`);
    }

    const creditLimit = Number(buyer.creditLimit);

    // Sum active POs in PLACED, APPROVED, DISPATCHED, DELIVERED statuses
    const activePOs = await this.prisma.purchaseOrder.findMany({
      where: {
        buyerPartnerId,
        status: {
          in: [OrderStatus.PLACED, OrderStatus.APPROVED, OrderStatus.DISPATCHED, OrderStatus.DELIVERED],
        },
      },
      select: { totalAmount: true },
    });

    const outstanding = activePOs.reduce((sum, po) => sum + Number(po.totalAmount), 0);
    const availableCredit = creditLimit - outstanding;

    return { creditLimit, outstanding, availableCredit };
  }

  /**
   * Validate status lifecycle transitions.
   */
  validateStatusTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.DRAFT]: [OrderStatus.PLACED, OrderStatus.APPROVED, OrderStatus.CANCELLED],
      [OrderStatus.PLACED]: [OrderStatus.APPROVED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
      [OrderStatus.APPROVED]: [OrderStatus.DISPATCHED, OrderStatus.CANCELLED],
      [OrderStatus.DISPATCHED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.INVOICED],
      [OrderStatus.INVOICED]: [],
      [OrderStatus.REJECTED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.SUBMITTED]: [OrderStatus.APPROVED, OrderStatus.REJECTED],
      [OrderStatus.PROCESSING]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new ConflictException(`Invalid status transition from '${currentStatus}' to '${targetStatus}'`);
    }
  }

  /**
   * Resolve default warehouses for seller and buyer if not explicitly provided.
   */
  private async resolveWarehouses(sellerPartnerId: string, buyerPartnerId: string, sourceWhId?: string, destWhId?: string) {
    let sourceWarehouseId = sourceWhId;
    if (sourceWarehouseId) {
      const wh = await this.prisma.warehouse.findUnique({ where: { id: sourceWarehouseId } });
      if (!wh || wh.partnerId !== sellerPartnerId) {
        throw new BadRequestException(`Source warehouse '${sourceWarehouseId}' not found or does not belong to seller partner`);
      }
    } else {
      const defaultWh = await this.prisma.warehouse.findFirst({ where: { partnerId: sellerPartnerId, status: 'ACTIVE' } });
      if (!defaultWh) {
        throw new BadRequestException(`Seller partner '${sellerPartnerId}' does not have an active warehouse`);
      }
      sourceWarehouseId = defaultWh.id;
    }

    let destinationWarehouseId = destWhId;
    if (destinationWarehouseId) {
      const wh = await this.prisma.warehouse.findUnique({ where: { id: destinationWarehouseId } });
      if (!wh || wh.partnerId !== buyerPartnerId) {
        throw new BadRequestException(`Destination warehouse '${destinationWarehouseId}' not found or does not belong to buyer partner`);
      }
    } else {
      const defaultWh = await this.prisma.warehouse.findFirst({ where: { partnerId: buyerPartnerId, status: 'ACTIVE' } });
      if (!defaultWh) {
        throw new BadRequestException(`Buyer partner '${buyerPartnerId}' does not have an active warehouse`);
      }
      destinationWarehouseId = defaultWh.id;
    }

    return { sourceWarehouseId, destinationWarehouseId };
  }

  /**
   * Generate unique order number (PO-YYYYMMDD-XXXX).
   */
  private async generateOrderNumber(): Promise<string> {
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `PO-${datePrefix}-${randomDigits}`;

    const existing = await this.prisma.purchaseOrder.findUnique({ where: { orderNumber } });
    if (existing) {
      return this.generateOrderNumber();
    }
    return orderNumber;
  }

  /**
   * 1. CREATE PURCHASE ORDER (DRAFT)
   * Security: Buyer MUST come from currentUser.partnerId.
   */
  async create(currentUser: JwtPayloadUser, dto: CreatePurchaseOrderDto) {
    if (!currentUser.partnerId && currentUser.role !== RoleType.ADMIN) {
      throw new ForbiddenException('User is not associated with any buyer partner organization');
    }

    let buyerPartnerId = currentUser.partnerId;
    if (!buyerPartnerId && currentUser.role === RoleType.ADMIN) {
      buyerPartnerId = dto.buyerPartnerId || dto.sellerPartnerId; // Fallback for Admin
    }

    if (!buyerPartnerId) {
      throw new BadRequestException('Buyer partner could not be resolved from user session');
    }

    const sellerPartner = await this.prisma.partner.findUnique({ where: { id: dto.sellerPartnerId } });
    if (!sellerPartner) {
      throw new NotFoundException(`Seller partner '${dto.sellerPartnerId}' not found`);
    }

    const buyerPartner = await this.prisma.partner.findUnique({ where: { id: buyerPartnerId } });
    if (!buyerPartner) {
      throw new NotFoundException(`Buyer partner '${buyerPartnerId}' not found`);
    }

    // Validate partner hierarchy flow
    this.validateSellerBuyerHierarchy(sellerPartner.type, buyerPartner.type, buyerPartner.parentPartnerId, sellerPartner.id);

    // Resolve warehouses if provided
    let sourceWarehouseId: string | null = null;
    let destinationWarehouseId: string | null = null;
    if (dto.sourceWarehouseId || dto.destinationWarehouseId) {
      const resolved = await this.resolveWarehouses(sellerPartner.id, buyerPartner.id, dto.sourceWarehouseId, dto.destinationWarehouseId);
      sourceWarehouseId = resolved.sourceWarehouseId;
      destinationWarehouseId = resolved.destinationWarehouseId;
    }

    // Validate products & line calculations
    let calculatedTotal = 0;
    const lineCreations: any[] = [];

    for (const lineDto of dto.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: lineDto.productId } });
      if (!product) {
        throw new BadRequestException(`Product '${lineDto.productId}' not found`);
      }
      if (product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException(`Product '${product.name}' is not active for ordering`);
      }
      if (lineDto.quantity <= 0) {
        throw new BadRequestException(`Quantity for product '${product.name}' must be greater than zero`);
      }

      const unitPrice = this.calculateUnitPrice(product, sellerPartner.type, buyerPartner.type);
      const lineTotal = lineDto.quantity * unitPrice;
      calculatedTotal += lineTotal;

      lineCreations.push({
        productId: product.id,
        quantity: lineDto.quantity,
        unitPrice,
        tax: 0,
        total: lineTotal,
      });
    }

    const orderNumber = await this.generateOrderNumber();

    return this.prisma.$transaction(async (tx) => {
      return tx.purchaseOrder.create({
        data: {
          orderNumber,
          buyerPartnerId: buyerPartner.id,
          sellerPartnerId: sellerPartner.id,
          sourceWarehouseId,
          destinationWarehouseId,
          status: OrderStatus.DRAFT,
          totalAmount: calculatedTotal,
          lines: {
            create: lineCreations,
          },
        },
        include: {
          lines: { include: { product: true } },
          buyerPartner: true,
          sellerPartner: true,
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
      });
    });
  }

  /**
   * 2. PLACE PURCHASE ORDER (DRAFT -> PLACED or APPROVED)
   * Enforces MOQ, Credit Limit, and Approval Threshold.
   */
  async place(id: string, currentUser: JwtPayloadUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        lines: { include: { product: true } },
        buyerPartner: true,
        sellerPartner: true,
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order '${id}' not found`);
    }

    // Scoping check: only buyer user (or admin) can place draft PO
    if (currentUser.role !== RoleType.ADMIN && currentUser.partnerId !== po.buyerPartnerId) {
      throw new ForbiddenException('Only the buyer partner organization can place this Purchase Order');
    }

    if (po.status !== OrderStatus.DRAFT) {
      throw new BadRequestException(`Cannot place PO in '${po.status}' status. Only DRAFT POs can be placed.`);
    }

    // A. MOQ Validation for each line
    for (const line of po.lines) {
      const moq = line.product.minimumOrderQuantity || 1;
      if (line.quantity < moq) {
        throw new BadRequestException(
          `Quantity for product '${line.product.name}' (${line.quantity}) is below the minimum order quantity of ${moq}.`,
        );
      }
    }

    // B. Credit Limit Validation for buyer
    const poTotal = Number(po.totalAmount);
    const { availableCredit } = await this.getAvailableCredit(po.buyerPartnerId);
    if (poTotal > availableCredit) {
      throw new BadRequestException(
        `Credit limit exceeded for partner '${po.buyerPartner.name}'. Available credit: ${availableCredit.toLocaleString()}, PO total: ${poTotal.toLocaleString()}.`,
      );
    }

    // Resolve warehouses required for allocation
    const { sourceWarehouseId, destinationWarehouseId } = await this.resolveWarehouses(
      po.sellerPartnerId,
      po.buyerPartnerId,
      po.sourceWarehouseId || undefined,
      po.destinationWarehouseId || undefined,
    );

    // C. Approval Threshold Check
    const isAutoApproved = poTotal <= this.approvalThreshold;

    if (isAutoApproved) {
      // AUTO-APPROVAL: Execute stock allocation atomically
      return this.prisma.$transaction(async (tx) => {
        // Validate stock availability for all lines before calling allocateStock
        for (const line of po.lines) {
          const stock = await tx.inventory.findUnique({
            where: {
              warehouseId_productId: {
                warehouseId: sourceWarehouseId,
                productId: line.productId,
              },
            },
          });
          if (!stock || stock.quantity < line.quantity) {
            throw new BadRequestException(
              `Insufficient stock available in source warehouse for product '${line.product.name}'. Available: ${stock?.quantity || 0}, Requested: ${line.quantity}`,
            );
          }
        }

        // Execute allocateStock for each line
        for (const line of po.lines) {
          await this.inventoryService.allocateStock(
            {
              sourcePartnerId: po.sellerPartnerId,
              destinationPartnerId: po.buyerPartnerId,
              productId: line.productId,
              quantity: line.quantity,
              sourceWarehouseId,
              destinationWarehouseId,
              performedByUserId: currentUser.userId,
              purchaseOrderId: po.id,
              purchaseOrderLineId: line.id,
            },
            tx,
          );
        }

        // Update PO to APPROVED
        return tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            status: OrderStatus.APPROVED,
            sourceWarehouseId,
            destinationWarehouseId,
            requiresApproval: false,
            approvedAt: new Date(),
          },
          include: {
            lines: { include: { product: true } },
            buyerPartner: true,
            sellerPartner: true,
            sourceWarehouse: true,
            destinationWarehouse: true,
            stockMovements: true,
          },
        });
      });
    } else {
      // OVER THRESHOLD: Require Manager Approval
      return this.prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: OrderStatus.PLACED,
          sourceWarehouseId,
          destinationWarehouseId,
          requiresApproval: true,
        },
        include: {
          lines: { include: { product: true } },
          buyerPartner: true,
          sellerPartner: true,
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
      });
    }
  }

  /**
   * 3. MANAGER APPROVE PURCHASE ORDER (PLACED -> APPROVED)
   * Calls allocateStock() for each line atomically inside transaction.
   */
  async approve(id: string, currentUser: JwtPayloadUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        lines: { include: { product: true } },
        buyerPartner: true,
        sellerPartner: true,
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order '${id}' not found`);
    }

    if (po.status === OrderStatus.APPROVED) {
      throw new ConflictException(`Purchase Order '${id}' is already APPROVED.`);
    }

    if (po.status !== OrderStatus.PLACED && po.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException(`Cannot approve PO in '${po.status}' status. Must be PLACED.`);
    }

    // Check Approver Authority based on buyer partner hierarchy
    if (currentUser.role !== RoleType.ADMIN) {
      if (!currentUser.partnerId) {
        throw new ForbiddenException('User is not associated with any partner organization');
      }

      // Expected approver is the SELLER partner
      if (currentUser.partnerId !== po.sellerPartnerId) {
        throw new ForbiddenException(`Access denied: Only users belonging to seller partner '${po.sellerPartner.name}' can approve this PO`);
      }
    }

    // Resolve warehouses
    const { sourceWarehouseId, destinationWarehouseId } = await this.resolveWarehouses(
      po.sellerPartnerId,
      po.buyerPartnerId,
      po.sourceWarehouseId || undefined,
      po.destinationWarehouseId || undefined,
    );

    // Atomic transaction for approval + stock allocation across all lines
    return this.prisma.$transaction(async (tx) => {
      // Validate stock availability for all lines
      for (const line of po.lines) {
        const stock = await tx.inventory.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: sourceWarehouseId,
              productId: line.productId,
            },
          },
        });
        if (!stock || stock.quantity < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock available in seller warehouse for product '${line.product.name}'. Available: ${stock?.quantity || 0}, Requested: ${line.quantity}`,
          );
        }
      }

      // Call allocateStock for each line
      for (const line of po.lines) {
        await this.inventoryService.allocateStock(
          {
            sourcePartnerId: po.sellerPartnerId,
            destinationPartnerId: po.buyerPartnerId,
            productId: line.productId,
            quantity: line.quantity,
            sourceWarehouseId,
            destinationWarehouseId,
            performedByUserId: currentUser.userId,
            purchaseOrderId: po.id,
            purchaseOrderLineId: line.id,
          },
          tx,
        );
      }

      // Mark PO APPROVED & record approver details
      const validUserId = currentUser.userId ? (await this.prisma.user.findUnique({ where: { id: currentUser.userId } }))?.id : null;

      return tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: OrderStatus.APPROVED,
          sourceWarehouseId,
          destinationWarehouseId,
          requiresApproval: false,
          approvedByUserId: validUserId || null,
          approvedAt: new Date(),
        },
        include: {
          lines: { include: { product: true } },
          buyerPartner: true,
          sellerPartner: true,
          sourceWarehouse: true,
          destinationWarehouse: true,
          approvedByUser: true,
          stockMovements: true,
        },
      });
    });
  }

  /**
   * 4. REJECT PURCHASE ORDER (PLACED -> REJECTED)
   */
  async reject(id: string, currentUser: JwtPayloadUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { buyerPartner: true, sellerPartner: true },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order '${id}' not found`);
    }

    if (po.status !== OrderStatus.PLACED && po.status !== OrderStatus.SUBMITTED) {
      throw new BadRequestException(`Cannot reject PO in '${po.status}' status.`);
    }

    // Approver authority check
    if (currentUser.role !== RoleType.ADMIN) {
      if (!currentUser.partnerId || currentUser.partnerId !== po.sellerPartnerId) {
        throw new ForbiddenException(`Access denied: Only seller partner users can reject this PO`);
      }
    }

    return this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: OrderStatus.REJECTED,
      },
      include: {
        lines: { include: { product: true } },
        buyerPartner: true,
        sellerPartner: true,
      },
    });
  }

  /**
   * 5. DISPATCH PURCHASE ORDER (APPROVED -> DISPATCHED)
   */
  async dispatch(id: string, currentUser: JwtPayloadUser) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException(`Purchase Order '${id}' not found`);

    this.validateStatusTransition(po.status, OrderStatus.DISPATCHED);

    if (currentUser.role !== RoleType.ADMIN && currentUser.partnerId !== po.sellerPartnerId) {
      throw new ForbiddenException('Only seller partner can dispatch this Purchase Order');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: OrderStatus.DISPATCHED },
      include: { lines: true, buyerPartner: true, sellerPartner: true },
    });
  }

  /**
   * 6. DELIVER PURCHASE ORDER (DISPATCHED -> DELIVERED)
   */
  async deliver(id: string, currentUser: JwtPayloadUser) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException(`Purchase Order '${id}' not found`);

    this.validateStatusTransition(po.status, OrderStatus.DELIVERED);

    if (currentUser.role !== RoleType.ADMIN && currentUser.partnerId !== po.buyerPartnerId) {
      throw new ForbiddenException('Only buyer partner can mark this Purchase Order as delivered');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: OrderStatus.DELIVERED },
      include: { lines: true, buyerPartner: true, sellerPartner: true },
    });
  }

  /**
   * QUERY PURCHASE ORDERS WITH TENANT SCOPING
   */
  async findAll(currentUser: JwtPayloadUser, query: PurchaseOrderQueryDto) {
    let whereClause: any = {};

    if (query.status) {
      whereClause.status = query.status;
    }

    if (currentUser.role === RoleType.ADMIN) {
      if (query.buyerPartnerId) whereClause.buyerPartnerId = query.buyerPartnerId;
      if (query.sellerPartnerId) whereClause.sellerPartnerId = query.sellerPartnerId;
    } else if (currentUser.role === RoleType.SUPPLIER) {
      whereClause.OR = [
        { sellerPartnerId: currentUser.partnerId },
        { buyerPartnerId: currentUser.partnerId },
      ];
    } else if (currentUser.role === RoleType.DISTRIBUTOR) {
      const childDealers = await this.prisma.partner.findMany({
        where: { parentPartnerId: currentUser.partnerId },
        select: { id: true },
      });
      const childDealerIds = childDealers.map((d) => d.id);

      whereClause.OR = [
        { buyerPartnerId: currentUser.partnerId },
        { sellerPartnerId: currentUser.partnerId },
        { buyerPartnerId: { in: childDealerIds }, sellerPartnerId: currentUser.partnerId },
      ];
    } else {
      // Dealer & Direct-Dealer
      whereClause.OR = [
        { buyerPartnerId: currentUser.partnerId },
        { sellerPartnerId: currentUser.partnerId },
      ];
    }

    return this.prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        lines: { include: { product: true } },
        buyerPartner: true,
        sellerPartner: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        approvedByUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * GET SINGLE PURCHASE ORDER WITH SCOPING
   */
  async findOne(id: string, currentUser: JwtPayloadUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        lines: { include: { product: true } },
        buyerPartner: true,
        sellerPartner: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        approvedByUser: true,
        stockMovements: true,
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order '${id}' not found`);
    }

    if (currentUser.role !== RoleType.ADMIN) {
      const userPartnerId = currentUser.partnerId;
      const isBuyer = po.buyerPartnerId === userPartnerId;
      const isSeller = po.sellerPartnerId === userPartnerId;
      const isParentDistributor = po.buyerPartner.parentPartnerId === userPartnerId;

      if (!isBuyer && !isSeller && !isParentDistributor) {
        throw new ForbiddenException('Access denied: You are not authorized to view this Purchase Order');
      }
    }

    return po;
  }

  /**
   * UPDATE DRAFT PO
   */
  async updateDraft(id: string, currentUser: JwtPayloadUser, dto: UpdatePurchaseOrderDto) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true, buyerPartner: true, sellerPartner: true },
    });

    if (!po) throw new NotFoundException(`Purchase Order '${id}' not found`);

    if (po.status !== OrderStatus.DRAFT) {
      throw new BadRequestException(`Cannot update Purchase Order in '${po.status}' status. Only DRAFT POs can be edited.`);
    }

    if (currentUser.role !== RoleType.ADMIN && currentUser.partnerId !== po.buyerPartnerId) {
      throw new ForbiddenException('Only buyer partner can update this draft Purchase Order');
    }

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = Number(po.totalAmount);

      if (dto.lines && dto.lines.length > 0) {
        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: po.id } });

        totalAmount = 0;
        const lineCreations: any[] = [];

        for (const lineDto of dto.lines) {
          const product = await tx.product.findUnique({ where: { id: lineDto.productId } });
          if (!product) throw new BadRequestException(`Product '${lineDto.productId}' not found`);

          const unitPrice = this.calculateUnitPrice(product, po.sellerPartner.type, po.buyerPartner.type);
          const lineTotal = lineDto.quantity * unitPrice;
          totalAmount += lineTotal;

          lineCreations.push({
            purchaseOrderId: po.id,
            productId: product.id,
            quantity: lineDto.quantity,
            unitPrice,
            tax: 0,
            total: lineTotal,
          });
        }

        await tx.purchaseOrderLine.createMany({ data: lineCreations });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          totalAmount,
          ...(dto.sourceWarehouseId && { sourceWarehouseId: dto.sourceWarehouseId }),
          ...(dto.destinationWarehouseId && { destinationWarehouseId: dto.destinationWarehouseId }),
        },
        include: {
          lines: { include: { product: true } },
          buyerPartner: true,
          sellerPartner: true,
        },
      });
    });
  }
}
