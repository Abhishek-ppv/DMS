import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleType } from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class CustomersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new customer, scoping it strictly to the current user's partner ID.
   */
  async createCustomer(currentUser: JwtPayloadUser, dto: CreateCustomerDto) {
    // 1. Enforce that only Dealers and Direct-Dealers can create customers
    if (currentUser.role !== RoleType.DEALER && currentUser.role !== RoleType.DIRECT_DEALER) {
      throw new ForbiddenException('Only Dealers and Direct-Dealers are authorized to create customers');
    }

    // 2. Validate user is associated with a partner
    if (!currentUser.partnerId) {
      throw new ForbiddenException('User must be associated with a partner organization to create a customer');
    }

    // 3. Create the customer owned by the user's partner
    return this.prisma.customer.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        partnerId: currentUser.partnerId,
      },
    });
  }

  /**
   * List customers, strictly scoped by partner boundaries.
   */
  async listCustomers(currentUser: JwtPayloadUser) {
    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      // Admins and Suppliers have full access
      return this.prisma.customer.findMany();
    }

    if (!currentUser.partnerId) {
      throw new ForbiddenException('User is not associated with any partner organization');
    }

    if (currentUser.role === RoleType.DISTRIBUTOR) {
      // Distributor sees customers of all its child Dealers
      const childDealers = await this.prisma.partner.findMany({
        where: { parentPartnerId: currentUser.partnerId },
        select: { id: true },
      });
      const dealerIds = childDealers.map((d) => d.id);
      return this.prisma.customer.findMany({
        where: {
          partnerId: { in: dealerIds },
        },
      });
    }

    // Dealers and Direct-Dealers only see their own customers
    return this.prisma.customer.findMany({
      where: {
        partnerId: currentUser.partnerId,
      },
    });
  }

  /**
   * Get a single customer by ID, enforcing tenant boundaries.
   */
  async getCustomerById(id: string, currentUser: JwtPayloadUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { partner: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID '${id}' not found`);
    }

    // Authorize read access
    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      return customer;
    }

    if (!currentUser.partnerId) {
      throw new ForbiddenException('User is not associated with any partner organization');
    }

    if (currentUser.role === RoleType.DISTRIBUTOR) {
      if (customer.partner.parentPartnerId !== currentUser.partnerId) {
        throw new ForbiddenException('Access denied to this customer');
      }
      return customer;
    }

    // Dealer / Direct-Dealer can only access their own customer
    if (customer.partnerId !== currentUser.partnerId) {
      throw new ForbiddenException('Access denied to this customer');
    }

    return customer;
  }

  /**
   * Update customer details.
   */
  async updateCustomer(id: string, currentUser: JwtPayloadUser, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID '${id}' not found`);
    }

    // Authorize write access
    if (currentUser.role !== RoleType.ADMIN && currentUser.role !== RoleType.SUPPLIER) {
      if (!currentUser.partnerId || customer.partnerId !== currentUser.partnerId) {
        throw new ForbiddenException('Access denied to modify this customer');
      }
    }

    // Perform update, ignoring partnerId changes to enforce ownership lock
    return this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        status: dto.status,
      },
    });
  }

  /**
   * Delete a customer.
   */
  async deleteCustomer(id: string, currentUser: JwtPayloadUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID '${id}' not found`);
    }

    // Authorize delete access
    if (currentUser.role !== RoleType.ADMIN && currentUser.role !== RoleType.SUPPLIER) {
      if (!currentUser.partnerId || customer.partnerId !== currentUser.partnerId) {
        throw new ForbiddenException('Access denied to delete this customer');
      }
    }

    return this.prisma.customer.delete({
      where: { id },
    });
  }
}
