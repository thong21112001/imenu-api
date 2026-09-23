import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PermissionInputDto {
  @ApiProperty({ example: 'ORDER' })
  @IsString()
  @IsNotEmpty()
  resource: string;

  @ApiProperty({ example: ['VIEW', 'CREATE', 'UPDATE'] })
  @IsArray()
  actions: string[];
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Quản lý ca' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'restaurant_manager' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ example: 'Chịu trách nhiệm vận hành ca làm việc' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ type: [PermissionInputDto] })
  @IsArray()
  @IsOptional()
  permissions?: PermissionInputDto[];

  @ApiPropertyOptional({ example: ['perm-pos-view', 'perm-pos-order'] })
  @IsArray()
  @IsOptional()
  permissionIds?: string[];
}
