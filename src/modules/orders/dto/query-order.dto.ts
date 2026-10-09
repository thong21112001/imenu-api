import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsIn,
  IsISO8601,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/order.entity';

export class QueryOrderDto {
  @ApiPropertyOptional({ description: 'ID chi nhánh' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'ID bàn ăn' })
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiPropertyOptional({
    description:
      'Trạng thái đơn hàng (chuỗi đơn, danh sách dấu phẩy WaitingConfirmation,Preparing, hoặc "all")',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Lọc đơn chưa thanh toán / đã thanh toán' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPaid?: boolean;

  @ApiPropertyOptional({ description: 'Thời gian bắt đầu (ISO 8601 string, ví dụ: 2026-10-09T00:00:00.000Z)' })
  @IsOptional()
  @IsISO8601({}, { message: 'fromDate phải đúng định dạng ISO 8601' })
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Thời gian kết thúc (ISO 8601 string, ví dụ: 2026-10-09T23:59:59.999Z)' })
  @IsOptional()
  @IsISO8601({}, { message: 'toDate phải đúng định dạng ISO 8601' })
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Trường thời gian được lọc',
    enum: ['createdAt', 'openedAt', 'closedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'openedAt', 'closedAt'], {
    message: 'dateField phải là createdAt, openedAt hoặc closedAt',
  })
  dateField?: 'createdAt' | 'openedAt' | 'closedAt' = 'createdAt';

  @ApiPropertyOptional({ description: 'ID nhân sự (khớp createdBy HOẶC paidBy)' })
  @IsOptional()
  @IsString()
  staffId?: string;

  @ApiPropertyOptional({ description: 'ID nhân viên tạo đơn (createdBy)' })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'ID thu ngân thanh toán (paidBy)' })
  @IsOptional()
  @IsString()
  paidBy?: string;

  @ApiPropertyOptional({
    description: 'Phương thức thanh toán',
    enum: ['VietQR', 'Cash', 'Card', 'Transfer'],
  })
  @IsOptional()
  @IsIn(['VietQR', 'Cash', 'Card', 'Transfer'], {
    message: 'paymentMethod phải là VietQR, Cash, Card hoặc Transfer',
  })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo mã đơn (orderCode) hoặc tên bàn (tableName)' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Từ khóa tìm kiếm không vượt quá 100 ký tự' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Trường sắp xếp',
    enum: ['createdAt', 'totalAmount', 'openedAt', 'closedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'totalAmount', 'openedAt', 'closedAt'], {
    message: 'sortBy phải là createdAt, totalAmount, openedAt hoặc closedAt',
  })
  sortBy?: 'createdAt' | 'totalAmount' | 'openedAt' | 'closedAt' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Thứ tự sắp xếp',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'sortOrder phải là asc hoặc desc' })
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Trang hiện tại', default: 1 })
  @IsOptional()
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page tối thiểu là 1' })
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng mỗi trang (tối đa 100)', default: 20 })
  @IsOptional()
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit tối thiểu là 1' })
  @Max(100, { message: 'limit tối đa là 100' })
  @Type(() => Number)
  limit?: number = 20;
}

