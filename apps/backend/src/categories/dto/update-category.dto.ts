import { IsString, IsOptional, IsEnum } from 'class-validator';
import { CategoryStatus } from '@prisma/client';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentCategoryId?: string | null;

  @IsOptional()
  @IsEnum(CategoryStatus, { message: 'Invalid category status' })
  status?: CategoryStatus;
}
