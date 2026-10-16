import { ReceiptData } from '../interfaces/receipt-data.interface';

export class EscPosEncoder {
  // ESC/POS Command Hex bytes
  public static readonly CMD = {
    INIT: [0x1b, 0x40], // ESC @
    ALIGN_LEFT: [0x1b, 0x61, 0x00], // ESC a 0
    ALIGN_CENTER: [0x1b, 0x61, 0x01], // ESC a 1
    ALIGN_RIGHT: [0x1b, 0x61, 0x02], // ESC a 2
    BOLD_ON: [0x1b, 0x45, 0x01], // ESC E 1
    BOLD_OFF: [0x1b, 0x45, 0x00], // ESC E 0
    DOUBLE_HEIGHT_ON: [0x1d, 0x21, 0x01], // GS ! 1
    DOUBLE_WIDTH_ON: [0x1d, 0x21, 0x10], // GS ! 16
    NORMAL_SIZE: [0x1d, 0x21, 0x00], // GS ! 0
    LINE_FEED: [0x0a], // LF
    FEED_AND_CUT: [0x1d, 0x56, 0x42, 0x00], // GS V B 0 (Feed and partial cut)
    KICK_DRAWER: [0x1b, 0x70, 0x00, 0x19, 0xfa], // Pulse pin 2
  };

  /**
   * Khử dấu tiếng Việt chuẩn hóa ASCII an toàn 100% cho máy in nhiệt
   */
  public static stripAccents(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .trim();
  }


  /**
   * Định dạng 1 dòng key - value căn lề 2 bên (48 ký tự cho 80mm hoặc 32 ký tự cho 58mm)
   */
  public static formatKeyValueLine(key: string, value: string, width: number = 48): string {
    const cleanKey = this.stripAccents(key);
    const cleanVal = this.stripAccents(value);
    const spaceNeeded = width - cleanKey.length - cleanVal.length;
    if (spaceNeeded > 0) {
      return `${cleanKey}${' '.repeat(spaceNeeded)}${cleanVal}\n`;
    }
    return `${cleanKey}: ${cleanVal}\n`;
  }

  /**
   * Định dạng 1 dòng cho bảng món ăn (48 cột cho 80mm, 32 cột cho 58mm)
   */
  public static formatItemLine(
    name: string,
    quantity: number,
    price: number,
    total: number,
    width: number = 48,
  ): string {
    const cleanName = this.stripAccents(name);
    const qtyStr = quantity.toString();
    const priceStr = price.toLocaleString('vi-VN');
    const totalStr = total.toLocaleString('vi-VN');

    if (width === 32) {
      // Khổ 58mm (32 ký tự): Dòng 1 Tên món, Dòng 2: SL x Đơn giá = T.Tiền
      const line1 = `${cleanName}\n`;
      const calcStr = `${qtyStr} x ${priceStr}`;
      const spaceNeeded = 32 - calcStr.length - totalStr.length;
      const line2 = spaceNeeded > 0 ? `${calcStr}${' '.repeat(spaceNeeded)}${totalStr}\n` : `${calcStr} = ${totalStr}\n`;
      return `${line1}${line2}`;
    }

    // Khổ 80mm (48 ký tự): Tên món (24) + SL (4) + Đơn giá (9) + Thành tiền (11) = 48 ký tự
    const qStr = qtyStr.padStart(4, ' ');
    const pStr = priceStr.padStart(9, ' ');
    const tStr = totalStr.padStart(11, ' ');

    if (cleanName.length <= 24) {
      const paddedName = cleanName.padEnd(24, ' ');
      return `${paddedName}${qStr}${pStr}${tStr}\n`;
    }

    // Nếu tên dài hơn 24 ký tự
    const line1 = `${cleanName}\n`;
    const emptyName = ''.padEnd(24, ' ');
    const line2 = `${emptyName}${qStr}${pStr}${tStr}\n`;
    return `${line1}${line2}`;
  }

  /**
   * Sinh chuỗi byte ESC/POS cho mã QR Code 2D native (GS ( k)
   */
  public static encodeQrCode(content: string, size: number = 6): number[] {
    if (!content) return [];
    const cleanContent = this.stripAccents(content);
    const dataBytes: number[] = [];
    for (let i = 0; i < cleanContent.length; i++) {
      dataBytes.push(cleanContent.charCodeAt(i) & 0xff);
    }
    const bytes: number[] = [];
    // 1. Model 2: 1D 28 6B 04 00 31 41 32 00
    bytes.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Size: 1D 28 6B 03 00 31 43 <size>
    const validSize = Math.max(1, Math.min(16, size));
    bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, validSize);
    // 3. Error correction Level M: 1D 28 6B 03 00 31 45 31
    bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // 4. Store data: 1D 28 6B <pL> <pH> 31 50 30 <data>
    const len = dataBytes.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);
    bytes.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...dataBytes);
    // 5. Print QR symbol: 1D 28 6B 03 00 31 51 30
    bytes.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    bytes.push(0x0a);
    return bytes;
  }

  /**
   * Biên dịch ReceiptData thành mảng byte nhị phân ESC/POS Uint8Array
   */
  public static encode(
    receipt: ReceiptData,
    options?: { kickDrawer?: boolean; paperWidth?: '80mm' | '58mm'; qrSize?: number },
  ): Uint8Array {
    const bytes: number[] = [];

    const append = (arr: number[]) => {
      for (let i = 0; i < arr.length; i++) {
        bytes.push(arr[i]);
      }
    };

    const appendText = (text: string) => {
      const clean = this.stripAccents(text);
      for (let i = 0; i < clean.length; i++) {
        bytes.push(clean.charCodeAt(i));
      }
    };

    const width = options?.paperWidth === '58mm' ? 32 : 48;
    const sep = '-'.repeat(width) + '\n';
    const doubleSep = '='.repeat(width) + '\n';

    // 1. Initialize
    append(this.CMD.INIT);

    // 2. Header (Căn giữa)
    append(this.CMD.ALIGN_CENTER);
    append(this.CMD.BOLD_ON);
    append(this.CMD.DOUBLE_HEIGHT_ON);
    appendText(`${receipt.header.restaurantName.toUpperCase()}\n`);
    append(this.CMD.NORMAL_SIZE);
    append(this.CMD.BOLD_OFF);

    if (receipt.header.branchName) {
      appendText(`${receipt.header.branchName}\n`);
    }
    if (receipt.header.address) {
      appendText(`${receipt.header.address}\n`);
    }
    if (receipt.header.hotline) {
      appendText(`Hotline: ${receipt.header.hotline}\n`);
    }
    if (receipt.header.wifiSsid) {
      appendText(
        `Wifi: ${receipt.header.wifiSsid} - Pass: ${receipt.header.wifiPassword || ''}\n`,
      );
    }

    // Dòng ngăn cách
    appendText(sep);

    // 3. Tiêu đề Hóa Đơn & Meta
    append(this.CMD.BOLD_ON);
    const title =
      receipt.metadata.receiptType === 'FINAL_BILL'
        ? 'HOA DON THANH TOAN'
        : 'PHIEU TAM TINH';
    appendText(`${title}\n`);
    append(this.CMD.BOLD_OFF);

    append(this.CMD.ALIGN_LEFT);
    appendText(
      this.formatKeyValueLine(
        `Ban: ${receipt.metadata.tableName}`,
        `Ma HD: ${receipt.metadata.billCode || receipt.metadata.orderCode}`,
        width,
      ),
    );
    appendText(
      this.formatKeyValueLine(
        `Thu ngan: ${receipt.metadata.cashierName || 'Thu Ngan'}`,
        `Gio: ${new Date(receipt.metadata.createdAt).toLocaleTimeString('vi-VN')}`,
        width,
      ),
    );

    // Dòng phân cách trước bảng món
    appendText(doubleSep);
    if (width === 48) {
      appendText(
        this.stripAccents('Ten mon                     SL    Don gia     T.Tien\n'),
      );
    } else {
      appendText(
        this.formatKeyValueLine('Ten mon', 'T.Tien', width),
      );
    }
    appendText(sep);

    // 4. Danh sách món ăn
    for (const item of receipt.items) {
      appendText(
        this.formatItemLine(item.name, item.quantity, item.unitPrice, item.amount, width),
      );
      if (item.selectedOptionsNote) {
        appendText(`  * ${item.selectedOptionsNote}\n`);
      }
      if (item.note) {
        appendText(`  Ghi chu: ${item.note}\n`);
      }
    }

    appendText(sep);

    // 5. Tổng kết tài chính
    appendText(
      this.formatKeyValueLine(
        'Tam tinh:',
        `${receipt.financials.subTotal.toLocaleString('vi-VN')} d`,
        width,
      ),
    );

    if (receipt.financials.discountAmount > 0) {
      appendText(
        this.formatKeyValueLine(
          'Giam gia:',
          `-${receipt.financials.discountAmount.toLocaleString('vi-VN')} d`,
          width,
        ),
      );
    }

    if (receipt.financials.serviceFee > 0) {
      appendText(
        this.formatKeyValueLine(
          'Phi dich vu:',
          `+${receipt.financials.serviceFee.toLocaleString('vi-VN')} d`,
          width,
        ),
      );
    }

    if (receipt.financials.vatAmount > 0) {
      appendText(
        this.formatKeyValueLine(
          `Thue VAT (${receipt.financials.vatPercent || 0}%):`,
          `+${receipt.financials.vatAmount.toLocaleString('vi-VN')} d`,
          width,
        ),
      );
    }

    appendText(doubleSep);

    // Tổng tiền thanh toán (In đậm, Double Height)
    append(this.CMD.BOLD_ON);
    append(this.CMD.DOUBLE_HEIGHT_ON);
    appendText(
      this.formatKeyValueLine(
        'TONG CONG:',
        `${receipt.financials.totalAmount.toLocaleString('vi-VN')} d`,
        width,
      ),
    );
    append(this.CMD.NORMAL_SIZE);
    append(this.CMD.BOLD_OFF);

    if (receipt.financials.paymentMethod) {
      appendText(
        this.formatKeyValueLine(
          'Hinh thuc:',
          receipt.financials.paymentMethod,
          width,
        ),
      );
    }

    if (
      receipt.financials.cashGiven !== undefined &&
      receipt.financials.cashGiven > 0
    ) {
      appendText(
        this.formatKeyValueLine(
          'Tien khach dua:',
          `${receipt.financials.cashGiven.toLocaleString('vi-VN')} d`,
          width,
        ),
      );
      if (
        receipt.financials.cashChange !== undefined &&
        receipt.financials.cashChange > 0
      ) {
        appendText(
          this.formatKeyValueLine(
            'Tien tra lai:',
            `${receipt.financials.cashChange.toLocaleString('vi-VN')} d`,
            width,
          ),
        );
      }
    }

    // 6. Footer & VietQR info nếu có
    append(this.CMD.ALIGN_CENTER);
    if (receipt.paymentQr?.accountNo) {
      appendText(sep);
      appendText(`Thanh toan VietQR Napas 247:\n`);
      appendText(
        `Ngan hang: ${receipt.paymentQr.bankName} - STK: ${receipt.paymentQr.accountNo}\n`,
      );
      appendText(`Chu TK: ${receipt.paymentQr.accountName}\n`);

      // In mã QR Code 2D native
      if (receipt.paymentQr?.vietQrPayloadUrl) {
        const qrBytes = this.encodeQrCode(
          receipt.paymentQr.vietQrPayloadUrl,
          options?.paperWidth === '58mm' ? 4 : (options?.qrSize || 6),
        );
        append(qrBytes);
      }
    }

    appendText(sep);
    appendText(`${receipt.footer.thankYouMessage}\n`);
    appendText(`${receipt.footer.softwareCredit}\n\n\n`);

    // 7. Cắt giấy
    append(this.CMD.FEED_AND_CUT);

    // 8. Tùy chọn mở két tiền
    if (options?.kickDrawer) {
      append(this.CMD.KICK_DRAWER);
    }

    return new Uint8Array(bytes);
  }

  /**
   * Chuyển đổi Uint8Array thành base64 để vận chuyển qua HTTP API
   */
  public static toBase64(buffer: Uint8Array): string {
    return Buffer.from(buffer).toString('base64');
  }
}

export { buildReceiptData } from './receipt-builder.helper';

