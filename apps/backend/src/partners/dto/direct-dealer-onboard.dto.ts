import { IsNotEmpty, IsString, IsOptional, IsEmail, IsNumber } from 'class-validator';

export class DirectDealerOnboardDto {
  @IsString()
  @IsNotEmpty({ message: 'Partner name is required' })
  name: string;

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
}
