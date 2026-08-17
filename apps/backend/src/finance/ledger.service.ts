import { Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleType, PartnerType } from '@prisma/client';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class LedgerService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper: Resolve authorized partner IDs for currentUser.
   */
  async getAuthorizedPartnerIds(currentUser: JwtPayloadUser): Promise<string[] | null> {
    if (currentUser.role === RoleType.ADMIN) {
      return null; // Null means unrestricted access
    }

    if (!currentUser.partnerId) {
      throw new ForbiddenException('Authenticated user is not associated with any partner organization');
    }

    if (currentUser.role === RoleType.SUPPLIER) {
      // Supplier gets its own ID + all hierarchy descendants (Distributors, Dealers, Direct Dealers)
      const supplierPartnerId = currentUser.partnerId;

      // 1. Direct children (Distributors & Direct Dealers)
      const children = await this.prisma.partner.findMany({
        where: { parentPartnerId: supplierPartnerId },
        select: { id: true, type: true },
      });

      const childIds = children.map((c) => c.id);
      const distributorIds = children
        .filter((c) => c.type === PartnerType.DISTRIBUTOR)
        .map((c) => c.id);

      // 2. Grandchildren (Dealers under Distributors)
      let grandChildIds: string[] = [];
      if (distributorIds.length > 0) {
        const dealers = await this.prisma.partner.findMany({
          where: { parentPartnerId: { in: distributorIds } },
          select: { id: true },
        });
        grandChildIds = dealers.map((d) => d.id);
      }

      return Array.from(new Set([supplierPartnerId, ...childIds, ...grandChildIds]));
    }

    // Distributor, Dealer, Direct Dealer: only their own partnerId
    return [currentUser.partnerId];
  }

  /**
   * GET /ledger - View-Only Ledger query with database-level partner scoping.
   */
  async getLedger(currentUser: JwtPayloadUser) {
    const authorizedPartnerIds = await this.getAuthorizedPartnerIds(currentUser);

    const whereClause: any = {};
    if (authorizedPartnerIds !== null) {
      whereClause.partnerId = { in: authorizedPartnerIds };
    }

    return this.prisma.ledger.findMany({
      where: whereClause,
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }
}
