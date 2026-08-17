import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProductStatus } from '@prisma/client';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  SKU?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber({}, { message: 'MRP must be a number' })
  MRP?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Supplier price must be a number' })
  supplierPrice?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Distributor price must be a number' })
  distributorPrice?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Dealer price must be a number' })
  dealerPrice?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Direct Dealer price must be a number' })
  directDealerPrice?: number;

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
    return undefined;
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
