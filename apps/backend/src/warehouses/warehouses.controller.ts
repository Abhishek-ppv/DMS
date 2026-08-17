import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Controller('warehouses')
@UseGuards(RolesGuard, PermissionsGuard)
export class WarehousesController {
  constructor(
    @Inject(WarehousesService)
    private readonly warehousesService: WarehousesService,
  ) {}

  @Post()
  @RequirePermission('WAREHOUSE', 'CREATE')
  async create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(user, dto);
  }

  @Get()
  @RequirePermission('WAREHOUSE', 'READ')
  async findAll(@CurrentUser() user: JwtPayloadUser) {
    return this.warehousesService.findAll(user);
  }

  @Get(':id')
  @RequirePermission('WAREHOUSE', 'READ')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.warehousesService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermission('WAREHOUSE', 'UPDATE')
  async update(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, user, dto);
  }

  @Delete(':id')
  @RequirePermission('WAREHOUSE', 'DELETE')
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.warehousesService.remove(id, user);
  }
}
