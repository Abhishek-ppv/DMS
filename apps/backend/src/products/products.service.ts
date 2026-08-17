import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PartnerType, RoleType } from '@prisma/client';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper to resolve IMEI tracking flag from aliases.
   */
  private resolveImeiTracked(dto: CreateProductDto | UpdateProductDto): boolean | undefined {
    if (dto.IMEITracked !== undefined) return dto.IMEITracked;
    if (dto.is_imei_tracked !== undefined) return dto.is_imei_tracked;
    if (dto.isImeiTracked !== undefined) return dto.isImeiTracked;
    return undefined;
  }

  /**
   * Helper to sync ProductPricing records for a product
   */
  private async syncProductPricing(productId: string, prices: {
    supplierPrice?: number;
    distributorPrice?: number;
    dealerPrice?: number;
    directDealerPrice?: number;
  }) {
    const tierMap: Array<{ type: PartnerType; price?: number }> = [
      { type: PartnerType.SUPPLIER, price: prices.supplierPrice },
      { type: PartnerType.DISTRIBUTOR, price: prices.distributorPrice },
      { type: PartnerType.DEALER, price: prices.dealerPrice },
      { type: PartnerType.DIRECT_DEALER, price: prices.directDealerPrice },
    ];

    for (const item of tierMap) {
      if (item.price !== undefined) {
        await this.prisma.productPricing.upsert({
          where: {
            productId_partnerType: {
              productId,
              partnerType: item.type,
            },
          },
          update: { price: item.price },
          create: {
            productId,
            partnerType: item.type,
            price: item.price,
          },
        });
      }
    }
  }

  /**
   * Helper to determine user partnerType from JWT / DB
   */
  private async getUserPartnerType(currentUser?: JwtPayloadUser): Promise<{ partnerType: PartnerType | null; isAdminOrSupplier: boolean }> {
    if (!currentUser) {
      return { partnerType: PartnerType.SUPPLIER, isAdminOrSupplier: true };
    }

    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      return { partnerType: PartnerType.SUPPLIER, isAdminOrSupplier: true };
    }

    if (currentUser.partnerId) {
      const partner = await this.prisma.partner.findUnique({
        where: { id: currentUser.partnerId },
        select: { type: true },
      });
      if (partner) {
        const isSupplier = partner.type === PartnerType.SUPPLIER;
        return { partnerType: partner.type, isAdminOrSupplier: isSupplier };
      }
    }

    // Fallback based on RoleType if partner record is not attached
    if (currentUser.role === RoleType.DISTRIBUTOR) return { partnerType: PartnerType.DISTRIBUTOR, isAdminOrSupplier: false };
    if (currentUser.role === RoleType.DEALER) return { partnerType: PartnerType.DEALER, isAdminOrSupplier: false };
    if (currentUser.role === RoleType.DIRECT_DEALER) return { partnerType: PartnerType.DIRECT_DEALER, isAdminOrSupplier: false };

    return { partnerType: null, isAdminOrSupplier: false };
  }

  /**
   * Create a product
   */
  async create(dto: CreateProductDto) {
    // 1. Category existence validation
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new BadRequestException(`Category with ID '${dto.categoryId}' not found`);
    }

    // 2. SKU uniqueness validation
    const existingSku = await this.prisma.product.findUnique({
      where: { SKU: dto.SKU },
    });
    if (existingSku) {
      throw new BadRequestException(`Product with SKU '${dto.SKU}' already exists`);
    }

    // 3. Resolve IMEITracked flag
    const imeiTracked = this.resolveImeiTracked(dto) ?? true;

    const product = await this.prisma.product.create({
      data: {
        SKU: dto.SKU,
        name: dto.name,
        brand: dto.brand,
        categoryId: dto.categoryId,
        model: dto.model,
        description: dto.description,
        MRP: dto.MRP,
        supplierPrice: dto.supplierPrice,
        distributorPrice: dto.distributorPrice,
        dealerPrice: dto.dealerPrice,
        directDealerPrice: dto.directDealerPrice,
        tax: dto.tax || 0.00,
        warrantyPeriod: dto.warrantyPeriod || 12,
        IMEITracked: imeiTracked,
        status: dto.status,
      },
      include: {
        category: true,
        pricings: true,
      },
    });

    // 4. Sync ProductPricing normalized records
    await this.syncProductPricing(product.id, {
      supplierPrice: dto.supplierPrice,
      distributorPrice: dto.distributorPrice,
      dealerPrice: dto.dealerPrice,
      directDealerPrice: dto.directDealerPrice,
    });

    return this.prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, pricings: true },
    });
  }

  /**
   * List all products with partner tier price filtering based on authenticated user
   */
  async findAll(currentUser?: JwtPayloadUser) {
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
        pricings: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const { partnerType, isAdminOrSupplier } = await this.getUserPartnerType(currentUser);

    if (isAdminOrSupplier || !partnerType) {
      // Full product access with all pricing tiers
      return products;
    }

    // Filter response for tier-scoped partner (DISTRIBUTOR, DEALER, DIRECT_DEALER)
    return products.map((prod) => {
      let applicablePrice: any = Number(prod.MRP);

      // Check normalized ProductPricing table first
      const tierPricing = prod.pricings?.find((p) => p.partnerType === partnerType);
      if (tierPricing) {
        applicablePrice = tierPricing.price;
      } else {
        // Fallback to model column
        if (partnerType === PartnerType.DISTRIBUTOR) applicablePrice = prod.distributorPrice;
        else if (partnerType === PartnerType.DEALER) applicablePrice = prod.dealerPrice;
        else if (partnerType === PartnerType.DIRECT_DEALER) applicablePrice = prod.directDealerPrice;
      }

      // Return sanitized object with only MRP and applicable tier price
      return {
        id: prod.id,
        SKU: prod.SKU,
        name: prod.name,
        brand: prod.brand,
        categoryId: prod.categoryId,
        category: prod.category,
        model: prod.model,
        description: prod.description,
        MRP: prod.MRP,
        price: applicablePrice,
        tax: prod.tax,
        warrantyPeriod: prod.warrantyPeriod,
        IMEITracked: prod.IMEITracked,
        status: prod.status,
        createdAt: prod.createdAt,
        updatedAt: prod.updatedAt,
      };
    });
  }

  /**
   * Get product by ID with tier price filtering based on authenticated user
   */
  async findOne(id: string, currentUser?: JwtPayloadUser) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        pricings: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found`);
    }

    const { partnerType, isAdminOrSupplier } = await this.getUserPartnerType(currentUser);

    if (isAdminOrSupplier || !partnerType) {
      return product;
    }

    let applicablePrice: any = Number(product.MRP);
    const tierPricing = product.pricings?.find((p) => p.partnerType === partnerType);
    if (tierPricing) {
      applicablePrice = tierPricing.price;
    } else {
      if (partnerType === PartnerType.DISTRIBUTOR) applicablePrice = product.distributorPrice;
      else if (partnerType === PartnerType.DEALER) applicablePrice = product.dealerPrice;
      else if (partnerType === PartnerType.DIRECT_DEALER) applicablePrice = product.directDealerPrice;
    }

    return {
      id: product.id,
      SKU: product.SKU,
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      category: product.category,
      model: product.model,
      description: product.description,
      MRP: product.MRP,
      price: applicablePrice,
      tax: product.tax,
      warrantyPeriod: product.warrantyPeriod,
      IMEITracked: product.IMEITracked,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /**
   * Update product
   */
  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    // Validate category if provided
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException(`Category with ID '${dto.categoryId}' not found`);
      }
    }

    // Validate SKU uniqueness if changing SKU
    if (dto.SKU) {
      const existingSku = await this.prisma.product.findUnique({
        where: { SKU: dto.SKU },
      });
      if (existingSku && existingSku.id !== id) {
        throw new BadRequestException(`Product with SKU '${dto.SKU}' already exists`);
      }
    }

    const imeiTracked = this.resolveImeiTracked(dto);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.SKU !== undefined && { SKU: dto.SKU }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.MRP !== undefined && { MRP: dto.MRP }),
        ...(dto.supplierPrice !== undefined && { supplierPrice: dto.supplierPrice }),
        ...(dto.distributorPrice !== undefined && { distributorPrice: dto.distributorPrice }),
        ...(dto.dealerPrice !== undefined && { dealerPrice: dto.dealerPrice }),
        ...(dto.directDealerPrice !== undefined && { directDealerPrice: dto.directDealerPrice }),
        ...(dto.tax !== undefined && { tax: dto.tax }),
        ...(dto.warrantyPeriod !== undefined && { warrantyPeriod: dto.warrantyPeriod }),
        ...(imeiTracked !== undefined && { IMEITracked: imeiTracked }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        category: true,
        pricings: true,
      },
    });

    await this.syncProductPricing(id, {
      supplierPrice: dto.supplierPrice,
      distributorPrice: dto.distributorPrice,
      dealerPrice: dto.dealerPrice,
      directDealerPrice: dto.directDealerPrice,
    });

    return this.prisma.product.findUnique({
      where: { id },
      include: { category: true, pricings: true },
    });
  }

  /**
   * Delete product
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.delete({
      where: { id },
    });
  }
}

