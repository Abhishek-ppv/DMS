import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum InvoiceSourceType {
  SALES_ORDER = 'SALES_ORDER',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
}

export class CreateInvoiceDto {
  @IsEnum(InvoiceSourceType)
  sourceType: InvoiceSourceType;

  @IsString()
  sourceId: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreateInvoiceFromSalesOrderDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreateInvoiceFromPurchaseOrderDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
