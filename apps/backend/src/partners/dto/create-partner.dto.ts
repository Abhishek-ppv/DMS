import { IsNotEmpty, IsString, IsOptional, IsEnum, IsEmail, IsNumber } from 'class-validator';
import { PartnerType, PartnerStatus } from '@prisma/client';

export class CreatePartnerDto {
  @IsString()
  @IsNotEmpty({ message: 'Partner name is required' })
  name: string;

  @IsEnum(PartnerType, { message: 'Invalid partner type' })
  @IsNotEmpty({ message: 'Partner type is required' })
  type: PartnerType;

  @IsOptional()
  @IsString()
  parentPartnerId?: string;

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
