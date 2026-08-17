import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddStockDto } from './dto/add-stock.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import {
  PartnerType,
  RoleType,
  InventoryStatus,
  InventoryItemStatus,
  StockMovementType,
  Prisma,
} from '@prisma/client';

export interface AllocateStockParams {
  sourcePartnerId: string;
  destinationPartnerId: string;
  productId: string;
  quantity: number;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  imeis?: string[];
  performedByUserId?: string;
  isReturn?: boolean;
  purchaseOrderId?: string;
  purchaseOrderLineId?: string;
}

export interface AllocateStockResult {
  success: boolean;
  productId: string;
  quantity: number;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  sourcePartnerId: string;
  destinationPartnerId: string;
  transferredImeis?: string[];
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Validate if a parent/child allocation or return is permitted in the DMS hierarchy.
   */
  validateAllocationHierarchy(
    sourceType: PartnerType,
    destType: PartnerType,
    isChildOfSource: boolean,
    isChildOfDest: boolean,
    isReturn = false,
  ): boolean {
    if (!isReturn) {
      if (sourceType === PartnerType.SUPPLIER) {
        if ((destType === PartnerType.DISTRIBUTOR || destType === PartnerType.DIRECT_DEALER) && isChildOfSource) {
          return true;
        }
      } else if (sourceType === PartnerType.DISTRIBUTOR) {
        if (destType === PartnerType.DEALER && isChildOfSource) {
          return true;
        }
      }
    } else {
      if (destType === PartnerType.SUPPLIER) {
        if ((sourceType === PartnerType.DISTRIBUTOR || sourceType === PartnerType.DIRECT_DEALER) && isChildOfDest) {
          return true;
        }
      } else if (destType === PartnerType.DISTRIBUTOR) {
        if (sourceType === PartnerType.DEALER && isChildOfDest) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Reusable domain function to allocate/transfer stock between partners & warehouses.
   */
  async allocateStock(
    params: AllocateStockParams,
    prismaTx?: Prisma.TransactionClient,
  ): Promise<AllocateStockResult> {
    const {
      sourcePartnerId,
      destinationPartnerId,
      productId,
      quantity,
      sourceWarehouseId,
      destinationWarehouseId,
      imeis,
      performedByUserId,
      isReturn,
      purchaseOrderId,
      purchaseOrderLineId,
    } = params;

    const db = prismaTx || this.prisma;

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }

    // 1. Validate partners
    const sourcePartner = await db.partner.findUnique({ where: { id: sourcePartnerId } });
    if (!sourcePartner) {
      throw new BadRequestException(`Source partner with ID '${sourcePartnerId}' not found`);
    }

    const destinationPartner = await db.partner.findUnique({ where: { id: destinationPartnerId } });
    if (!destinationPartner) {
      throw new BadRequestException(`Destination partner with ID '${destinationPartnerId}' not found`);
    }

    // 2. Validate hierarchy relationship
    const isChildOfSource = destinationPartner.parentPartnerId === sourcePartner.id;
    const isChildOfDest = sourcePartner.parentPartnerId === destinationPartner.id;
    const isAllowedHierarchy = this.validateAllocationHierarchy(
      sourcePartner.type,
      destinationPartner.type,
      isChildOfSource,
      isChildOfDest,
      isReturn,
    );

    if (!isAllowedHierarchy) {
      throw new ForbiddenException(
        `Invalid allocation flow: Cannot ${isReturn ? 'return' : 'allocate'} stock from '${sourcePartner.type}' to '${destinationPartner.type}'`,
      );
    }

    // 3. Validate warehouses
    const sourceWarehouse = await db.warehouse.findUnique({ where: { id: sourceWarehouseId } });
    if (!sourceWarehouse) {
      throw new BadRequestException(`Source warehouse with ID '${sourceWarehouseId}' not found`);
    }
    if (sourceWarehouse.partnerId !== sourcePartnerId) {
      throw new BadRequestException('Source warehouse does not belong to the source partner');
    }

    const destinationWarehouse = await db.warehouse.findUnique({ where: { id: destinationWarehouseId } });
    if (!destinationWarehouse) {
      throw new BadRequestException(`Destination warehouse with ID '${destinationWarehouseId}' not found`);
    }
    if (destinationWarehouse.partnerId !== destinationPartnerId) {
      throw new BadRequestException('Destination warehouse does not belong to the destination partner');
    }

    // 4. Validate product
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new BadRequestException(`Product with ID '${productId}' not found`);
    }

    // 5. Validate stock availability at source
    const sourceInventory = await db.inventory.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: sourceWarehouseId,
          productId,
        },
      },
    });

    if (!sourceInventory || sourceInventory.quantity < quantity) {
      throw new BadRequestException(
        `Insufficient stock available in source warehouse. Available: ${sourceInventory?.quantity || 0}, Requested: ${quantity}`,
      );
    }

    // 6. Validate IMEI requirements if product is IMEI tracked
    let validatedImeis: string[] = [];
    if (product.IMEITracked) {
      if (!imeis || imeis.length !== quantity) {
        throw new BadRequestException(
          `Product requires exactly ${quantity} IMEI(s) for physical stock allocation`,
        );
      }

      if (new Set(imeis).size !== imeis.length) {
        throw new BadRequestException('Duplicate IMEIs provided in allocation request');
      }

      for (const imei of imeis) {
        const item = await db.inventoryItem.findUnique({
          where: { IMEI: imei },
        });

        if (!item) {
          throw new BadRequestException(`Physical inventory item with IMEI '${imei}' not found`);
        }
        if (item.productId !== productId) {
          throw new BadRequestException(`IMEI '${imei}' belongs to a different product`);
        }
        if (item.warehouseId !== sourceWarehouseId || item.partnerId !== sourcePartnerId) {
          throw new BadRequestException(`IMEI '${imei}' is not located in the source warehouse`);
        }
        if (item.status !== InventoryItemStatus.AVAILABLE) {
          throw new ConflictException(`IMEI '${imei}' is not available for transfer (Status: ${item.status})`);
        }
      }
      validatedImeis = imeis;
    }

    const validUserId = await this.resolveUserId(performedByUserId);

    const executeAllocation = async (tx: Prisma.TransactionClient) => {
      // Decrement source inventory
      const newSourceQuantity = sourceInventory.quantity - quantity;
      await tx.inventory.update({
        where: { id: sourceInventory.id },
        data: {
          quantity: newSourceQuantity,
          status: newSourceQuantity === 0 ? InventoryStatus.OUT_OF_STOCK : InventoryStatus.ACTIVE,
        },
      });

      // Upsert destination inventory
      const destInventory = await tx.inventory.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: destinationWarehouseId,
            productId,
          },
        },
        update: {
          quantity: { increment: quantity },
          status: InventoryStatus.ACTIVE,
        },
        create: {
          partnerId: destinationPartnerId,
          warehouseId: destinationWarehouseId,
          productId,
          quantity,
          status: InventoryStatus.ACTIVE,
        },
      });

      // Move physical IMEI items if applicable
      if (product.IMEITracked && validatedImeis.length > 0) {
        for (const imei of validatedImeis) {
          await tx.inventoryItem.update({
            where: { IMEI: imei },
            data: {
              inventoryId: destInventory.id,
              warehouseId: destinationWarehouseId,
              partnerId: destinationPartnerId,
              status: InventoryItemStatus.AVAILABLE,
            },
          });
        }
      }

      // Log StockMovement audit trail
      await tx.stockMovement.create({
        data: {
          productId,
          fromWarehouseId: sourceWarehouseId,
          toWarehouseId: destinationWarehouseId,
          fromPartnerId: sourcePartnerId,
          toPartnerId: destinationPartnerId,
          movementType: StockMovementType.TRANSFER,
          quantity,
          performedByUserId: validUserId,
          purchaseOrderId: purchaseOrderId || null,
          purchaseOrderLineId: purchaseOrderLineId || null,
        },
      });
    };

    if (prismaTx) {
      await executeAllocation(prismaTx);
    } else {
      await this.prisma.$transaction(async (tx) => {
        await executeAllocation(tx);
      });
    }

    return {
      success: true,
      productId,
      quantity,
      sourceWarehouseId,
      destinationWarehouseId,
      sourcePartnerId,
      destinationPartnerId,
      transferredImeis: product.IMEITracked ? validatedImeis : undefined,
    };
  }

  private async resolveUserId(userId?: string): Promise<string | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? user.id : null;
  }

  /**
   * Add Stock / Goods Received Note (GRN)
   */
  async addStock(currentUser: JwtPayloadUser, dto: AddStockDto) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new BadRequestException(`Warehouse with ID '${dto.warehouseId}' not found`);
    }

    // Authorize warehouse ownership
    if (currentUser.role !== RoleType.ADMIN && currentUser.role !== RoleType.SUPPLIER) {
      if (!currentUser.partnerId || warehouse.partnerId !== currentUser.partnerId) {
        throw new ForbiddenException('Access denied: Cannot add stock to a warehouse outside your partner organization');
      }
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new BadRequestException(`Product with ID '${dto.productId}' not found`);
    }

    if (product.IMEITracked) {
      if (!dto.imeis || dto.imeis.length !== dto.quantity) {
        throw new BadRequestException(
          `Product '${product.name}' is IMEI tracked and requires exactly ${dto.quantity} IMEI(s)`,
        );
      }

      if (new Set(dto.imeis).size !== dto.imeis.length) {
        throw new BadRequestException('Duplicate IMEIs provided in request');
      }

      for (const imei of dto.imeis) {
        const existing = await this.prisma.inventoryItem.findUnique({
          where: { IMEI: imei },
        });
        if (existing) {
          throw new ConflictException(`Inventory item with IMEI '${imei}' already exists`);
        }
      }
    }

    const validUserId = await this.resolveUserId(currentUser.userId);

    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
          },
        },
        update: {
          quantity: { increment: dto.quantity },
          status: InventoryStatus.ACTIVE,
        },
        create: {
          partnerId: warehouse.partnerId,
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          quantity: dto.quantity,
          status: InventoryStatus.ACTIVE,
        },
      });

      if (product.IMEITracked && dto.imeis) {
        for (const imei of dto.imeis) {
          await tx.inventoryItem.create({
            data: {
              inventoryId: inventory.id,
              productId: dto.productId,
              IMEI: imei,
              serialNumber: `SN-${imei}`,
              warehouseId: dto.warehouseId,
              partnerId: warehouse.partnerId,
              status: InventoryItemStatus.AVAILABLE,
            },
          });
        }
      }

      await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          toWarehouseId: dto.warehouseId,
          toPartnerId: warehouse.partnerId,
          movementType: StockMovementType.INBOUND,
          quantity: dto.quantity,
          performedByUserId: validUserId,
        },
      });

      return tx.inventory.findUnique({
        where: { id: inventory.id },
        include: {
          product: true,
          warehouse: true,
          partner: true,
          items: true,
        },
      });
    });
  }

  /**
   * Transfer stock between warehouses / partners
   */
  async transferStock(currentUser: JwtPayloadUser, dto: TransferStockDto) {
    const sourceWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.sourceWarehouseId },
    });
    if (!sourceWarehouse) {
      throw new BadRequestException(`Source warehouse with ID '${dto.sourceWarehouseId}' not found`);
    }

    const destWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.destinationWarehouseId },
    });
    if (!destWarehouse) {
      throw new BadRequestException(`Destination warehouse with ID '${dto.destinationWarehouseId}' not found`);
    }

    // Authorize source warehouse ownership
    if (currentUser.role !== RoleType.ADMIN && currentUser.role !== RoleType.SUPPLIER) {
      if (!currentUser.partnerId || sourceWarehouse.partnerId !== currentUser.partnerId) {
        throw new ForbiddenException('Access denied: Cannot transfer stock from a warehouse outside your partner organization');
      }
    }

    return this.allocateStock({
      sourcePartnerId: sourceWarehouse.partnerId,
      destinationPartnerId: destWarehouse.partnerId,
      productId: dto.productId,
      quantity: dto.quantity,
      sourceWarehouseId: dto.sourceWarehouseId,
      destinationWarehouseId: dto.destinationWarehouseId,
      imeis: dto.imeis,
      performedByUserId: currentUser.userId,
    });
  }

  /**
   * Query inventory with partner tenant scoping
   */
  async listInventory(currentUser: JwtPayloadUser, query: InventoryQueryDto) {
    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      return this.prisma.inventory.findMany({
        where: {
          ...(query.warehouseId && { warehouseId: query.warehouseId }),
          ...(query.productId && { productId: query.productId }),
          ...(query.partnerId && { partnerId: query.partnerId }),
        },
        include: {
          product: true,
          warehouse: true,
          partner: true,
          items: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!currentUser.partnerId) {
      throw new ForbiddenException('User is not associated with any partner organization');
    }

    if (currentUser.role === RoleType.DISTRIBUTOR) {
      const childDealers = await this.prisma.partner.findMany({
        where: { parentPartnerId: currentUser.partnerId },
        select: { id: true },
      });
      const allowedPartnerIds = [currentUser.partnerId, ...childDealers.map((d) => d.id)];

      if (query.warehouseId) {
        const wh = await this.prisma.warehouse.findUnique({ where: { id: query.warehouseId } });
        if (!wh || !allowedPartnerIds.includes(wh.partnerId)) {
          throw new ForbiddenException('Access denied to this warehouse inventory');
        }
        return this.prisma.inventory.findMany({
          where: {
            warehouseId: query.warehouseId,
            ...(query.productId && { productId: query.productId }),
          },
          include: { product: true, warehouse: true, partner: true, items: true },
          orderBy: { updatedAt: 'desc' },
        });
      }

      return this.prisma.inventory.findMany({
        where: {
          partnerId: { in: allowedPartnerIds },
          ...(query.productId && { productId: query.productId }),
        },
        include: { product: true, warehouse: true, partner: true, items: true },
        orderBy: { updatedAt: 'desc' },
      });
    }

    // Dealer & Direct Dealer scope strictly to their partner
    if (query.warehouseId) {
      const wh = await this.prisma.warehouse.findUnique({ where: { id: query.warehouseId } });
      if (!wh || wh.partnerId !== currentUser.partnerId) {
        throw new ForbiddenException('Access denied to this warehouse inventory');
      }
      return this.prisma.inventory.findMany({
        where: {
          warehouseId: query.warehouseId,
          ...(query.productId && { productId: query.productId }),
        },
        include: { product: true, warehouse: true, partner: true, items: true },
        orderBy: { updatedAt: 'desc' },
      });
    }

    return this.prisma.inventory.findMany({
      where: {
        partnerId: currentUser.partnerId,
        ...(query.productId && { productId: query.productId }),
      },
      include: { product: true, warehouse: true, partner: true, items: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Query individual physical inventory items with scoping
   */
  async listInventoryItems(currentUser: JwtPayloadUser, query: InventoryQueryDto) {
    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      return this.prisma.inventoryItem.findMany({
        where: {
          ...(query.warehouseId && { warehouseId: query.warehouseId }),
          ...(query.productId && { productId: query.productId }),
          ...(query.partnerId && { partnerId: query.partnerId }),
        },
        include: { product: true, warehouse: true, partner: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!currentUser.partnerId) {
      throw new ForbiddenException('User is not associated with any partner organization');
    }

    return this.prisma.inventoryItem.findMany({
      where: {
        partnerId: currentUser.partnerId,
        ...(query.warehouseId && { warehouseId: query.warehouseId }),
        ...(query.productId && { productId: query.productId }),
      },
      include: { product: true, warehouse: true, partner: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a pending stock transfer request
   */
  async createTransferRequest(currentUser: JwtPayloadUser, dto: any) {
    const sourceWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.sourceWarehouseId },
    });
    if (!sourceWarehouse) {
      throw new BadRequestException(`Source warehouse with ID '${dto.sourceWarehouseId}' not found`);
    }

    const destWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.destinationWarehouseId },
    });
    if (!destWarehouse) {
      throw new BadRequestException(`Destination warehouse with ID '${dto.destinationWarehouseId}' not found`);
    }

    // Authorize source warehouse ownership
    if (currentUser.role !== RoleType.ADMIN && currentUser.role !== RoleType.SUPPLIER) {
      if (!currentUser.partnerId || sourceWarehouse.partnerId !== currentUser.partnerId) {
        throw new ForbiddenException('Access denied: Cannot initiate transfer from a warehouse outside your partner organization');
      }
    }

    const validUserId = await this.resolveUserId(currentUser.userId);

    return this.prisma.stockTransferRequest.create({
      data: {
        productId: dto.productId,
        sourceWarehouseId: dto.sourceWarehouseId,
        destinationWarehouseId: dto.destinationWarehouseId,
        sourcePartnerId: sourceWarehouse.partnerId,
        destinationPartnerId: destWarehouse.partnerId,
        quantity: dto.quantity,
        imeis: dto.imeis || [],
        status: 'PENDING',
        requestedByUserId: validUserId,
      },
      include: {
        product: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        sourcePartner: true,
        destinationPartner: true,
      },
    });
  }

  /**
   * List transfer requests with partner scoping
   */
  async listTransferRequests(currentUser: JwtPayloadUser) {
    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      return this.prisma.stockTransferRequest.findMany({
        include: {
          product: true,
          sourceWarehouse: true,
          destinationWarehouse: true,
          sourcePartner: true,
          destinationPartner: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!currentUser.partnerId) {
      throw new ForbiddenException('User is not associated with any partner organization');
    }

    return this.prisma.stockTransferRequest.findMany({
      where: {
        OR: [
          { sourcePartnerId: currentUser.partnerId },
          { destinationPartnerId: currentUser.partnerId },
        ],
      },
      include: {
        product: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        sourcePartner: true,
        destinationPartner: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approve a pending transfer request (Receiving partner only)
   */
  async approveTransferRequest(id: string, currentUser: JwtPayloadUser) {
    const requestItem = await this.prisma.stockTransferRequest.findUnique({ where: { id } });
    if (!requestItem) {
      throw new NotFoundException(`Transfer request with ID '${id}' not found`);
    }

    if (requestItem.status !== 'PENDING') {
      throw new BadRequestException(`Transfer request is already ${requestItem.status}`);
    }

    // Only receiving partner (destination) or admin can approve
    if (currentUser.role !== RoleType.ADMIN) {
      if (!currentUser.partnerId || currentUser.partnerId !== requestItem.destinationPartnerId) {
        throw new ForbiddenException('Only the receiving partner organization can approve incoming transfer requests');
      }
    }

    // Execute atomic stock movement via allocateStock
    await this.allocateStock({
      sourcePartnerId: requestItem.sourcePartnerId,
      destinationPartnerId: requestItem.destinationPartnerId,
      productId: requestItem.productId,
      quantity: requestItem.quantity,
      sourceWarehouseId: requestItem.sourceWarehouseId,
      destinationWarehouseId: requestItem.destinationWarehouseId,
      imeis: requestItem.imeis,
      performedByUserId: currentUser.userId,
    });

    const validUserId = await this.resolveUserId(currentUser.userId);

    return this.prisma.stockTransferRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedByUserId: validUserId,
      },
      include: {
        product: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        sourcePartner: true,
        destinationPartner: true,
      },
    });
  }

  /**
   * Reject a pending transfer request (Receiving partner only)
   */
  async rejectTransferRequest(id: string, currentUser: JwtPayloadUser) {
    const requestItem = await this.prisma.stockTransferRequest.findUnique({ where: { id } });
    if (!requestItem) {
      throw new NotFoundException(`Transfer request with ID '${id}' not found`);
    }

    if (requestItem.status !== 'PENDING') {
      throw new BadRequestException(`Transfer request is already ${requestItem.status}`);
    }

    if (currentUser.role !== RoleType.ADMIN) {
      if (!currentUser.partnerId || currentUser.partnerId !== requestItem.destinationPartnerId) {
        throw new ForbiddenException('Only the receiving partner organization can reject incoming transfer requests');
      }
    }

    const validUserId = await this.resolveUserId(currentUser.userId);

    return this.prisma.stockTransferRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedByUserId: validUserId,
      },
      include: {
        product: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        sourcePartner: true,
        destinationPartner: true,
      },
    });
  }

  /**
   * Create a pending stock return request
   */
  async createReturnRequest(currentUser: JwtPayloadUser, dto: any) {
    const sourceWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.sourceWarehouseId },
    });
    if (!sourceWarehouse) {
      throw new BadRequestException(`Source warehouse with ID '${dto.sourceWarehouseId}' not found`);
    }

    const destWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.destinationWarehouseId },
    });
    if (!destWarehouse) {
      throw new BadRequestException(`Destination warehouse with ID '${dto.destinationWarehouseId}' not found`);
    }

    // Authorize source warehouse ownership
    if (currentUser.role !== RoleType.ADMIN && currentUser.role !== RoleType.SUPPLIER) {
      if (!currentUser.partnerId || sourceWarehouse.partnerId !== currentUser.partnerId) {
        throw new ForbiddenException('Access denied: Cannot initiate return from a warehouse outside your partner organization');
      }
    }

    const validUserId = await this.resolveUserId(currentUser.userId);

    return this.prisma.stockReturnRequest.create({
      data: {
        productId: dto.productId,
        sourceWarehouseId: dto.sourceWarehouseId,
        destinationWarehouseId: dto.destinationWarehouseId,
        sourcePartnerId: sourceWarehouse.partnerId,
        destinationPartnerId: destWarehouse.partnerId,
        quantity: dto.quantity,
        imeis: dto.imeis || [],
        reason: dto.reason || null,
        status: 'PENDING',
        requestedByUserId: validUserId,
      },
      include: {
        product: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        sourcePartner: true,
        destinationPartner: true,
      },
    });
  }

  /**
   * List return requests with partner scoping
   */
  async listReturnRequests(currentUser: JwtPayloadUser) {
    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      return this.prisma.stockReturnRequest.findMany({
        include: {
          product: true,
          sourceWarehouse: true,
          destinationWarehouse: true,
          sourcePartner: true,
          destinationPartner: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!currentUser.partnerId) {
      throw new ForbiddenException('User is not associated with any partner organization');
    }

    return this.prisma.stockReturnRequest.findMany({
      where: {
        OR: [
          { sourcePartnerId: currentUser.partnerId },
          { destinationPartnerId: currentUser.partnerId },
        ],
      },
      include: {
        product: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        sourcePartner: true,
        destinationPartner: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approve a pending return request (Receiving parent partner only)
   */
  async approveReturnRequest(id: string, currentUser: JwtPayloadUser) {
    const requestItem = await this.prisma.stockReturnRequest.findUnique({ where: { id } });
    if (!requestItem) {
      throw new NotFoundException(`Return request with ID '${id}' not found`);
    }

    if (requestItem.status !== 'PENDING') {
      throw new BadRequestException(`Return request is already ${requestItem.status}`);
    }

    if (currentUser.role !== RoleType.ADMIN) {
      if (!currentUser.partnerId || currentUser.partnerId !== requestItem.destinationPartnerId) {
        throw new ForbiddenException('Only the receiving parent partner organization can approve return requests');
      }
    }

    // Execute atomic stock movement with isReturn flag
    await this.allocateStock({
      sourcePartnerId: requestItem.sourcePartnerId,
      destinationPartnerId: requestItem.destinationPartnerId,
      productId: requestItem.productId,
      quantity: requestItem.quantity,
      sourceWarehouseId: requestItem.sourceWarehouseId,
      destinationWarehouseId: requestItem.destinationWarehouseId,
      imeis: requestItem.imeis,
      performedByUserId: currentUser.userId,
      isReturn: true,
    });

    const validUserId = await this.resolveUserId(currentUser.userId);

    return this.prisma.stockReturnRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedByUserId: validUserId,
      },
      include: {
        product: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        sourcePartner: true,
        destinationPartner: true,
      },
    });
  }

  /**
   * Reject a pending return request (Receiving parent partner only)
   */
  async rejectReturnRequest(id: string, currentUser: JwtPayloadUser) {
    const requestItem = await this.prisma.stockReturnRequest.findUnique({ where: { id } });
    if (!requestItem) {
      throw new NotFoundException(`Return request with ID '${id}' not found`);
    }

    if (requestItem.status !== 'PENDING') {
      throw new BadRequestException(`Return request is already ${requestItem.status}`);
    }

    if (currentUser.role !== RoleType.ADMIN) {
      if (!currentUser.partnerId || currentUser.partnerId !== requestItem.destinationPartnerId) {
        throw new ForbiddenException('Only the receiving parent partner organization can reject return requests');
      }
    }

    const validUserId = await this.resolveUserId(currentUser.userId);

    return this.prisma.stockReturnRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedByUserId: validUserId,
      },
      include: {
        product: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
        sourcePartner: true,
        destinationPartner: true,
      },
    });
  }
}

