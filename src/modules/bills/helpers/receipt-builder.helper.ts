import { ReceiptData, ReceiptItemLine } from '../interfaces/receipt-data.interface';
import { generateVietQRUrl, generateVietQRMemo, resolveEffectiveBankAccount } from './vietqr.helper';

export interface ReceiptBuildOptions {
  receiptType?: 'PRE_BILL' | 'FINAL_BILL';
  billCode?: string;
  cashierName?: string;
  paidAt?: string | Date;
  printCount?: number;
  discountPercent?: number;
  serviceFeePercent?: number;
  vatPercent?: number;
  paymentMethod?: string;
  cashGiven?: number;
  cashChange?: number;
  thankYouMessage?: string;
  branch?: any;
}

/**
 * Định dạng ghi chú tùy chọn món ăn: "Tô lớn (+20.000đ), Cay nhiều"
 */
export function formatSelectedOptionsNote(options?: any[]): string {
  if (!options || !Array.isArray(options) || options.length === 0) {
    return '';
  }

  return options
    .map((opt) => {
      if (!opt) return '';
      const name = opt.valueName || opt.name || '';
      const delta = opt.priceDelta || 0;
      if (delta > 0) {
        const deltaFormatted = new Intl.NumberFormat('vi-VN').format(delta);
        return `${name} (+${deltaFormatted}đ)`;
      }
      return name;
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Xây dựng đối tượng dữ liệu hóa đơn chuẩn ReceiptData từ Order hoặc Bill
 * Đảm bảo:
 * 1. Lọc bỏ 100% món bị hủy (status === 'Cancelled')
 * 2. Tự động tổng hợp selectedOptionsNote
 * 3. Phân giải tài khoản ngân hàng chi nhánh -> nhà hàng và sinh link VietQR
 * 4. Tính toán toàn bộ thông số tài chính và metadata
 */
export function buildReceiptData(
  order: any,
  restaurant?: any,
  options?: ReceiptBuildOptions,
): ReceiptData {
  if (!order) {
    throw new Error('Dữ liệu đơn hàng hoặc hóa đơn không hợp lệ');
  }

  // 1. Phân giải Chi nhánh & Thông tin Header
  const branch =
    options?.branch ||
    restaurant?.branches?.find(
      (b: any) =>
        (b.id && b.id === order.branchId) ||
        (b._id && String(b._id) === String(order.branchId)),
    );

  const restaurantName =
    order.headerSnapshot?.restaurantName ||
    restaurant?.name ||
    'iMenu Restaurant';

  const brandTagline =
    order.headerSnapshot?.brandTagline ||
    restaurant?.tagline ||
    'Ẩm thực chuẩn vị - Phục vụ tận tâm';

  const branchName =
    order.branchName ||
    order.headerSnapshot?.branchName ||
    branch?.name ||
    'Trụ sở chính';

  const address =
    order.headerSnapshot?.address ||
    branch?.address ||
    restaurant?.address ||
    '';

  const hotline =
    order.headerSnapshot?.hotline ||
    branch?.phone ||
    restaurant?.phone ||
    restaurant?.hotline ||
    '';

  const wifiSsid =
    order.headerSnapshot?.wifiSsid ||
    branch?.wifiSsid ||
    restaurant?.wifiSsid ||
    '';

  const wifiPassword =
    order.headerSnapshot?.wifiPassword ||
    branch?.wifiPassword ||
    restaurant?.wifiPassword ||
    '';

  // 2. Lọc danh sách món ăn: BỎ 100% MÓN STATUS === 'Cancelled'
  const rawItems: any[] = Array.isArray(order.items) ? order.items : [];
  const activeItems = rawItems.filter((item) => item && item.status !== 'Cancelled');

  const receiptItems: ReceiptItemLine[] = activeItems.map((item) => {
    const unitPrice = Number(item.price || item.unitPrice || 0);
    const quantity = Number(item.quantity || 1);
    const amount = Number(item.itemTotal ?? unitPrice * quantity);

    let selectedOptionsNote = item.selectedOptionsNote || '';
    if (!selectedOptionsNote && Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0) {
      selectedOptionsNote = formatSelectedOptionsNote(item.selectedOptions);
    }

    return {
      name: item.name || 'Món ăn',
      quantity,
      unitPrice,
      amount,
      selectedOptionsNote: selectedOptionsNote || undefined,
      note: item.note || undefined,
      roundNumber: item.roundNumber,
    };
  });

  // 3. Tính toán các chỉ số Tài chính (Financials)
  const subTotal = Number(order.subTotal || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const discountPercent =
    options?.discountPercent ?? Number(order.discountPercent || 0);

  const taxableBase =
    Number(order.taxableBase ?? Math.max(0, subTotal - discountAmount));

  const serviceFee = Number(order.serviceFee || 0);
  const serviceFeePercent =
    options?.serviceFeePercent ?? Number(order.serviceFeePercent || 0);

  const vatAmount = Number(order.vatAmount || 0);
  const vatPercent =
    options?.vatPercent ?? Number(order.vatPercent || 0);

  const totalAmount = Number(
    order.finalAmount ?? order.totalAmount ?? taxableBase + serviceFee + vatAmount,
  );

  const paymentMethod =
    options?.paymentMethod ||
    order.paymentMethod ||
    'Cash';

  const cashGiven =
    options?.cashGiven ??
    order.amountReceived ??
    order.cashGiven;

  const cashChange =
    options?.cashChange ??
    order.changeAmount ??
    (cashGiven !== undefined ? Math.max(0, Number(cashGiven) - totalAmount) : undefined);

  // 4. Phân giải VietQR thụ hưởng
  let paymentQr: ReceiptData['paymentQr'] = undefined;
  const effectiveBank =
    order.bankAccountSnapshot ||
    (restaurant ? resolveEffectiveBankAccount(restaurant, branch) : undefined);

  if (effectiveBank && effectiveBank.accountNo) {
    const memo = generateVietQRMemo(order.orderCode || '');
    const vietQrPayloadUrl =
      order.vietQrUrl ||
      generateVietQRUrl({
        bankId: effectiveBank.bankId,
        accountNo: effectiveBank.accountNo,
        accountName: effectiveBank.accountName,
        amount: totalAmount,
        memo,
        template: (effectiveBank.template as any) || 'compact2',
      });

    paymentQr = {
      vietQrPayloadUrl,
      accountNo: effectiveBank.accountNo,
      bankName: effectiveBank.bankName,
      accountName: effectiveBank.accountName,
      memo,
    };
  }

  // 5. Xác định loại hóa đơn (PRE_BILL hoặc FINAL_BILL)
  const isPaid =
    order.isPaid === true ||
    order.status === 'Paid' ||
    order.paymentStatus === 'PAID';

  const receiptType =
    options?.receiptType || (isPaid ? 'FINAL_BILL' : 'PRE_BILL');

  return {
    header: {
      restaurantName,
      brandTagline,
      branchName,
      address,
      hotline,
      wifiSsid: wifiSsid || undefined,
      wifiPassword: wifiPassword || undefined,
    },
    metadata: {
      receiptType,
      billCode: order.billCode || options?.billCode,
      orderCode: order.orderCode || '',
      tableName: order.tableName || 'Mang về',
      cashierName:
        options?.cashierName ||
        order.cashierName ||
        'Thu ngân',
      createdAt: order.createdAt || new Date(),
      paidAt: isPaid ? (order.paidAt || order.closedAt || options?.paidAt || new Date()) : undefined,
      printCount: order.printCount ?? options?.printCount ?? 0,
    },
    items: receiptItems,
    financials: {
      subTotal,
      discountAmount,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      taxableAmount: taxableBase,
      serviceFee,
      serviceFeePercent: serviceFeePercent > 0 ? serviceFeePercent : undefined,
      vatPercent,
      vatAmount,
      totalAmount,
      paymentMethod,
      cashGiven: cashGiven !== undefined ? Number(cashGiven) : undefined,
      cashChange: cashChange !== undefined ? Number(cashChange) : undefined,
    },
    paymentQr,
    footer: {
      thankYouMessage:
        options?.thankYouMessage || 'Cảm ơn Quý khách & Hẹn gặp lại!',
      softwareCredit: 'iMenu - Hệ Thống Quản Lý F&B Hiện Đại',
    },
  };
}
