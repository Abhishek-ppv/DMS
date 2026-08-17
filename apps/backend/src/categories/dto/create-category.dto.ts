import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { CategoryStatus } from '@prisma/client';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentCategoryId?: string;

  @IsOptional()
  @IsEnum(CategoryStatus, { message: 'Invalid category status' })
  status?: CategoryStatus;
}
