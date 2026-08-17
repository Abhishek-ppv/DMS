import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';

@Injectable()
export class WarehousesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new warehouse
   */
  async create(currentUser: JwtPayloadUser, dto: CreateWarehouseDto) {
    let targetPartnerId: string | null = null;

    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      targetPartnerId = dto.partnerId || currentUser.partnerId;
      if (!targetPartnerId) {
        throw new BadRequestException('Partner ID is required for warehouse creation');
      }
      const partnerExists = await this.prisma.partner.findUnique({ where: { id: targetPartnerId } });
      if (!partnerExists) {
        throw new BadRequestException(`Partner with ID '${targetPartnerId}' not found`);
      }
    } else {
      if (!currentUser.partnerId) {
        throw new ForbiddenException('User is not associated with any partner organization');
      }
      targetPartnerId = currentUser.partnerId;
    }

    const existingCode = await this.prisma.warehouse.findUnique({
      where: { code: dto.code },
    });
    if (existingCode) {
      throw new BadRequestException(`Warehouse with code '${dto.code}' already exists`);
    }

    return this.prisma.warehouse.create({
      data: {
        name: dto.name,
        code: dto.code,
        location: dto.location,
        status: dto.status,
        partnerId: targetPartnerId,
      },
      include: {
        partner: true,
      },
    });
  }

  /**
   * List warehouses strictly scoped by partner tenant boundaries
   */
  async findAll(currentUser: JwtPayloadUser) {
    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      return this.prisma.warehouse.findMany({
        include: { partner: true },
        orderBy: { createdAt: 'desc' },
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
      const partnerIds = [currentUser.partnerId, ...childDealers.map((d) => d.id)];

      return this.prisma.warehouse.findMany({
        where: { partnerId: { in: partnerIds } },
        include: { partner: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.warehouse.findMany({
      where: { partnerId: currentUser.partnerId },
      include: { partner: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single warehouse with partner authorization check
   */
  async findOne(id: string, currentUser: JwtPayloadUser) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { partner: true },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID '${id}' not found`);
    }

    if (currentUser.role === RoleType.ADMIN || currentUser.role === RoleType.SUPPLIER) {
      return warehouse;
    }

    if (!currentUser.partnerId) {
      throw new ForbiddenException('Access denied to this warehouse');
    }

    if (currentUser.role === RoleType.DISTRIBUTOR) {
      const isOwnPartner = warehouse.partnerId === currentUser.partnerId;
      const isChildPartner = warehouse.partner.parentPartnerId === currentUser.partnerId;

      if (!isOwnPartner && !isChildPartner) {
        throw new ForbiddenException('Access denied to this warehouse');
      }
      return warehouse;
    }

    if (warehouse.partnerId !== currentUser.partnerId) {
      throw new ForbiddenException('Access denied to this warehouse');
    }

    return warehouse;
  }

  /**
   * Update warehouse
   */
  async update(id: string, currentUser: JwtPayloadUser, dto: UpdateWarehouseDto) {
    const existing = await this.findOne(id, currentUser);

    if (dto.partnerId && dto.partnerId !== existing.partnerId) {
      if (currentUser.role !== RoleType.ADMIN && currentUser.role !== RoleType.SUPPLIER) {
        throw new ForbiddenException('Cannot change warehouse partner ownership');
      }
      const partnerExists = await this.prisma.partner.findUnique({ where: { id: dto.partnerId } });
      if (!partnerExists) {
        throw new BadRequestException(`Partner with ID '${dto.partnerId}' not found`);
      }
    }

    if (dto.code && dto.code !== existing.code) {
      const codeExists = await this.prisma.warehouse.findUnique({ where: { code: dto.code } });
      if (codeExists) {
        throw new BadRequestException(`Warehouse with code '${dto.code}' already exists`);
      }
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.partnerId !== undefined && { partnerId: dto.partnerId }),
      },
      include: { partner: true },
    });
  }

  /**
   * Delete warehouse
   */
  async remove(id: string, currentUser: JwtPayloadUser) {
    await this.findOne(id, currentUser);

    return this.prisma.warehouse.delete({
      where: { id },
    });
  }
}
