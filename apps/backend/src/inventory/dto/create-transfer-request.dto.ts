import { IsNotEmpty, IsString, IsNumber, Min, IsOptional, IsArray } from 'class-validator';

export class CreateTransferRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Product ID is required' })
  productId: string;

  @IsString()
  @IsNotEmpty({ message: 'Source warehouse ID is required' })
  sourceWarehouseId: string;

  @IsString()
  @IsNotEmpty({ message: 'Destination warehouse ID is required' })
  destinationWarehouseId: string;

  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(1, { message: 'Quantity must be greater than zero' })
  quantity: number;

  @IsOptional()
  @IsArray({ message: 'IMEIs must be an array of strings' })
  @IsString({ each: true, message: 'Each IMEI must be a string' })
  imeis?: string[];
}
