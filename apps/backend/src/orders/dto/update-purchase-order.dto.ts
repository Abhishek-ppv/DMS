import { IsString, IsOptional, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseOrderLineInputDto } from './create-purchase-order.dto';

export class UpdatePurchaseOrderDto {
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
  @IsOptional()
  lines?: PurchaseOrderLineInputDto[];
}
