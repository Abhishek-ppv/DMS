import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderQueryDto } from './dto/purchase-order-query.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Controller('purchase-orders')
@UseGuards(RolesGuard, PermissionsGuard)
export class PurchaseOrdersController {
  constructor(
    @Inject(PurchaseOrdersService)
    private readonly purchaseOrdersService: PurchaseOrdersService,
  ) {}

  @Post()
  @RequirePermission('ORDER', 'CREATE')
  async create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.create(user, dto);
  }

  @Get()
  @RequirePermission('ORDER', 'READ')
  async findAll(
    @CurrentUser() user: JwtPayloadUser,
    @Query() query: PurchaseOrderQueryDto,
  ) {
    return this.purchaseOrdersService.findAll(user, query);
  }

  @Get(':id')
  @RequirePermission('ORDER', 'READ')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.purchaseOrdersService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermission('ORDER', 'UPDATE')
  async updateDraft(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.updateDraft(id, user, dto);
  }

  @Post(':id/place')
  @RequirePermission('ORDER', 'CREATE')
  async place(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.purchaseOrdersService.place(id, user);
  }

  @Post(':id/approve')
  @RequirePermission('ORDER', 'UPDATE')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.purchaseOrdersService.approve(id, user);
  }

  @Post(':id/reject')
  @RequirePermission('ORDER', 'UPDATE')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.purchaseOrdersService.reject(id, user);
  }

  @Post(':id/dispatch')
  @RequirePermission('ORDER', 'UPDATE')
  async dispatch(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.purchaseOrdersService.dispatch(id, user);
  }

  @Post(':id/deliver')
  @RequirePermission('ORDER', 'UPDATE')
  async deliver(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.purchaseOrdersService.deliver(id, user);
  }
}
