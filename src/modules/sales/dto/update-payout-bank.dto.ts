import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePayoutBankDto {
  @IsNotEmpty({ message: 'Vui lòng chọn ngân hàng' })
  @IsString()
  bankId: string;

  @IsNotEmpty({ message: 'Vui lòng nhập tên ngân hàng' })
  @IsString()
  bankName: string;

  @IsNotEmpty({ message: 'Vui lòng nhập số tài khoản' })
  @IsString()
  accountNo: string;

  @IsNotEmpty({ message: 'Vui lòng nhập tên chủ tài khoản' })
  @IsString()
  accountName: string;
}
