import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import {
  resolveEffectiveBankAccount,
  generateVietQRMemo,
  generateVietQRUrl,
  maskBankAccount,
} from '../../src/modules/bills/helpers/vietqr.helper';

const TEST_PORT = 3097;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let app: INestApplication;

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

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 8: VietQR Dynamic Resolution, Bank Hierarchy & Public Access   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // ========================================================================
  // PHẦN A: UNIT TESTS VIETQR HELPER (HIERARCHY, MEMO, URL, MASK)
  // ========================================================================
  console.log(`\n${colors.bold}--- PHẦN A: KIỂM TRA ĐƠN VỊ CÁC HÀM TRỢ GIÚP VIETQR (UNIT TESTS) ---${colors.reset}`);

  // TC-8.2-01: Memo format
  try {
    const memo = generateVietQRMemo('ORD-20261015-001');
    if (memo === 'IMENU ORD-20261015-001') {
      pass('TC-8.2-01: generateVietQRMemo tạo đúng định dạng "IMENU <orderCode>"', memo);
      passed++;
    } else {
      throw new Error(`Expected "IMENU ORD-20261015-001" but got "${memo}"`);
    }
  } catch (err: any) {
    fail('TC-8.2-01: generateVietQRMemo thất bại', err);
    failed++;
  }

  // TC-8.2-02: VietQR URL generator
  try {
    const url = generateVietQRUrl({
      bankId: '970422',
      accountNo: '0901234567',
      template: 'compact2',
      amount: 150000,
      memo: 'IMENU ORD-001',
      accountName: 'NGUYEN VAN A',
    });
    const expectedPrefix = 'https://img.vietqr.io/image/970422-0901234567-compact2.png';
    if (
      url.startsWith(expectedPrefix) &&
      url.includes('amount=150000') &&
      url.includes('addInfo=IMENU%20ORD-001') &&
      url.includes('accountName=NGUYEN%20VAN%20A')
    ) {
      pass('TC-8.2-02: generateVietQRUrl tạo đúng URL hợp lệ theo chuẩn VietQR.io', url);
      passed++;
    } else {
      throw new Error(`URL không đúng cấu trúc: ${url}`);
    }
  } catch (err: any) {
    fail('TC-8.2-02: generateVietQRUrl thất bại', err);
    failed++;
  }

  // TC-8.2-03: Mask bank account
  try {
    const masked1 = maskBankAccount('0901234567');
    const masked2 = maskBankAccount('123');
    if (masked1 === '***4567' && masked2 === '***123') {
      pass('TC-8.2-03: maskBankAccount che mặt nạ giữ 4 số cuối chuẩn xác', `${masked1}, ${masked2}`);
      passed++;
    } else {
      throw new Error(`Mask thất bại: ${masked1}, ${masked2}`);
    }
  } catch (err: any) {
    fail('TC-8.2-03: maskBankAccount thất bại', err);
    failed++;
  }

  // TC-8.2-04: Hierarchy resolution logic
  try {
    const mockRest = {
      bankAccount: { bankId: '970422', accountNo: '11111111', accountName: 'REST BANK' },
      branches: [
        {
          _id: 'branch-1',
          bankAccount: { bankId: '970415', accountNo: '22222222', accountName: 'BRANCH 1 BANK' },
        },
        {
          _id: 'branch-2',
          bankAccount: { bankId: '', accountNo: '' },
        },
      ],
    };

    const resolvedBranch1 = resolveEffectiveBankAccount(mockRest, 'branch-1');
    const resolvedBranch2 = resolveEffectiveBankAccount(mockRest, 'branch-2');
    const resolvedNoBranch = resolveEffectiveBankAccount(mockRest);

    if (
      resolvedBranch1?.accountNo === '22222222' &&
      resolvedBranch1?.resolvedFrom === 'BRANCH' &&
      resolvedBranch2?.accountNo === '11111111' &&
      resolvedBranch2?.resolvedFrom === 'RESTAURANT' &&
      resolvedNoBranch?.accountNo === '11111111' &&
      resolvedNoBranch?.resolvedFrom === 'RESTAURANT'
    ) {
      pass('TC-8.2-04: resolveEffectiveBankAccount ưu tiên chi nhánh, fallback về nhà hàng chính xác');
      passed++;
    } else {
      throw new Error(
        `Phân giải sai: b1=${resolvedBranch1?.accountNo}, b2=${resolvedBranch2?.accountNo}, noB=${resolvedNoBranch?.accountNo}`,
      );
    }
  } catch (err: any) {
    fail('TC-8.2-04: resolveEffectiveBankAccount thất bại', err);
    failed++;
  }

  // ========================================================================
  // PHẦN B: INTEGRATION TESTS QUA HTTP ENDPOINTS
  // ========================================================================
  console.log(`\n${colors.bold}--- PHẦN B: KIỂM TRA PHÂN GIẢI NGỮ CẢNH VÀ VIETQR QUA HTTP ---${colors.reset}`);

  // BOOTSTRAP NESTJS
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(TEST_PORT);

  const connection: Connection = app.get(getConnectionToken());
  const timestamp = Date.now();
  let restaurantId = '';
  let branch1Id = '';
  let branch2Id = '';
  let restaurantSlug = '';
  let ownerToken = '';
  let table1Code = `P8_VQR_T1_${timestamp}`;
  let table2Code = `P8_VQR_T2_${timestamp}`;
  let table1QrToken = '';
  let table2QrToken = '';
  let menuItemId = '';

  try {
    // 1. Tạo nhà hàng với tài khoản ngân hàng cấp Restaurant
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 VietQR Rest ${timestamp}`,
          phone: '0901234567',
          address: '100 Hai Ba Trung, Q1',
        },
        owner: {
          fullName: 'P8 VietQR Owner',
          phone: '0901234567',
          email: `p8vqr.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branch1Id = restDoc!.branches[0]._id.toString();
    restaurantSlug = restDoc!.slug;

    // Cấu hình ngân hàng cho Restaurant & Branch 1
    branch2Id = new Types.ObjectId().toString();
    await connection.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantId) },
      {
        $set: {
          bankAccount: {
            bankId: '970422',
            bankName: 'MBBank',
            accountNo: '0908888888',
            accountName: 'RESTAURANT MBBANK',
            template: 'compact2',
          },
          'branches.0.bankAccount': {
            bankId: '970415',
            bankName: 'VietinBank',
            accountNo: '0901111111',
            accountName: 'BRANCH 1 VIETINBANK',
            template: 'compact2',
          },
        },
      },
    );

    await connection.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantId) },
      {
        $push: {
          branches: {
            _id: new Types.ObjectId(branch2Id),
            name: 'Chi Nhánh 2 (Không cấu hình tài khoản riêng)',
            address: '200 Le Loi',
            phone: '0902222222',
            isMainBranch: false,
            status: 'ACTIVE',
            isDeleted: false,
          },
        } as any,
      },
    );

    // Tạo Zone & Bàn ở Branch 1 và Branch 2
    const z1Res = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu B1', branchId: branch1Id }),
    });
    const z1Id = z1Res.data?.data?._id;

    const z2Res = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu B2', branchId: branch2Id }),
    });
    const z2Id = z2Res.data?.data?._id;

    const t1Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn B1-01',
        code: table1Code,
        capacity: 4,
        branchId: branch1Id,
        zoneId: z1Id,
      }),
    });
    table1QrToken = t1Res.data?.data?.qrToken;

    const t2Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn B2-01',
        code: table2Code,
        capacity: 4,
        branchId: branch2Id,
        zoneId: z2Id,
      }),
    });
    table2QrToken = t2Res.data?.data?.qrToken;

    // Tạo Category & Menu Item
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Thực Đơn VietQR', branchIds: [branch1Id, branch2Id] }),
    });
    const catId = catRes.data?.data?._id;

    const itemRes = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Trà Sữa Oolong Nướng',
        price: 45000,
        categoryId: catId,
        isAvailable: true,
      }),
    });
    menuItemId = itemRes.data?.data?._id;

    // TC-8.2-05: getTableContextByQr trả về ngân hàng hiệu lực của Branch 1
    const ctx1Res = await request(
      `/orders/public/table-context?restaurantSlug=${restaurantSlug}&tableCode=${table1Code}&qrToken=${table1QrToken}`,
    );
    const bankB1 = ctx1Res.data?.data?.bankAccount || ctx1Res.data?.data?.restaurant?.bankAccount;
    if (ctx1Res.status === 200 && bankB1?.accountNo === '0901111111' && bankB1?.resolvedFrom === 'BRANCH') {
      pass('TC-8.2-05: getTableContextByQr cho Bàn 1 trả về đúng tài khoản của Chi nhánh 1 (VietinBank 0901111111)');
      passed++;
    } else {
      fail('TC-8.2-05: getTableContextByQr Bàn 1 thất bại', { bank: bankB1, res: ctx1Res.data });
      failed++;
    }

    // TC-8.2-06: getTableContextByQr trả về ngân hàng fallback của Restaurant cho Branch 2
    const ctx2Res = await request(
      `/orders/public/table-context?restaurantSlug=${restaurantSlug}&tableCode=${table2Code}&qrToken=${table2QrToken}`,
    );
    const bankB2 = ctx2Res.data?.data?.bankAccount || ctx2Res.data?.data?.restaurant?.bankAccount;
    if (ctx2Res.status === 200 && bankB2?.accountNo === '0908888888' && bankB2?.resolvedFrom === 'RESTAURANT') {
      pass('TC-8.2-06: getTableContextByQr cho Bàn 2 fallback về tài khoản của Nhà hàng (MBBank 0908888888)');
      passed++;
    } else {
      fail('TC-8.2-06: getTableContextByQr Bàn 2 thất bại', { bank: bankB2, res: ctx2Res.data });
      failed++;
    }

    // Tạo đơn hàng tại Bàn 1
    const order1Res = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode: table1Code,
        qrToken: table1QrToken,
        items: [{ menuItemId, quantity: 2 }],
      }),
    });
    const order1Id = order1Res.data?.data?._id;

    // TC-8.2-07: Lấy VietQR của Order 1 qua Staff JWT
    const vqrStaffRes = await request(`/orders/${order1Id}/vietqr`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (
      vqrStaffRes.status === 200 &&
      vqrStaffRes.data?.data?.accountNo === '0901111111' &&
      vqrStaffRes.data?.data?.amount === 90000 &&
      vqrStaffRes.data?.data?.memo?.startsWith('IMENU') &&
      vqrStaffRes.data?.data?.vietQrUrl?.includes('amount=90000')
    ) {
      pass('TC-8.2-07: GET /orders/:id/vietqr với Staff JWT trả về đầy đủ thông tin VietQR động của Chi nhánh 1');
      passed++;
    } else {
      fail('TC-8.2-07: GET /orders/:id/vietqr với Staff JWT thất bại', vqrStaffRes.data);
      failed++;
    }

    // TC-8.2-08: Lấy VietQR của Order 1 qua Public QR endpoint
    const vqrCustRes = await request(
      `/orders/customer/${order1Id}/vietqr?restaurantSlug=${restaurantSlug}&tableCode=${table1Code}&qrToken=${table1QrToken}`,
    );
    if (
      vqrCustRes.status === 200 &&
      vqrCustRes.data?.data?.accountNo === '0901111111' &&
      vqrCustRes.data?.data?.amount === 90000
    ) {
      pass('TC-8.2-08: GET /orders/customer/:id/vietqr với mã QR bàn hợp lệ trả về dữ liệu VietQR chính xác');
      passed++;
    } else {
      fail('TC-8.2-08: GET /orders/customer/:id/vietqr thất bại', vqrCustRes.data);
      failed++;
    }

    // TC-8.2-09: Lấy ReceiptData Pre-bill qua Public endpoint
    const receiptRes = await request(
      `/orders/customer/${order1Id}/receipt?restaurantSlug=${restaurantSlug}&tableCode=${table1Code}&qrToken=${table1QrToken}`,
    );
    if (
      receiptRes.status === 200 &&
      receiptRes.data?.data?.metadata?.receiptType === 'PRE_BILL' &&
      receiptRes.data?.data?.financials?.totalAmount === 90000 &&
      receiptRes.data?.data?.paymentQr?.accountNo === '0901111111'
    ) {
      pass('TC-8.2-09: GET /orders/customer/:id/receipt trả về ReceiptData Pre-bill đầy đủ kèm thông tin thanh toán QR');
      passed++;
    } else {
      fail('TC-8.2-09: GET /orders/customer/:id/receipt thất bại', receiptRes.data);
      failed++;
    }

  } catch (error: any) {
    fail('Toàn cục test suite 02-vietqr-resolution gặp lỗi ngoại lệ', error);
    failed++;
  } finally {
    // TEARDOWN
    console.log(`\n[Teardown] Dọn dẹp tài nguyên kiểm thử...`);
    try {
      const db = connection.db;
      if (db && restaurantId) {
        await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
        await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('tablezones').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('categories').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('menuitems').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('bills').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('activitylogs').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      }
    } catch {}
    await app.close();
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử 02-vietqr-resolution: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite 02-vietqr-resolution:', err);
  process.exit(1);
});
