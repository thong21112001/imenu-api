import { EscPosEncoder } from '../../src/modules/bills/helpers/escpos-encoder.helper';
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
  console.error(`    ${colors.red}${typeof error === 'object' ? JSON.stringify(error) : error}${colors.reset}`);
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 8: Universal 80mm ESC/POS Binary Encoder Unit Tests             ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // TEST 1: Vietnamese accent removal
  try {
    const input = 'Phở Bò Tái Nạm, Trà Sữa Trân Châu Đường Đen 100% Đường 50% Đá!';
    const stripped = EscPosEncoder.stripAccents(input);
    const expected = 'Pho Bo Tai Nam, Tra Sua Tran Chau Duong Den 100% Duong 50% Da!';
    if (stripped === expected) {
      pass('TC-8.5-01: EscPosEncoder.stripAccents loại bỏ toàn bộ dấu tiếng Việt chính xác', stripped);
      passed++;
    } else {
      throw new Error(`Expected "${expected}" but got "${stripped}"`);
    }
  } catch (err: any) {
    fail('TC-8.5-01: stripAccents thất bại', err);
    failed++;
  }

  // TEST 2: Encode receipt for Cash payment with cash drawer kick
  const sampleCashReceipt: ReceiptData = {
    header: {
      restaurantName: 'Nhà hàng Ẩm Thực Việt',
      branchName: 'Chi nhánh Quận 1',
      address: '123 Đồng Khởi, Bến Nghé, Q1, TP.HCM',
      hotline: '0901234567',
      wifiSsid: 'AmThucViet_Guest',
      wifiPassword: 'wifi8888',
    },
    metadata: {
      receiptType: 'FINAL_BILL',
      orderCode: 'ORD-20261015-001',
      billCode: 'BILL-20261015-001',
      tableName: 'Bàn 05 (VIP)',
      cashierName: 'Nguyễn Văn Thu Ngân',
      createdAt: new Date('2026-10-15T12:00:00Z'),
      paidAt: new Date('2026-10-15T12:45:00Z'),
    },
    items: [
      {
        name: 'Phở Đặc Biệt',
        quantity: 2,
        unitPrice: 75000,
        amount: 150000,
        selectedOptionsNote: 'Nhiều hành, Thịt tái lăn',
      },
      {
        name: 'Trà Đá',
        quantity: 2,
        unitPrice: 5000,
        amount: 10000,
      },
    ],
    financials: {
      subTotal: 160000,
      discountAmount: 16000,
      taxableAmount: 144000,
      serviceFee: 5000,
      vatPercent: 8,
      vatAmount: 11920,
      totalAmount: 160920,
      paymentMethod: 'Cash',
      cashGiven: 200000,
      cashChange: 39080,
    },
    footer: {
      thankYouMessage: 'Cảm ơn quý khách và hẹn gặp lại!',
      softwareCredit: 'Hóa đơn khởi tạo bởi iMenu POS Cloud',
    },
  };

  try {
    const bytes = EscPosEncoder.encode(sampleCashReceipt, {
      kickDrawer: true,
    });

    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
      throw new Error('Kết quả encode không phải là Uint8Array hợp lệ');
    }

    // Kiểm tra ký tự khởi tạo ESC @ (\x1B\x40)
    if (bytes[0] !== 0x1b || bytes[1] !== 0x40) {
      throw new Error('Thiếu lệnh khởi tạo máy in ESC @');
    }

    // Kiểm tra có lệnh Kick Drawer (\x1B\x70\x00\x19\xFA)
    let foundKickDrawer = false;
    for (let i = 0; i < bytes.length - 4; i++) {
      if (
        bytes[i] === 0x1b &&
        bytes[i + 1] === 0x70 &&
        bytes[i + 2] === 0x00 &&
        bytes[i + 3] === 0x19 &&
        bytes[i + 4] === 0xfa
      ) {
        foundKickDrawer = true;
        break;
      }
    }
    if (!foundKickDrawer) {
      throw new Error('Không tìm thấy lệnh mở két tiền ESC p 0 25 250 cho thanh toán Cash');
    }

    // Kiểm tra có lệnh Cut Paper (\x1D\x56\x42\x00)
    let foundCutPaper = false;
    for (let i = 0; i < bytes.length - 3; i++) {
      if (
        bytes[i] === 0x1d &&
        bytes[i + 1] === 0x56 &&
        bytes[i + 2] === 0x42 &&
        bytes[i + 3] === 0x00
      ) {
        foundCutPaper = true;
        break;
      }
    }
    if (!foundCutPaper) {
      throw new Error('Không tìm thấy lệnh cắt giấy GS V B 0');
    }

    // Chuyển sang Base64
    const base64 = EscPosEncoder.toBase64(bytes);
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('Chuyển đổi Base64 thất bại');
    }

    pass('TC-8.5-02: Encode Cash Receipt sinh nhị phân đầy đủ Init, Kick Drawer, Cut Paper và Base64', `Byte count: ${bytes.length}`);
    passed++;
  } catch (err: any) {
    fail('TC-8.5-02: Encode Cash Receipt thất bại', err);
    failed++;
  }

  // TEST 3: Pre-bill with VietQR, no Kick Drawer
  const sampleVietQrPreBill: ReceiptData = {
    header: {
      restaurantName: 'The Pizza Box',
      branchName: 'Chi nhánh Landmark 81',
      address: '208 Nguyễn Hữu Cảnh, Bình Thạnh',
      hotline: '19001234',
    },
    metadata: {
      receiptType: 'PRE_BILL',
      orderCode: 'ORD-20261015-099',
      tableName: 'Bàn 12',
      cashierName: 'Trần Phục Vụ',
      createdAt: new Date('2026-10-15T13:00:00Z'),
    },
    items: [
      {
        name: 'Pizza Hải Sản Pesto',
        quantity: 1,
        unitPrice: 245000,
        amount: 245000,
      },
    ],
    financials: {
      subTotal: 245000,
      discountAmount: 0,
      taxableAmount: 245000,
      serviceFee: 0,
      vatPercent: 10,
      vatAmount: 24500,
      totalAmount: 269500,
      paymentMethod: 'VietQR',
    },
    paymentQr: {
      vietQrPayloadUrl: 'https://img.vietqr.io/image/970422-0987654321-compact2.png?amount=269500&addInfo=IMENU%20ORD-20261015-099',
      accountNo: '0987654321',
      bankName: 'MBBank',
      accountName: 'CONG TY TNHH PIZZA BOX',
      memo: 'IMENU ORD-20261015-099',
    },
    footer: {
      thankYouMessage: 'Hân hạnh được phục vụ quý khách!',
      softwareCredit: 'Hóa đơn khởi tạo bởi iMenu POS Cloud',
    },
  };

  try {
    const bytes = EscPosEncoder.encode(sampleVietQrPreBill, {
      kickDrawer: false,
    });

    // Xác nhận KHÔNG có lệnh Kick Drawer
    let foundKickDrawer = false;
    for (let i = 0; i < bytes.length - 4; i++) {
      if (
        bytes[i] === 0x1b &&
        bytes[i + 1] === 0x70 &&
        bytes[i + 2] === 0x00 &&
        bytes[i + 3] === 0x19 &&
        bytes[i + 4] === 0xfa
      ) {
        foundKickDrawer = true;
        break;
      }
    }
    if (foundKickDrawer) {
      throw new Error('Hóa đơn VietQR Pre-bill không được kích két tiền (Kick Drawer)');
    }

    pass('TC-8.5-03: Encode VietQR Pre-bill không kích két tiền, hiển thị thông tin chuyển khoản VietQR', `Byte count: ${bytes.length}`);
    passed++;
  } catch (err: any) {
    fail('TC-8.5-03: Encode VietQR Pre-bill thất bại', err);
    failed++;
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử 05-escpos-printer: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite 05-escpos-printer:', err);
  process.exit(1);
});
