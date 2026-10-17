import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyReviewDto {
  @IsNotEmpty({ message: 'Nội dung phản hồi không được để trống' })
  @IsString()
  @MaxLength(1000, { message: 'Nội dung phản hồi tối đa 1000 ký tự' })
  content: string;
}
