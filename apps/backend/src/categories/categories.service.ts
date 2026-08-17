import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper to validate parent category existence and prevent circular references.
   */
  private async validateHierarchy(categoryId: string | null, targetParentId: string | null) {
    if (!targetParentId) return;

    // 1. Check self-parenting
    if (categoryId && categoryId === targetParentId) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    // 2. Check parent existence
    const parent = await this.prisma.category.findUnique({
      where: { id: targetParentId },
    });
    if (!parent) {
      throw new BadRequestException(`Parent category with ID '${targetParentId}' not found`);
    }

    // 3. Check circular relationship if updating an existing category
    if (categoryId) {
      let currentParentId: string | null = targetParentId;
      const visited = new Set<string>();

      while (currentParentId) {
        if (currentParentId === categoryId) {
          throw new BadRequestException('Circular category hierarchy detected');
        }
        if (visited.has(currentParentId)) {
          break;
        }
        visited.add(currentParentId);

        const parentCategory = await this.prisma.category.findUnique({
          where: { id: currentParentId },
          select: { parentCategoryId: true },
        });

        currentParentId = parentCategory?.parentCategoryId || null;
      }
    }
  }

  /**
   * Create a new Category
   */
  async create(dto: CreateCategoryDto) {
    if (dto.parentCategoryId) {
      await this.validateHierarchy(null, dto.parentCategoryId);
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
        parentCategoryId: dto.parentCategoryId || null,
        status: dto.status,
      },
      include: {
        parentCategory: true,
        subCategories: true,
      },
    });
  }

  /**
   * List all categories
   */
  async findAll() {
    return this.prisma.category.findMany({
      include: {
        parentCategory: true,
        subCategories: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get single category by ID
   */
  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parentCategory: true,
        subCategories: true,
        products: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    return category;
  }

  /**
   * Update category
   */
  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.findOne(id);

    if (dto.parentCategoryId !== undefined && dto.parentCategoryId !== null) {
      await this.validateHierarchy(id, dto.parentCategoryId);
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.parentCategoryId !== undefined && { parentCategoryId: dto.parentCategoryId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        parentCategory: true,
        subCategories: true,
      },
    });
  }

  /**
   * Delete category
   */
  async remove(id: string) {
    const category = await this.findOne(id);

    if (category.subCategories && category.subCategories.length > 0) {
      throw new BadRequestException('Cannot delete category with associated subcategories');
    }

    if (category.products && category.products.length > 0) {
      throw new BadRequestException('Cannot delete category with associated products');
    }

    try {
      return await this.prisma.category.delete({
        where: { id },
      });
    } catch (err: any) {
      if (err.code === 'P2003') {
        throw new BadRequestException('Cannot delete category with dependent records');
      }
      throw err;
    }
  }
}
