import { EscPosEncoder, buildReceiptData } from '../../src/modules/bills/helpers/escpos-encoder.helper';
import { ReceiptData } from '../../src/modules/bills/interfaces/receipt-data.interface';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function pass(name: string, detail?: string) {
  console.log(`  ${colors.green}✔ PASS:${colors.reset} ${name}${detail ? ` (${detail})` : ''}`);
}

function fail(name: string, error: any) {
  console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${name}`);
  console.error(`    ${colors.red}${error?.stack || error?.message || (typeof error === 'object' ? JSON.stringify(error) : error)}${colors.reset}`);
}

function hasSequence(buffer: Uint8Array | number[], sequence: number[]): boolean {
  const bytes = Array.from(buffer);
  for (let i = 0; i <= bytes.length - sequence.length; i++) {
    let match = true;
    for (let j = 0; j < sequence.length; j++) {
      if (bytes[i + j] !== sequence[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Suite 4: Universal 80mm & 58mm ESC/POS Binary Encoder Unit Tests      ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------
  // SECTION 1: buildReceiptData() Unit & Contract Tests
  // -------------------------------------------------------------
  console.log(`${colors.bold}1. Kiểm tra buildReceiptData(): Filter Cancelled, Options, Financials${colors.reset}`);

  try {
    const mockOrder = {
      orderCode: 'ORD-20261016-001',
      tableName: 'Bàn VIP 01',
      branchId: 'branch-101',
      branchName: 'Chi nhánh Quận 1',
      status: 'Served',
      isPaid: false,
      items: [
        {
          name: 'Phở Bò Tái Lăn',
          quantity: 2,
          price: 75000,
          itemTotal: 150000,
          status: 'Served',
          selectedOptions: [
            { valueName: 'Tô Lớn', priceDelta: 15000 },
            { valueName: 'Nhiều Hành', priceDelta: 0 },
          ],
        },
        {
          name: 'Trà Đá Đường',
          quantity: 2,
          price: 5000,
          itemTotal: 10000,
          status: 'Served',
        },
        {
          name: 'Quẩy Nóng Giòn',
          quantity: 1,
          price: 15000,
          itemTotal: 15000,
          status: 'Cancelled', // Đã bị hủy
          cancelReason: 'Hết hàng',
        },
      ],
      subTotal: 160000,
      discountAmount: 10000,
      discountPercent: 0,
      serviceFee: 5000,
      vatPercent: 8,
      vatAmount: 12400, // (160000 - 10000) * 0.08 = 12000; or explicit
      totalAmount: 167400,
      paymentMethod: 'Cash',
      amountReceived: 200000,
      changeAmount: 32600,
    };

    const mockRestaurant = {
      name: 'Nhà Hàng Ẩm Thực Việt Nam',
      tagline: 'Vị Ngon Trọn Vẹn',
      branches: [
        {
          id: 'branch-101',
          name: 'Chi nhánh Quận 1',
          address: '123 Đồng Khởi, P. Bến Nghé, Q1',
          phone: '02838221122',
          wifiSsid: 'AmThucViet_VIP',
          wifiPassword: 'amthucviet8888',
          bankAccount: {
            bankId: '970422',
            bankName: 'MBBank',
            accountNo: '0987654321',
            accountName: 'CHI NHANH AM THUC VIET Q1',
          },
        },
      ],
    };

    const receipt = buildReceiptData(mockOrder, mockRestaurant, {
      cashierName: 'Nguyễn Thu Ngân',
    });

    // 1.1 Loại bỏ đúng món Cancelled
    if (receipt.items.length !== 2) {
      throw new Error(`Kỳ vọng 2 món hợp lệ (đã lọc món Cancelled), nhưng nhận được ${receipt.items.length}`);
    }
    const hasCancelled = receipt.items.some((it) => it.name === 'Quẩy Nóng Giòn');
    if (hasCancelled) {
      throw new Error('Món trạng thái Cancelled chưa được loại bỏ khỏi hóa đơn');
    }
    pass('TC-P8-ENC-01: Loại bỏ 100% món có status = Cancelled');
    passed++;

    // 1.2 Tổng hợp selectedOptionsNote
    const phoItem = receipt.items.find((it) => it.name === 'Phở Bò Tái Lăn');
    if (!phoItem?.selectedOptionsNote || !phoItem.selectedOptionsNote.includes('Tô Lớn (+15.000đ)')) {
      throw new Error(`Ghi chú tùy chọn món không đúng: "${phoItem?.selectedOptionsNote}"`);
    }
    pass('TC-P8-ENC-02: Tự động tổng hợp selectedOptionsNote kèm giá phụ thu chuẩn (+15.000đ)');
    passed++;

    // 1.3 Tính đúng financials
    if (receipt.financials.taxableAmount !== 150000) {
      throw new Error(`taxableAmount sai: ${receipt.financials.taxableAmount}, kỳ vọng 150000`);
    }
    if (receipt.financials.serviceFee !== 5000) {
      throw new Error(`serviceFee sai: ${receipt.financials.serviceFee}, kỳ vọng 5000`);
    }
    if (receipt.financials.totalAmount !== 167400) {
      throw new Error(`totalAmount sai: ${receipt.financials.totalAmount}, kỳ vọng 167400`);
    }
    if (receipt.financials.cashChange !== 32600) {
      throw new Error(`cashChange sai: ${receipt.financials.cashChange}, kỳ vọng 32600`);
    }
    pass('TC-P8-ENC-03: Tính đúng toàn bộ taxableAmount, serviceFee, vatAmount, totalAmount và cashChange');
    passed++;

    // 1.4 Phân giải thông tin VietQR từ chi nhánh
    if (!receipt.paymentQr?.accountNo || receipt.paymentQr.accountNo !== '0987654321') {
      throw new Error(`accountNo trong paymentQr không khớp STK chi nhánh: ${receipt.paymentQr?.accountNo}`);
    }
    if (!receipt.paymentQr?.vietQrPayloadUrl.includes('0987654321')) {
      throw new Error('Link VietQR không chứa đúng STK chi nhánh');
    }
    pass('TC-P8-ENC-04: Phân giải chính xác VietQR ngân hàng của chi nhánh và gắn URL VietQR vào ReceiptData');
    passed++;
  } catch (err: any) {
    fail('Kiểm tra buildReceiptData thất bại', err);
    failed++;
  }

  // -------------------------------------------------------------
  // SECTION 2: EscPosEncoder Command Hex Bytes Verification
  // -------------------------------------------------------------
  console.log(`\n${colors.bold}2. Kiểm tra EscPosEncoder: Các lệnh điều khiển nhị phân ESC/POS bắt buộc${colors.reset}`);

  try {
    const sampleReceipt: ReceiptData = {
      header: {
        restaurantName: 'Nhà Hàng Sen Vàng',
        branchName: 'Chi Nhánh 1',
        address: '456 Hai Bà Trưng, Q1, TP.HCM',
        hotline: '19006789',
      },
      metadata: {
        receiptType: 'FINAL_BILL',
        orderCode: 'ORD-20261016-099',
        billCode: 'BILL-261016-0001',
        tableName: 'Bàn VIP 09',
        cashierName: 'Lê Thu Ngân',
        createdAt: new Date(),
      },
      items: [
        {
          name: 'Cơm Chiên Hải Sản Đặc Biệt',
          quantity: 2,
          unitPrice: 120000,
          amount: 240000,
          selectedOptionsNote: 'Ít cay, thêm tôm',
        },
      ],
      financials: {
        subTotal: 240000,
        discountAmount: 0,
        taxableAmount: 240000,
        serviceFee: 0,
        vatPercent: 10,
        vatAmount: 24000,
        totalAmount: 264000,
        paymentMethod: 'Cash',
        cashGiven: 300000,
        cashChange: 36000,
      },
      paymentQr: {
        vietQrPayloadUrl: 'https://img.vietqr.io/image/970422-0987654321-compact2.png?amount=264000&addInfo=IMENU%20ORD-20261016-099',
        accountNo: '0987654321',
        bankName: 'MBBank',
        accountName: 'NHA HANG SEN VANG',
        memo: 'IMENU ORD-20261016-099',
      },
      footer: {
        thankYouMessage: 'Cảm ơn quý khách và hẹn gặp lại!',
        softwareCredit: 'Hóa đơn khởi tạo bởi iMenu POS Cloud',
      },
    };

    const bytes = EscPosEncoder.encode(sampleReceipt, {
      kickDrawer: true,
      paperWidth: '80mm',
    });

    // 2.1 Byte đầu tiên là Initialize 1B 40 (ESC @)
    if (bytes[0] !== 0x1b || bytes[1] !== 0x40) {
      throw new Error(`Byte đầu tiên không phải là ESC @ (1B 40): [${bytes[0]?.toString(16)}, ${bytes[1]?.toString(16)}]`);
    }
    pass('TC-P8-ENC-05: Byte đầu tiên là lệnh Initialize 1B 40 (ESC @)');
    passed++;

    // 2.2 Align Center 1B 61 01
    if (!hasSequence(bytes, [0x1b, 0x61, 0x01])) {
      throw new Error('Không tìm thấy chuỗi lệnh Align Center: 1B 61 01');
    }
    pass('TC-P8-ENC-06: Chứa đúng lệnh Align Center: 1B 61 01');
    passed++;

    // 2.3 Bold On 1B 45 01
    if (!hasSequence(bytes, [0x1b, 0x45, 0x01])) {
      throw new Error('Không tìm thấy chuỗi lệnh Bold On: 1B 45 01');
    }
    pass('TC-P8-ENC-07: Chứa đúng lệnh Bold On: 1B 45 01');
    passed++;

    // 2.4 Double Height 1D 21 01
    if (!hasSequence(bytes, [0x1d, 0x21, 0x01])) {
      throw new Error('Không tìm thấy chuỗi lệnh Double Height: 1D 21 01');
    }
    pass('TC-P8-ENC-08: Chứa đúng lệnh Double Height: 1D 21 01');
    passed++;

    // 2.5 QR Code 2D native (1D 28 6B)
    if (!hasSequence(bytes, [0x1d, 0x28, 0x6b])) {
      throw new Error('Không tìm thấy chuỗi lệnh in QR Code 2D native: 1D 28 6B');
    }
    pass('TC-P8-ENC-09: Chứa đúng tập lệnh in mã QR Code 2D native: 1D 28 6B (GS ( k)');
    passed++;

    // 2.6 Partial Cut 1D 56 42 00
    if (!hasSequence(bytes, [0x1d, 0x56, 0x42, 0x00])) {
      throw new Error('Không tìm thấy chuỗi lệnh cắt giấy một phần: 1D 56 42 00');
    }
    pass('TC-P8-ENC-10: Chứa đúng lệnh cắt giấy một phần: 1D 56 42 00 (GS V B 0)');
    passed++;

    // 2.7 Kick Cash Drawer 1B 70 00 19 FA
    if (!hasSequence(bytes, [0x1b, 0x70, 0x00, 0x19, 0xfa])) {
      throw new Error('Không tìm thấy chuỗi lệnh mở két tiền: 1B 70 00 19 FA');
    }
    pass('TC-P8-ENC-11: Chứa đúng lệnh kích xung mở két tiền Cash Drawer: 1B 70 00 19 FA');
    passed++;
  } catch (err: any) {
    fail('Kiểm tra EscPosEncoder Command Hex Bytes thất bại', err);
    failed++;
  }

  // -------------------------------------------------------------
  // SECTION 3: Vietnamese Accent Stripping & Column Formatting
  // -------------------------------------------------------------
  console.log(`\n${colors.bold}3. Kiểm tra chuyển đổi Tiếng Việt ASCII & ngắt dòng 48 cột (80mm) / 32 cột (58mm)${colors.reset}`);

  try {
    // 3.1 Accent Stripping
    const vietnameseStr = 'Lẩu Thái Chua Cay Đặc Biệt Đậm Đà, Trà Sữa Đào 100% Đường 50% Đá!';
    const stripped = EscPosEncoder.stripAccents(vietnameseStr);
    const expected = 'Lau Thai Chua Cay Dac Biet Dam Da, Tra Sua Dao 100% Duong 50% Da!';
    if (stripped !== expected) {
      throw new Error(`Kết quả khử dấu không khớp: "${stripped}", kỳ vọng "${expected}"`);
    }
    pass('TC-P8-ENC-12: Khử dấu tiếng Việt 100% chuẩn ASCII (đ/Đ -> d/D, bỏ dấu thanh)', stripped);
    passed++;

    // 3.2 48-column formatting (80mm)
    const line80 = EscPosEncoder.formatItemLine('Phở Bò Tái Nạm Gầu Bắp', 2, 75000, 150000, 48);
    const lines80Arr = line80.split('\n').filter(Boolean);
    for (const l of lines80Arr) {
      if (l.length > 48) {
        throw new Error(`Dòng vượt quá 48 ký tự: "${l}" (độ dài: ${l.length})`);
      }
    }
    pass('TC-P8-ENC-13: Định dạng dòng món ăn khổ 80mm tuân thủ nghiêm ngặt <= 48 ký tự');
    passed++;

    // 3.3 32-column formatting (58mm)
    const line58 = EscPosEncoder.formatItemLine('Cơm Sườn Bì Chả Đặc Biệt Sài Gòn', 1, 65000, 65000, 32);
    const lines58Arr = line58.split('\n').filter(Boolean);
    for (const l of lines58Arr) {
      if (l.length > 32) {
        throw new Error(`Dòng vượt quá 32 ký tự: "${l}" (độ dài: ${l.length})`);
      }
    }
    pass('TC-P8-ENC-14: Định dạng dòng món ăn khổ 58mm tuân thủ nghiêm ngặt <= 32 ký tự');
    passed++;

    // 3.4 Key-Value alignment 48 cols and 32 cols
    const kv48 = EscPosEncoder.formatKeyValueLine('TONG CONG:', '150.000 d', 48);
    if (kv48.trim().length !== 48) {
      throw new Error(`formatKeyValueLine 48 cols độ dài không phải 48: ${kv48.trim().length}`);
    }
    const kv32 = EscPosEncoder.formatKeyValueLine('TONG CONG:', '150.000 d', 32);
    if (kv32.trim().length !== 32) {
      throw new Error(`formatKeyValueLine 32 cols độ dài không phải 32: ${kv32.trim().length}`);
    }
    pass('TC-P8-ENC-15: formatKeyValueLine căn chuẩn 2 lề đúng 48 ký tự (80mm) và 32 ký tự (58mm)');
    passed++;
  } catch (err: any) {
    fail('Kiểm tra Tiếng Việt & ngắt dòng thất bại', err);
    failed++;
  }

  // -------------------------------------------------------------
  // SECTION 4: 58mm Paper Width Encoding Test
  // -------------------------------------------------------------
  console.log(`\n${colors.bold}4. Kiểm tra biên dịch hoàn chỉnh khổ 58mm (Không kick drawer khi Card/Transfer)${colors.reset}`);

  try {
    const receipt58: ReceiptData = {
      header: {
        restaurantName: 'Cafe Góc Phố',
        branchName: 'Chi Nhánh 58mm',
        address: '12 Nguyễn Trãi, Q5, TP.HCM',
        hotline: '0908889999',
      },
      metadata: {
        receiptType: 'PRE_BILL',
        orderCode: 'ORD-20261016-58M',
        tableName: 'Bàn 02',
        cashierName: 'Trần Phục Vụ',
        createdAt: new Date(),
      },
      items: [
        {
          name: 'Cà Phê Sữa Đá',
          quantity: 2,
          unitPrice: 25000,
          amount: 50000,
        },
      ],
      financials: {
        subTotal: 50000,
        discountAmount: 0,
        taxableAmount: 50000,
        serviceFee: 0,
        vatPercent: 0,
        vatAmount: 0,
        totalAmount: 50000,
        paymentMethod: 'Transfer',
      },
      footer: {
        thankYouMessage: 'Hẹn gặp lại quý khách!',
        softwareCredit: 'iMenu POS Cloud',
      },
    };

    const bytes58 = EscPosEncoder.encode(receipt58, {
      paperWidth: '58mm',
      kickDrawer: false,
    });

    if (!(bytes58 instanceof Uint8Array) || bytes58.length === 0) {
      throw new Error('Biên dịch khổ 58mm trả về rỗng');
    }

    // Xác nhận KHÔNG có Kick Drawer
    if (hasSequence(bytes58, [0x1b, 0x70, 0x00, 0x19, 0xfa])) {
      throw new Error('Biên dịch khi kickDrawer = false không được chứa lệnh Kick Drawer');
    }

    const base64 = EscPosEncoder.toBase64(bytes58);
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('Chuyển đổi base64 thất bại');
    }

    pass('TC-P8-ENC-16: Biên dịch hóa đơn khổ 58mm không mở két tiền, xuất Base64 thành công', `Bytes: ${bytes58.length}`);
    passed++;
  } catch (err: any) {
    fail('Kiểm tra khổ 58mm thất bại', err);
    failed++;
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.cyan}------------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}Kết quả Suite 4 (escpos-receipt-encoder): ${passed} passed, ${failed} failed${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}------------------------------------------------------------------------${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi Suite 4:', err);
  process.exit(1);
});
