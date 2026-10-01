import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';

export class UpdateItemStatusDto {
  @ApiProperty({
    description: 'Trạng thái chế biến của món',
    enum: ['Waiting', 'Cooking', 'Ready', 'Served', 'Cancelled'],
  })
  @IsNotEmpty({ message: 'Trạng thái món không được để trống' })
  @IsEnum(['Waiting', 'Cooking', 'Ready', 'Served', 'Cancelled'], {
    message: 'Trạng thái món phải là Waiting, Cooking, Ready, Served hoặc Cancelled',
  })
  status: 'Waiting' | 'Cooking' | 'Ready' | 'Served' | 'Cancelled';
}
