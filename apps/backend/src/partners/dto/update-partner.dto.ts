import { IsString, IsOptional, IsEnum, IsEmail, IsNumber } from 'class-validator';
import { PartnerStatus } from '@prisma/client';

export class UpdatePartnerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  territory?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Credit limit must be a number' })
  creditLimit?: number;

  @IsOptional()
  @IsEnum(PartnerStatus, { message: 'Invalid partner status' })
  status?: PartnerStatus;
}
