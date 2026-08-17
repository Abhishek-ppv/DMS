import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@Controller('customers')
@UseGuards(RolesGuard, PermissionsGuard)
export class CustomersController {
  constructor(
    @Inject(CustomersService)
    private readonly customersService: CustomersService,
  ) {}

  @Post()
  @RequirePermission('CUSTOMER', 'CREATE')
  async create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateCustomerDto) {
    return this.customersService.createCustomer(user, dto);
  }

  @Get()
  @RequirePermission('CUSTOMER', 'READ')
  async findAll(@CurrentUser() user: JwtPayloadUser) {
    return this.customersService.listCustomers(user);
  }

  @Get(':id')
  @RequirePermission('CUSTOMER', 'READ')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.customersService.getCustomerById(id, user);
  }

  @Patch(':id')
  @RequirePermission('CUSTOMER', 'UPDATE')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateCustomer(id, user, dto);
  }

  @Delete(':id')
  @RequirePermission('CUSTOMER', 'DELETE')
  async remove(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.customersService.deleteCustomer(id, user);
  }
}
