import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerType, PartnerStatus, RoleType } from '@prisma/client';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { DirectDealerOnboardDto } from './dto/direct-dealer-onboard.dto';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class PartnersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Validate if a parent/child relationship is allowed in the DMS hierarchy.
   */
  validateHierarchy(parentType: PartnerType, childType: PartnerType): boolean {
    if (parentType === PartnerType.SUPPLIER) {
      if (childType === PartnerType.DISTRIBUTOR || childType === PartnerType.DIRECT_DEALER) {
        return true;
      }
    } else if (parentType === PartnerType.DISTRIBUTOR) {
      if (childType === PartnerType.DEALER) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a new partner and validate hierarchy.
   */
  async createPartner(currentUser: JwtPayloadUser, dto: CreatePartnerDto) {
    // 1. Enforce RBAC roles
    if (
      currentUser.role !== RoleType.ADMIN &&
      currentUser.role !== RoleType.SUPPLIER &&
      currentUser.role !== RoleType.DISTRIBUTOR
    ) {
      throw new ForbiddenException('User role is not authorized to create partners');
    }

    // 2. Determine target parent and validate scope
    let parentPartnerId = dto.parentPartnerId || null;

    if (currentUser.role === RoleType.DISTRIBUTOR) {
      // Distributor can only create Dealers under themselves
      if (dto.type !== PartnerType.DEALER) {
        throw new ForbiddenException('Distributors can only create DEALER partners');
      }
      if (!currentUser.partnerId) {
        throw new ForbiddenException('Distributor user must be associated with a partner organization');
      }
      // Enforce parentPartnerId matches Distributor's partnerId
      if (parentPartnerId && parentPartnerId !== currentUser.partnerId) {
        throw new BadRequestException('Distributors can only create partners under their own organization');
      }
      parentPartnerId = currentUser.partnerId;
    } else if (currentUser.role === RoleType.SUPPLIER) {
      // Supplier can create Distributor or Direct-Dealer under themselves
      if (dto.type !== PartnerType.DISTRIBUTOR && dto.type !== PartnerType.DIRECT_DEALER) {
        throw new ForbiddenException('Suppliers can only create DISTRIBUTOR or DIRECT_DEALER partners');
      }
      if (!currentUser.partnerId) {
        throw new ForbiddenException('Supplier user must be associated with a partner organization');
      }
      if (parentPartnerId && parentPartnerId !== currentUser.partnerId) {
        throw new BadRequestException('Suppliers can only create partners under their own organization');
      }
      parentPartnerId = currentUser.partnerId;
    } else if (currentUser.role === RoleType.ADMIN) {
      // Admin can create any partner type. Auto-resolve parent if not explicitly specified.
      if (!parentPartnerId) {
        if (dto.type === PartnerType.DISTRIBUTOR || dto.type === PartnerType.DIRECT_DEALER) {
          const supplier = currentUser.partnerId
            ? await this.prisma.partner.findUnique({ where: { id: currentUser.partnerId } })
            : await this.prisma.partner.findFirst({ where: { type: PartnerType.SUPPLIER } });

          if (supplier) {
            parentPartnerId = supplier.id;
          }
        } else if (dto.type === PartnerType.DEALER) {
          const distributor = await this.prisma.partner.findFirst({ where: { type: PartnerType.DISTRIBUTOR } });
          if (distributor) {
            parentPartnerId = distributor.id;
          }
        }
      }
    }

    // 3. If parentPartnerId is provided, validate parent existence and type compatibility
    if (parentPartnerId) {
      const parent = await this.prisma.partner.findUnique({
        where: { id: parentPartnerId },
      });
      if (!parent) {
        throw new BadRequestException(`Parent partner with ID '${parentPartnerId}' not found`);
      }
      const isValid = this.validateHierarchy(parent.type, dto.type);
      if (!isValid) {
        throw new BadRequestException(
          `Invalid hierarchy relationship: Parent type '${parent.type}' cannot have child type '${dto.type}'`,
        );
      }
    } else {
      // If parentPartnerId is null, only SUPPLIER type is allowed without a parent (only for ADMIN)
      if (dto.type !== PartnerType.SUPPLIER) {
        throw new BadRequestException('Only SUPPLIER partners can be created without a parent');
      }
      if (currentUser.role !== RoleType.ADMIN) {
        throw new ForbiddenException('Only system administrators can create root SUPPLIER partners');
      }
    }

    // 4. Create partner in DB
    return this.prisma.partner.create({
      data: {
        name: dto.name,
        type: dto.type,
        parentPartnerId,
        territory: dto.territory,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        creditLimit: dto.creditLimit || 0.00,
        status: dto.status || PartnerStatus.ACTIVE,
      },
    });
  }

  /**
   * List partners with role-based scoping.
   */
  async listPartners(currentUser: JwtPayloadUser) {
    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      return this.prisma.partner.findMany();
    }

    if (!currentUser.partnerId) {
      throw new ForbiddenException('User is not associated with any partner organization');
    }

    if (currentUser.role === RoleType.DISTRIBUTOR) {
      // Return themselves and their child Dealers
      return this.prisma.partner.findMany({
        where: {
          OR: [
            { id: currentUser.partnerId },
            { parentPartnerId: currentUser.partnerId },
          ],
        },
      });
    }

    // Dealers and Direct Dealers can only see themselves
    return this.prisma.partner.findMany({
      where: {
        id: currentUser.partnerId,
      },
    });
  }

  /**
   * Get partner by ID, checking hierarchy authorization.
   */
  async getPartnerById(id: string, currentUser: JwtPayloadUser) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw new NotFoundException(`Partner with ID '${id}' not found`);
    }

    // Check permissions/scoping
    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      return partner;
    }

    if (!currentUser.partnerId) {
      throw new ForbiddenException('User is not associated with any partner organization');
    }

    if (currentUser.role === RoleType.DISTRIBUTOR) {
      // Authorized if it is themselves or their child
      if (partner.id === currentUser.partnerId || partner.parentPartnerId === currentUser.partnerId) {
        return partner;
      }
      throw new ForbiddenException('Access denied to this partner organization');
    }

    // Dealer/Direct Dealer can only access themselves
    if (partner.id === currentUser.partnerId) {
      return partner;
    }

    throw new ForbiddenException('Access denied to this partner organization');
  }

  /**
   * Get descendants of a partner.
   */
  async getDescendants(id: string, currentUser: JwtPayloadUser) {
    // 1. Validate authorization to read descendants of the target ID
    if (currentUser.role !== RoleType.ADMIN && currentUser.role !== RoleType.SUPPLIER) {
      if (!currentUser.partnerId || currentUser.partnerId !== id) {
        throw new ForbiddenException('Access denied to query descendants of this partner organization');
      }
    }

    const partner = await this.prisma.partner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw new NotFoundException(`Partner with ID '${id}' not found`);
    }

    // 2. Fetch direct children
    const children = await this.prisma.partner.findMany({
      where: { parentPartnerId: id },
    });

    // 3. Fetch grandchildren if target is Supplier (max depth: Supplier -> Distributor -> Dealer)
    if (partner.type === PartnerType.SUPPLIER) {
      const distributorIds = children
        .filter((c) => c.type === PartnerType.DISTRIBUTOR)
        .map((c) => c.id);

      if (distributorIds.length > 0) {
        const dealers = await this.prisma.partner.findMany({
          where: { parentPartnerId: { in: distributorIds } },
        });
        return [...children, ...dealers];
      }
    }

    return children;
  }

  /**
   * Get ancestors of a partner.
   */
  async getAncestors(id: string, currentUser: JwtPayloadUser) {
    // 1. Authorize current user can read the target partner
    await this.getPartnerById(id, currentUser);

    const ancestors = [];
    let currentId = id;

    // Resolve ancestors iteratively (max depth is small in this model)
    while (currentId) {
      const partner = await this.prisma.partner.findUnique({
        where: { id: currentId },
        select: { parentPartnerId: true },
      });

      if (!partner || !partner.parentPartnerId) {
        break;
      }

      const parent = await this.prisma.partner.findUnique({
        where: { id: partner.parentPartnerId },
      });

      if (parent) {
        ancestors.push(parent);
        currentId = parent.id;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Onboard a Direct-Dealer (associates it directly with Supplier).
   */
  async onboardDirectDealer(currentUser: JwtPayloadUser, dto: DirectDealerOnboardDto) {
    // 1. Enforce Role: SUPPLIER or ADMIN only
    if (currentUser.role !== RoleType.SUPPLIER && currentUser.role !== RoleType.ADMIN) {
      throw new ForbiddenException('Only Suppliers and Administrators can onboard Direct-Dealers');
    }

    // 2. Resolve parent Supplier partner ID
    let parentPartnerId = currentUser.partnerId;

    if (currentUser.role === RoleType.ADMIN) {
      // Find the primary/first seeded Supplier
      const supplierPartner = await this.prisma.partner.findFirst({
        where: { type: PartnerType.SUPPLIER },
      });
      if (!supplierPartner) {
        throw new BadRequestException('No Supplier partner found in database to associate Direct-Dealer with');
      }
      parentPartnerId = supplierPartner.id;
    }

    if (!parentPartnerId) {
      throw new ForbiddenException('Supplier user must be associated with a partner organization');
    }

    // 3. Create/approve Direct-Dealer
    return this.prisma.partner.create({
      data: {
        name: dto.name,
        type: PartnerType.DIRECT_DEALER,
        parentPartnerId,
        territory: dto.territory,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        creditLimit: dto.creditLimit || 0.00,
        status: PartnerStatus.ACTIVE,
      },
    });
  }

  /**
   * Update partner details including credit limit.
   */
  async updatePartner(id: string, currentUser: JwtPayloadUser, dto: any) {
    // 1. Check permissions and existence
    await this.getPartnerById(id, currentUser);

    // 2. Perform update
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.territory !== undefined) updateData.territory = dto.territory;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.creditLimit !== undefined) updateData.creditLimit = dto.creditLimit;
    if (dto.status !== undefined) updateData.status = dto.status;

    return this.prisma.partner.update({
      where: { id },
      data: updateData,
    });
  }
}

