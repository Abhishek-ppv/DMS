import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { WarehouseStatus } from '@prisma/client';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty({ message: 'Warehouse name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Warehouse code is required' })
  code: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(WarehouseStatus, { message: 'Invalid warehouse status' })
  status?: WarehouseStatus;

  @IsOptional()
  @IsString()
  partnerId?: string;
}
