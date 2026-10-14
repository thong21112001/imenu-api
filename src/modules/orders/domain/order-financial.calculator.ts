import { BadRequestException } from '@nestjs/common';

export interface FinancialInput {
  subTotal: number;
  discountAmount?: number;
  discountPercent?: number;
  serviceFee?: number;
  serviceFeePercent?: number;
  vatAmount?: number;
  vatPercent?: number;
}

export interface FinancialResult {
  subTotal: number;
  discountAmount: number;
  taxableBase: number;
  serviceFee: number;
  vatAmount: number;
  totalAmount: number;
}

export class OrderFinancialCalculator {
  /**
   * Tính toán tài chính hóa đơn theo thứ tự chuẩn hóa F&B:
   * 1. subTotal: Tổng tiền các món chưa bị hủy
   * 2. discount: Tính từ discountAmount HOẶC discountPercent (quy tắc XOR)
   * 3. taxableBase: subTotal - discount
   * 4. serviceFee: Tính từ serviceFee HOẶC serviceFeePercent trên taxableBase (quy tắc XOR)
   * 5. vatAmount: Tính từ vatAmount HOẶC vatPercent trên (taxableBase + serviceFee) (quy tắc XOR)
   * 6. totalAmount: taxableBase + serviceFee + vatAmount
   */
  static calculate(input: FinancialInput): FinancialResult {
    const subTotal = Math.max(0, Math.round(input.subTotal || 0));

    // --- 1. RÀNG BUỘC XOR ---
    if (input.discountAmount !== undefined && input.discountPercent !== undefined) {
      throw new BadRequestException(
        'Không được truyền đồng thời cả discountAmount và discountPercent (quy tắc XOR)',
      );
    }

    if (input.serviceFee !== undefined && input.serviceFeePercent !== undefined) {
      throw new BadRequestException(
        'Không được truyền đồng thời cả serviceFee và serviceFeePercent (quy tắc XOR)',
      );
    }

    if (input.vatAmount !== undefined && input.vatPercent !== undefined) {
      throw new BadRequestException(
        'Không được truyền đồng thời cả vatAmount và vatPercent (quy tắc XOR)',
      );
    }

    // --- 2. RÀNG BUỘC MIỀN GIÁ TRỊ ---
    if (input.discountAmount !== undefined && input.discountAmount < 0) {
      throw new BadRequestException('discountAmount không được là số âm');
    }
    if (input.discountPercent !== undefined && (input.discountPercent < 0 || input.discountPercent > 100)) {
      throw new BadRequestException('discountPercent phải nằm trong khoảng từ 0% đến 100%');
    }

    if (input.serviceFee !== undefined && input.serviceFee < 0) {
      throw new BadRequestException('serviceFee không được là số âm');
    }
    if (input.serviceFeePercent !== undefined && (input.serviceFeePercent < 0 || input.serviceFeePercent > 100)) {
      throw new BadRequestException('serviceFeePercent phải nằm trong khoảng từ 0% đến 100%');
    }

    if (input.vatAmount !== undefined && input.vatAmount < 0) {
      throw new BadRequestException('vatAmount không được là số âm');
    }
    if (input.vatPercent !== undefined && (input.vatPercent < 0 || input.vatPercent > 100)) {
      throw new BadRequestException('vatPercent phải nằm trong khoảng từ 0% đến 100%');
    }

    // --- 3. TÍNH DISCOUNT ---
    let discountAmount = 0;
    if (input.discountPercent !== undefined) {
      discountAmount = Math.round((subTotal * input.discountPercent) / 100);
    } else if (input.discountAmount !== undefined) {
      discountAmount = Math.round(input.discountAmount);
    }

    if (discountAmount > subTotal) {
      throw new BadRequestException(
        `Số tiền giảm giá (${discountAmount} đ) không được vượt quá tổng tiền món (${subTotal} đ)`,
      );
    }

    // --- 4. TÍNH TAXABLE BASE ---
    const taxableBase = Math.max(0, subTotal - discountAmount);

    // --- 5. TÍNH PHÍ DỊCH VỤ (SERVICE FEE) ---
    let serviceFee = 0;
    if (input.serviceFeePercent !== undefined) {
      serviceFee = Math.round((taxableBase * input.serviceFeePercent) / 100);
    } else if (input.serviceFee !== undefined) {
      serviceFee = Math.round(input.serviceFee);
    }

    // --- 6. TÍNH THUẾ VAT ---
    let vatAmount = 0;
    if (input.vatPercent !== undefined) {
      vatAmount = Math.round(((taxableBase + serviceFee) * input.vatPercent) / 100);
    } else if (input.vatAmount !== undefined) {
      vatAmount = Math.round(input.vatAmount);
    }

    // --- 7. TÍNH TOTAL AMOUNT ---
    const totalAmount = Math.max(0, taxableBase + serviceFee + vatAmount);

    return {
      subTotal,
      discountAmount,
      taxableBase,
      serviceFee,
      vatAmount,
      totalAmount,
    };
  }
}
