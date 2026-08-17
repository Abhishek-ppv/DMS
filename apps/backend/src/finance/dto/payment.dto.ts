import { IsNumber, IsPositive, IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsNumber()
  @IsPositive({ message: 'Payment amount must be greater than 0' })
  amount: number;

  @IsEnum(PaymentMethod, { message: 'Invalid payment method' })
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}
