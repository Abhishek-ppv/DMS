import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Controller('sales-orders')
@UseGuards(RolesGuard, PermissionsGuard)
export class SalesController {
  constructor(
    @Inject(SalesService)
    private readonly salesService: SalesService,
  ) {}

  @Post()
  @RequirePermission('ORDER', 'CREATE')
  async create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateSalesOrderDto,
  ) {
    return this.salesService.create(user, dto);
  }

  @Get()
  @RequirePermission('ORDER', 'READ')
  async findAll(
    @CurrentUser() user: JwtPayloadUser,
    @Query() query: SalesOrderQueryDto,
  ) {
    return this.salesService.findAll(user, query);
  }

  @Get(':id')
  @RequirePermission('ORDER', 'READ')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.salesService.findOne(id, user);
  }
}
