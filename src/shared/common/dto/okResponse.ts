import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO phan hoi thanh cong chuan hoa theo pattern menu-bepthu-api
 */
export class OkResponse<T = any> {
  @ApiProperty({ example: true })
  public success: boolean;

  @ApiProperty({ example: 'Thanh cong' })
  public message: string;

  @ApiProperty({ example: null })
  public data: T;

  constructor({ message, data }: { message?: string; data?: T } = {}) {
    this.success = true;
    this.message = message || 'Thanh cong';
    this.data = data as T;
  }
}
