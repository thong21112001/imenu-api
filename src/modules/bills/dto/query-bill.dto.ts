import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginateDto } from '../../../shared/common/dto/paginate.dto';

export class QueryBillDto extends PaginateDto {
  @ApiPropertyOptional({ description: 'ID chi nhánh' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Phương thức thanh toán',
    enum: ['VietQR', 'Cash', 'Card', 'Transfer'],
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái thanh toán',
    enum: ['PAID', 'PENDING', 'REFUNDED'],
  })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (ISO string hoặc YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (ISO string hoặc YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo mã hóa đơn, mã đơn hàng, tên bàn' })
  @IsOptional()
  @IsString()
  search?: string;
}
