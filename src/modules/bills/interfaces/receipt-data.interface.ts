export interface ReceiptItemLine {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  selectedOptionsNote?: string;
  note?: string;
  roundNumber?: number;
}

export interface ReceiptData {
  header: {
    restaurantName: string;
    brandTagline?: string;
    branchName: string;
    address: string;
    hotline: string;
    wifiSsid?: string;
    wifiPassword?: string;
  };
  metadata: {
    receiptType: 'PRE_BILL' | 'FINAL_BILL';
    billCode?: string;
    orderCode: string;
    tableName: string;
    cashierName: string;
    createdAt: string | Date;
    paidAt?: string | Date;
    printCount?: number;
  };
  items: ReceiptItemLine[];
  financials: {
    subTotal: number;
    discountAmount: number;
    discountPercent?: number;
    taxableAmount: number;
    serviceFee: number;
    serviceFeePercent?: number;
    vatPercent: number;
    vatAmount: number;
    totalAmount: number;
    paymentMethod?: string;
    cashGiven?: number;
    cashChange?: number;
  };
  paymentQr?: {
    vietQrPayloadUrl: string;
    accountNo: string;
    bankName: string;
    accountName: string;
    memo?: string;
  };
  footer: {
    thankYouMessage: string;
    softwareCredit: string;
  };
}
