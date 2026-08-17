import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProductStatus } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'SKU is required' })
  SKU: string;

  @IsString()
  @IsNotEmpty({ message: 'Product name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Brand is required' })
  brand: string;

  @IsString()
  @IsNotEmpty({ message: 'Category ID is required' })
  categoryId: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({}, { message: 'MRP must be a number' })
  @IsNotEmpty({ message: 'MRP is required' })
  MRP: number;

  @IsNumber({}, { message: 'Supplier price must be a number' })
  @IsNotEmpty({ message: 'Supplier price is required' })
  supplierPrice: number;

  @IsNumber({}, { message: 'Distributor price must be a number' })
  @IsNotEmpty({ message: 'Distributor price is required' })
  distributorPrice: number;

  @IsNumber({}, { message: 'Dealer price must be a number' })
  @IsNotEmpty({ message: 'Dealer price is required' })
  dealerPrice: number;

  @IsNumber({}, { message: 'Direct Dealer price must be a number' })
  @IsNotEmpty({ message: 'Direct Dealer price is required' })
  directDealerPrice: number;

  @IsOptional()
  @IsNumber({}, { message: 'Tax must be a number' })
  tax?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Warranty period must be a number' })
  warrantyPeriod?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value, obj }) => {
    if (value !== undefined) return Boolean(value);
    if (obj.is_imei_tracked !== undefined) return Boolean(obj.is_imei_tracked);
    if (obj.isImeiTracked !== undefined) return Boolean(obj.isImeiTracked);
    return true;
  })
  IMEITracked?: boolean;

  @IsOptional()
  @IsBoolean()
  is_imei_tracked?: boolean;

  @IsOptional()
  @IsBoolean()
  isImeiTracked?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus, { message: 'Invalid product status' })
  status?: ProductStatus;
}
