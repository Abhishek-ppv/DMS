import { IsString, IsOptional, IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class SalesOrderQueryDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;
}
