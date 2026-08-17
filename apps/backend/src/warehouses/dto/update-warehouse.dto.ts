import { IsString, IsOptional, IsEnum } from 'class-validator';
import { WarehouseStatus } from '@prisma/client';

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

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
