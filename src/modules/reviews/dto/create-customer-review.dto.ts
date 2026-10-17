import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemFeedbackDto {
  @IsOptional()
  @IsString()
  menuItemId?: string;

  @IsOptional()
  @IsString()
  menuItemName?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  comment?: string;
}

export class CreateCustomerReviewDto {
  @IsNotEmpty({ message: 'Mã đơn hàng orderId là bắt buộc' })
  @IsString()
  orderId: string;

  @IsNotEmpty({ message: 'Điểm đánh giá tổng thể overallRating là bắt buộc' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Điểm đánh giá overallRating phải là số' })
  @Min(1, { message: 'Điểm đánh giá tối thiểu là 1 sao' })
  @Max(5, { message: 'Điểm đánh giá tối đa là 5 sao' })
  overallRating: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  foodRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  serviceRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  ambianceRating?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Tối đa 10 quick tags' })
  @IsString({ each: true })
  @MaxLength(50, { each: true, message: 'Mỗi tag tối đa 50 ký tự' })
  quickTags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Nội dung nhận xét tối đa 500 ký tự' })
  comment?: string;

  @IsOptional()
  @IsArray()
  itemFeedbacks?: ItemFeedbackDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerPhone?: string;

  // Session verification (Cơ chế 1: Bộ 3 QR)
  @IsOptional()
  @IsString()
  restaurantSlug?: string;

  @IsOptional()
  @IsString()
  tableCode?: string;

  @IsOptional()
  @IsString()
  qrToken?: string;

  // Session verification (Cơ chế 2: Receipt Access Token)
  @IsOptional()
  @IsString()
  receiptAccessToken?: string;
}
