import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty({ message: 'Customer name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Customer phone is required' })
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
