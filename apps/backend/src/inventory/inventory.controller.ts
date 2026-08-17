import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AddStockDto } from './dto/add-stock.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';
import { CreateTransferRequestDto } from './dto/create-transfer-request.dto';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Controller('inventory')
@UseGuards(RolesGuard, PermissionsGuard)
export class InventoryController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
  ) {}

  @Post('stock')
  @RequirePermission('INVENTORY', 'CREATE')
  async addStock(@CurrentUser() user: JwtPayloadUser, @Body() dto: AddStockDto) {
    return this.inventoryService.addStock(user, dto);
  }

  @Post('grn')
  @RequirePermission('INVENTORY', 'CREATE')
  async grn(@CurrentUser() user: JwtPayloadUser, @Body() dto: AddStockDto) {
    return this.inventoryService.addStock(user, dto);
  }

  @Post('transfer')
  @RequirePermission('INVENTORY', 'UPDATE')
  async transferStock(@CurrentUser() user: JwtPayloadUser, @Body() dto: TransferStockDto) {
    return this.inventoryService.transferStock(user, dto);
  }

  @Post('transfer-requests')
  @RequirePermission('INVENTORY', 'UPDATE')
  async createTransferRequest(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateTransferRequestDto) {
    return this.inventoryService.createTransferRequest(user, dto);
  }

  @Get('transfer-requests')
  @RequirePermission('INVENTORY', 'READ')
  async listTransferRequests(@CurrentUser() user: JwtPayloadUser) {
    return this.inventoryService.listTransferRequests(user);
  }

  @Patch('transfer-requests/:id/approve')
  @RequirePermission('INVENTORY', 'UPDATE')
  async approveTransferRequest(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.inventoryService.approveTransferRequest(id, user);
  }

  @Patch('transfer-requests/:id/reject')
  @RequirePermission('INVENTORY', 'UPDATE')
  async rejectTransferRequest(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.inventoryService.rejectTransferRequest(id, user);
  }

  @Post('return-requests')
  @RequirePermission('INVENTORY', 'UPDATE')
  async createReturnRequest(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateReturnRequestDto) {
    return this.inventoryService.createReturnRequest(user, dto);
  }

  @Get('return-requests')
  @RequirePermission('INVENTORY', 'READ')
  async listReturnRequests(@CurrentUser() user: JwtPayloadUser) {
    return this.inventoryService.listReturnRequests(user);
  }

  @Patch('return-requests/:id/approve')
  @RequirePermission('INVENTORY', 'UPDATE')
  async approveReturnRequest(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.inventoryService.approveReturnRequest(id, user);
  }

  @Patch('return-requests/:id/reject')
  @RequirePermission('INVENTORY', 'UPDATE')
  async rejectReturnRequest(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.inventoryService.rejectReturnRequest(id, user);
  }

  @Get()
  @RequirePermission('INVENTORY', 'READ')
  async findAll(@CurrentUser() user: JwtPayloadUser, @Query() query: InventoryQueryDto) {
    return this.inventoryService.listInventory(user, query);
  }

  @Get('items')
  @RequirePermission('INVENTORY', 'READ')
  async findItems(@CurrentUser() user: JwtPayloadUser, @Query() query: InventoryQueryDto) {
    return this.inventoryService.listInventoryItems(user, query);
  }
}
