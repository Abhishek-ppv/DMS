import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@Controller('categories')
@UseGuards(RolesGuard, PermissionsGuard)
export class CategoriesController {
  constructor(
    @Inject(CategoriesService)
    private readonly categoriesService: CategoriesService,
  ) {}

  @Post()
  @RequirePermission('CATEGORY', 'CREATE')
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Get()
  @RequirePermission('CATEGORY', 'READ')
  async findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @RequirePermission('CATEGORY', 'READ')
  async findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('CATEGORY', 'UPDATE')
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('CATEGORY', 'DELETE')
  async remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
