import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderLineInputDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imeis?: string[];
}

export class CreatePurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  sellerPartnerId: string;

  @IsString()
  @IsOptional()
  buyerPartnerId?: string;

  @IsString()
  @IsOptional()
  sourceWarehouseId?: string;

  @IsString()
  @IsOptional()
  destinationWarehouseId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineInputDto)
  @ArrayMinSize(1)
  lines: PurchaseOrderLineInputDto[];
}
