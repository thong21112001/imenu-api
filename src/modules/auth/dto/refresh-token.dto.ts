import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token hợp lệ' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
