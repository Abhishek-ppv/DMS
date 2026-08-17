import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Controller('products')
@UseGuards(RolesGuard, PermissionsGuard)
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService,
  ) {}

  @Post()
  @RequirePermission('PRODUCT', 'CREATE')
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  @RequirePermission('PRODUCT', 'READ')
  async findAll(@CurrentUser() user: JwtPayloadUser) {
    return this.productsService.findAll(user);
  }

  @Get(':id')
  @RequirePermission('PRODUCT', 'READ')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.productsService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermission('PRODUCT', 'UPDATE')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('PRODUCT', 'DELETE')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
