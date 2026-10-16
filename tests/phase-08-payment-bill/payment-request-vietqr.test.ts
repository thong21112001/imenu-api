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

const TEST_PORT = 3115;
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
  console.error(`    ${colors.red}${error?.stack || error?.message || (typeof error === 'object' ? JSON.stringify(error) : error)}${colors.reset}`);
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
  console.log(`${colors.bold}${colors.cyan}  Phase 8 Suite 1: Payment Request & VietQR Resolution (Port ${TEST_PORT})   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // ========================================================================
  // PHẦN 1: UNIT TESTS VIETQR HELPER (MEMO, URL, MASK, HIERARCHY)
  // ========================================================================
  console.log(`${colors.bold}--- PHẦN 1: KIỂM TRA ĐƠN VỊ CÁC HÀM TRỢ GIÚP VIETQR (UNIT TESTS) ---${colors.reset}`);

  // TC-8.1-01: Memo format
  try {
    const memo = generateVietQRMemo('ORD-20261016-001');
    if (memo === 'IMENU ORD-20261016-001') {
      pass('TC-8.1-01: generateVietQRMemo tạo đúng định dạng "IMENU <orderCode>"', memo);
      passed++;
    } else {
      throw new Error(`Expected "IMENU ORD-20261016-001" but got "${memo}"`);
    }
  } catch (err: any) {
    fail('TC-8.1-01: generateVietQRMemo thất bại', err);
    failed++;
  }

  // TC-8.1-02: VietQR URL generator
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
      pass('TC-8.1-02: generateVietQRUrl tạo đúng URL hợp lệ theo chuẩn VietQR.io', url);
      passed++;
    } else {
      throw new Error(`URL không đúng cấu trúc: ${url}`);
    }
  } catch (err: any) {
    fail('TC-8.1-02: generateVietQRUrl thất bại', err);
    failed++;
  }

  // TC-8.1-03: Mask bank account
  try {
    const masked1 = maskBankAccount('0901234567');
    const masked2 = maskBankAccount('123');
    if (masked1 === '***4567' && masked2 === '***123') {
      pass('TC-8.1-03: maskBankAccount che mặt nạ giữ 4 số cuối chuẩn xác', `${masked1}, ${masked2}`);
      passed++;
    } else {
      throw new Error(`Mask thất bại: ${masked1}, ${masked2}`);
    }
  } catch (err: any) {
    fail('TC-8.1-03: maskBankAccount thất bại', err);
    failed++;
  }

  // TC-8.1-04: Hierarchy resolution logic
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
      pass('TC-8.1-04: resolveEffectiveBankAccount ưu tiên chi nhánh, fallback về nhà hàng chính xác');
      passed++;
    } else {
      throw new Error(
        `Phân giải sai: b1=${resolvedBranch1?.accountNo}, b2=${resolvedBranch2?.accountNo}, noB=${resolvedNoBranch?.accountNo}`,
      );
    }
  } catch (err: any) {
    fail('TC-8.1-04: resolveEffectiveBankAccount thất bại', err);
    failed++;
  }

  // ========================================================================
  // PHẦN 2: DUAL-GATE PAYMENT REQUEST & STATE MACHINE GUARDS
  // ========================================================================
  console.log(`\n${colors.bold}--- PHẦN 2: QUY TRÌNH YÊU CẦU THANH TOÁN (DUAL-GATE & STATE MACHINE) ---${colors.reset}`);

  // BOOTSTRAP NESTJS APP ON PORT 3115
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
  let branchId = '';
  let branch2Id = '';
  let restaurantSlug = '';
  let ownerToken = '';
  let tableId = '';
  let tableCode = `P8_T01_${timestamp}`;
  let qrToken = '';
  let table2Id = '';
  let table2Code = `P8_T02_${timestamp}`;
  let table2QrToken = '';
  let menuItemId = '';
  let menuItem2Id = '';

  try {
    // Đăng ký nhà hàng thử nghiệm
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 VietQR Test ${timestamp}`,
          phone: '0901234567',
          address: '123 Đinh Tiên Hoàng, Q1, TP.HCM',
        },
        owner: {
          fullName: 'P8 Master Tester',
          phone: '0901234567',
          email: `p8tester.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branchId = restDoc!.branches[0]._id.toString();
    restaurantSlug = restDoc!.slug;

    // Cấu hình tài khoản ngân hàng Restaurant (Chi nhánh 1 kế thừa STK này)
    await connection.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantId) },
      {
        $set: {
          bankAccount: {
            bankId: '970422',
            bankName: 'MBBank',
            accountNo: '0908888888',
            accountName: 'P8 RESTAURANT ACCOUNT',
            template: 'compact2',
          },
        },
      },
    );

    // Tạo thêm Chi nhánh 2 có tài khoản ngân hàng riêng biệt
    const branch2Res = await request('/branches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: `Chi Nhánh 2 - Thủ Đức ${timestamp}`,
        address: '456 Võ Văn Ngân, TP. Thủ Đức',
        phone: '0907654321',
      }),
    });
    branch2Id = branch2Res.data?.data?._id;

    // Cập nhật STK riêng cho Branch 2
    await connection.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantId), 'branches._id': new Types.ObjectId(branch2Id) },
      {
        $set: {
          'branches.$.bankAccount': {
            bankId: '970415',
            bankName: 'VietinBank',
            accountNo: '101088889999',
            accountName: 'P8 BRANCH 2 CUSTOM ACCOUNT',
            template: 'compact2',
          },
        },
      },
    );

    // Tạo Bàn 1 thuộc Chi nhánh 1
    const zone1Res = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu Trong Nhà', branchId }),
    });
    const zone1Id = zone1Res.data?.data?._id;

    const table1Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn P8-01',
        code: tableCode,
        capacity: 4,
        branchId,
        zoneId: zone1Id,
      }),
    });
    tableId = table1Res.data?.data?._id;
    qrToken = table1Res.data?.data?.qrToken;

    // Tạo Bàn 2 thuộc Chi nhánh 2
    const zone2Res = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu Sân Vườn', branchId: branch2Id }),
    });
    const zone2Id = zone2Res.data?.data?._id;

    const table2Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn P8-02 (CN2)',
        code: table2Code,
        capacity: 6,
        branchId: branch2Id,
        zoneId: zone2Id,
      }),
    });
    table2Id = table2Res.data?.data?._id;
    table2QrToken = table2Res.data?.data?.qrToken;

    // Tạo Món ăn
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Thực đơn P8', branchIds: [branchId, branch2Id] }),
    });
    const categoryId = catRes.data?.data?._id;

    const item1Res = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bò Bít Tết Hảo Hạng',
        price: 120000,
        categoryId,
        isAvailable: true,
      }),
    });
    menuItemId = item1Res.data?.data?._id;

    const item2Res = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Khoai Tây Chiên Lắc Phô Mai',
        price: 45000,
        categoryId,
        isAvailable: true,
      }),
    });
    menuItem2Id = item2Res.data?.data?._id;

    // TC-8.1-05: Tạo đơn khách QR (WaitingConfirmation)
    const createOrderRes = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken,
        items: [
          { menuItemId, quantity: 2 }, // 240.000đ
          { menuItemId: menuItem2Id, quantity: 1 }, // 45.000đ -> total 285.000đ
        ],
      }),
    });
    const orderId = createOrderRes.data?.data?._id;
    if (createOrderRes.status === 201 && orderId) {
      pass('TC-8.1-05: Khách quét QR tạo đơn thành công (WaitingConfirmation)', `orderId: ${orderId}`);
      passed++;
    } else {
      fail('TC-8.1-05: Tạo đơn khách QR thất bại', createOrderRes.data);
      failed++;
    }

    // TC-8.1-06: Chặn yêu cầu thanh toán khi đơn đang WaitingConfirmation
    const reqWaitingRes = await request(`/orders/customer/${orderId}/request-payment`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken,
        paymentMethod: 'VietQR',
      }),
    });
    if (reqWaitingRes.status === 400) {
      pass('TC-8.1-06: Chặn yêu cầu thanh toán đơn WaitingConfirmation (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-8.1-06: Không chặn WaitingConfirmation', reqWaitingRes.data);
      failed++;
    }

    // TC-8.1-07: Chặn yêu cầu thanh toán khi QR token sai hoặc bị thu hồi (HTTP 400/403)
    const reqInvalidQrRes = await request(`/orders/customer/${orderId}/request-payment`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken: 'invalid_or_revoked_token',
        paymentMethod: 'VietQR',
      }),
    });
    if (reqInvalidQrRes.status === 400 || reqInvalidQrRes.status === 403) {
      pass('TC-8.1-07: Chặn yêu cầu thanh toán với mã QR Token không hợp lệ thành công (HTTP 400/403)');
      passed++;
    } else {
      fail('TC-8.1-07: Không chặn QR token không hợp lệ', reqInvalidQrRes.status);
      failed++;
    }

    // Duyệt đơn hàng vào bếp: WaitingConfirmation -> Preparing
    await request(`/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // TC-8.1-08: Khách yêu cầu thanh toán từ Preparing (Không cần Staff JWT)
    const custReqRes = await request(`/orders/customer/${orderId}/request-payment`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken,
        paymentMethod: 'VietQR',
      }),
    });
    if (
      custReqRes.status === 200 &&
      custReqRes.data?.data?.status === 'PaymentRequested' &&
      custReqRes.data?.data?.paymentMethod === 'VietQR'
    ) {
      pass('TC-8.1-08: Khách gọi request-payment Public từ Preparing thành công (Preparing -> PaymentRequested)');
      passed++;
    } else {
      fail('TC-8.1-08: Khách yêu cầu thanh toán từ Preparing thất bại', custReqRes.data);
      failed++;
    }

    // TC-8.1-09: Kiểm tra Table.status tự động đồng bộ sang PaymentRequested
    const tableAfterReq = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableId) });
    if (tableAfterReq?.status === 'PaymentRequested') {
      pass('TC-8.1-09: Trạng thái bàn ăn tự động chuyển sang PaymentRequested');
      passed++;
    } else {
      fail('TC-8.1-09: Trạng thái bàn không đổi sang PaymentRequested', tableAfterReq?.status);
      failed++;
    }

    // TC-8.1-10: Idempotent re-call: Đơn đã ở PaymentRequested, khách cập nhật sang Cash
    const reCallRes = await request(`/orders/customer/${orderId}/request-payment`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken,
        paymentMethod: 'Cash',
      }),
    });
    if (
      reCallRes.status === 200 &&
      reCallRes.data?.data?.status === 'PaymentRequested' &&
      reCallRes.data?.data?.paymentMethod === 'Cash'
    ) {
      pass('TC-8.1-10: Idempotent re-call cập nhật paymentMethod = Cash và trả về 200 OK');
      passed++;
    } else {
      fail('TC-8.1-10: Idempotent re-call thất bại', reCallRes.data);
      failed++;
    }

    // TC-8.1-11: Revert Payment Request đưa đơn về Preparing và bàn về Occupied
    const revertRes = await request(`/orders/${orderId}/revert-payment-request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const tableAfterRevert = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableId) });
    if (
      revertRes.status === 200 &&
      revertRes.data?.data?.status === 'Preparing' &&
      tableAfterRevert?.status === 'Occupied'
    ) {
      pass('TC-8.1-11: POST /orders/:id/revert-payment-request khôi phục đơn về Preparing và bàn về Occupied');
      passed++;
    } else {
      fail('TC-8.1-11: Revert Payment Request thất bại', { res: revertRes.data, table: tableAfterRevert?.status });
      failed++;
    }

    // TC-8.1-12: Chuyển món sang Cooking -> Ready -> Request payment từ Ready thành công
    const itemA = revertRes.data?.data?.items?.[0];
    const itemAId = itemA?._id || itemA?.id;
    await request(`/orders/${orderId}/items/${itemAId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: 'Cooking' }),
    });
    await request(`/orders/${orderId}/items/${itemAId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: 'Ready' }),
    });
    const reqReadyRes = await request(`/orders/${orderId}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    if (reqReadyRes.status === 200 && reqReadyRes.data?.data?.status === 'PaymentRequested') {
      pass('TC-8.1-12: Cho phép yêu cầu thanh toán từ trạng thái Ready (Ready -> PaymentRequested)');
      passed++;
    } else {
      fail('TC-8.1-12: Request payment từ Ready thất bại', reqReadyRes.data);
      failed++;
    }

    // Revert lại: đơn về Ready
    await request(`/orders/${orderId}/revert-payment-request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // TC-8.1-13: Chuyển món sang Served -> Request payment từ Served thành công
    await request(`/orders/${orderId}/items/${itemAId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: 'Served' }),
    });
    const reqServedRes = await request(`/orders/${orderId}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    if (reqServedRes.status === 200 && reqServedRes.data?.data?.status === 'PaymentRequested') {
      pass('TC-8.1-13: Cho phép yêu cầu thanh toán từ trạng thái Served (Served -> PaymentRequested)');
      passed++;
    } else {
      fail('TC-8.1-13: Request payment từ Served thất bại', reqServedRes.data);
      failed++;
    }

    // Complete payment đơn 1 để test chặn Paid
    await request(`/orders/${orderId}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });

    // TC-8.1-14: Chặn request-payment trên đơn đã Paid
    const reqPaidRes = await request(`/orders/${orderId}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    if (reqPaidRes.status === 400) {
      pass('TC-8.1-14: Chặn yêu cầu thanh toán trên đơn đã Paid (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-8.1-14: Không chặn đơn đã Paid', reqPaidRes.data);
      failed++;
    }

    // Tạo đơn mới rồi hủy để test chặn Cancelled
    const orderCancelRes = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken,
        items: [{ menuItemId, quantity: 1 }],
      }),
    });
    const cancelOrderId = orderCancelRes.data?.data?._id;
    await request(`/orders/${cancelOrderId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Khách hủy để test' }),
    });

    // TC-8.1-15: Chặn request-payment trên đơn đã Cancelled
    const reqCancelledRes = await request(`/orders/${cancelOrderId}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    if (reqCancelledRes.status === 400) {
      pass('TC-8.1-15: Chặn yêu cầu thanh toán trên đơn đã Cancelled (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-8.1-15: Không chặn đơn đã Cancelled', reqCancelledRes.data);
      failed++;
    }

    // ========================================================================
    // PHẦN 3: PHÂN GIẢI VIETQR ĐA CHI NHÁNH & TRỪ MÓN CANCELLED
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 3: PHÂN GIẢI VIETQR ĐA CHI NHÁNH & TRỪ MÓN CANCELLED ---${colors.reset}`);

    // TC-8.1-16: Chi nhánh 1 không có STK riêng -> Dùng tài khoản của Restaurant
    const orderBranch1Res = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken,
        items: [
          { menuItemId, quantity: 2 }, // 240.000đ
          { menuItemId: menuItem2Id, quantity: 1 }, // 45.000đ -> total 285.000đ
        ],
      }),
    });
    const orderB1Id = orderBranch1Res.data?.data?._id;

    // Duyệt đơn
    await request(`/orders/${orderB1Id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // Lấy VietQR của Chi nhánh 1 qua Public endpoint
    const vqrPublicB1Res = await request(
      `/orders/customer/${orderB1Id}/vietqr?restaurantSlug=${restaurantSlug}&tableCode=${tableCode}&qrToken=${qrToken}`,
    );
    if (
      vqrPublicB1Res.status === 200 &&
      vqrPublicB1Res.data?.data?.accountNo === '0908888888' &&
      vqrPublicB1Res.data?.data?.bankId === '970422' &&
      vqrPublicB1Res.data?.data?.amount === 285000
    ) {
      pass('TC-8.1-16: Chi nhánh 1 tự động kế thừa tài khoản ngân hàng của Restaurant (0908888888 - 285.000đ)');
      passed++;
    } else {
      fail('TC-8.1-16: Chi nhánh 1 phân giải sai tài khoản', vqrPublicB1Res.data);
      failed++;
    }

    // TC-8.1-17: Chi nhánh 2 có STK riêng -> Ưu tiên dùng STK Chi nhánh 2
    const orderBranch2Res = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode: table2Code,
        qrToken: table2QrToken,
        items: [{ menuItemId, quantity: 1 }], // 120.000đ
      }),
    });
    const orderB2Id = orderBranch2Res.data?.data?._id;

    await request(`/orders/${orderB2Id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    const vqrPublicB2Res = await request(
      `/orders/customer/${orderB2Id}/vietqr?restaurantSlug=${restaurantSlug}&tableCode=${table2Code}&qrToken=${table2QrToken}`,
    );
    if (
      vqrPublicB2Res.status === 200 &&
      vqrPublicB2Res.data?.data?.accountNo === '101088889999' &&
      vqrPublicB2Res.data?.data?.bankId === '970415' &&
      vqrPublicB2Res.data?.data?.amount === 120000
    ) {
      pass('TC-8.1-17: Chi nhánh 2 ưu tiên sử dụng STK riêng của Branch (101088889999 - VietinBank)');
      passed++;
    } else {
      fail('TC-8.1-17: Chi nhánh 2 phân giải sai STK', vqrPublicB2Res.data);
      failed++;
    }

    // TC-8.1-18: Hủy 1 món trong đơn B1 (Khoai tây 45.000đ) -> VietQR tự động cập nhật số tiền khớp chính xác totalAmount đã trừ món hủy
    const itemToCancel = orderBranch1Res.data?.data?.items?.find((i: any) => i.price === 45000);
    const itemToCancelId = itemToCancel?._id || itemToCancel?.id;
    await request(`/orders/${orderB1Id}/items/${itemToCancelId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Khách đổi ý hủy món' }),
    });

    const vqrAfterCancelRes = await request(
      `/orders/customer/${orderB1Id}/vietqr?restaurantSlug=${restaurantSlug}&tableCode=${tableCode}&qrToken=${qrToken}`,
    );
    const expectedAmountAfterCancel = 240000; // 285.000 - 45.000
    if (
      vqrAfterCancelRes.status === 200 &&
      vqrAfterCancelRes.data?.data?.amount === expectedAmountAfterCancel &&
      vqrAfterCancelRes.data?.data?.vietQrUrl?.includes(`amount=${expectedAmountAfterCancel}`)
    ) {
      pass(
        `TC-8.1-18: Số tiền VietQR khớp chính xác totalAmount sau khi loại trừ món Cancelled (${expectedAmountAfterCancel.toLocaleString('vi-VN')} đ)`,
      );
      passed++;
    } else {
      fail('TC-8.1-18: Số tiền VietQR không trừ món Cancelled', vqrAfterCancelRes.data);
      failed++;
    }

    // TC-8.1-19 (AUD-8.1): Bàn 01 dùng QR hợp lệ của mình nhưng cố tình request-payment cho Bàn 02 -> 404 Not Found
    const crossTableReqRes = await request(`/orders/customer/${orderB2Id}/request-payment`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode, // Bàn 1
        qrToken,   // QR token Bàn 1
        paymentMethod: 'VietQR',
      }),
    });
    if (crossTableReqRes.status === 404 || crossTableReqRes.status === 403) {
      pass('TC-8.1-19 (AUD-8.1): Chặn đứng Cross-Table request-payment khi dùng QR Bàn 1 gọi đơn Bàn 2 (HTTP 404/403)');
      passed++;
    } else {
      fail('TC-8.1-19: Không chặn Cross-Table request-payment', crossTableReqRes.status);
      failed++;
    }

    // TC-8.1-20 (AUD-8.1): Bàn 01 dùng QR hợp lệ của mình nhưng xem VietQR của Bàn 02 -> 404 Not Found
    const crossTableVqrRes = await request(
      `/orders/customer/${orderB2Id}/vietqr?restaurantSlug=${restaurantSlug}&tableCode=${tableCode}&qrToken=${qrToken}`,
    );
    if (crossTableVqrRes.status === 404 || crossTableVqrRes.status === 403) {
      pass('TC-8.1-20 (AUD-8.1): Chặn đứng Cross-Table VietQR khi dùng QR Bàn 1 soi đơn Bàn 2 (HTTP 404/403)');
      passed++;
    } else {
      fail('TC-8.1-20: Không chặn Cross-Table VietQR', crossTableVqrRes.status);
      failed++;
    }

    // TC-8.1-21 (AUD-8.1): Bàn 01 dùng QR hợp lệ của mình nhưng xem Receipt của Bàn 02 -> 404 Not Found
    const crossTableReceiptRes = await request(
      `/orders/customer/${orderB2Id}/receipt?restaurantSlug=${restaurantSlug}&tableCode=${tableCode}&qrToken=${qrToken}`,
    );
    if (crossTableReceiptRes.status === 404 || crossTableReceiptRes.status === 403) {
      pass('TC-8.1-21 (AUD-8.1): Chặn đứng Cross-Table Receipt khi dùng QR Bàn 1 soi hóa đơn Bàn 2 (HTTP 404/403)');
      passed++;
    } else {
      fail('TC-8.1-21: Không chặn Cross-Table Receipt', crossTableReceiptRes.status);
      failed++;
    }

    // TC-8.1-22 (AUD-8.4): Client cố tình truyền query giả mạo ?amount=1000 vào VietQR -> Bị phớt lờ, tính đúng từ server
    const tamperVqrRes = await request(
      `/orders/customer/${orderB1Id}/vietqr?restaurantSlug=${restaurantSlug}&tableCode=${tableCode}&qrToken=${qrToken}&amount=1000`,
    );
    if (
      tamperVqrRes.status === 200 &&
      tamperVqrRes.data?.data?.amount === expectedAmountAfterCancel &&
      !tamperVqrRes.data?.data?.vietQrUrl?.includes('amount=1000')
    ) {
      pass('TC-8.1-22 (AUD-8.4): Số tiền VietQR hoàn toàn phớt lờ tham số amount=1000 giả mạo từ client query');
      passed++;
    } else {
      fail('TC-8.1-22: VietQR bị thao túng số tiền bởi client', tamperVqrRes.data);
      failed++;
    }

    // TC-8.1-23 (AUD-8.2): Đơn đang PaymentRequested, thêm món mới -> Table.status chuyển về Occupied
    // Chuyển Bàn 2 sang PaymentRequested
    await request(`/orders/customer/${orderB2Id}/request-payment`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode: table2Code,
        qrToken: table2QrToken,
        paymentMethod: 'VietQR',
      }),
    });
    // Khách gọi thêm Round 2 tại Bàn 2
    await request('/orders/customer/items', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode: table2Code,
        qrToken: table2QrToken,
        orderId: orderB2Id,
        items: [{ menuItemId, quantity: 1 }],
      }),
    });
    // Thu ngân duyệt Round 2 của Bàn 2
    await request(`/orders/${orderB2Id}/rounds/2/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const table2DocAfterAdd = await connection.collection('tables').findOne({ _id: new Types.ObjectId(table2Id) });
    const order2DocAfterAdd = await connection.collection('orders').findOne({ _id: new Types.ObjectId(orderB2Id) });
    if (
      table2DocAfterAdd?.status === 'Occupied' &&
      order2DocAfterAdd?.status === 'Preparing'
    ) {
      pass('TC-8.1-23 (AUD-8.2): Gọi thêm món khi đang PaymentRequested tự động đưa Table về Occupied & Order về Preparing');
      passed++;
    } else {
      fail('TC-8.1-23: Table hoặc Order không chuyển về Occupied/Preparing khi thêm món', {
        tableStatus: table2DocAfterAdd?.status,
        orderStatus: order2DocAfterAdd?.status,
      });
      failed++;
    }

  } catch (error: any) {
    fail('Toàn cục test suite payment-request-vietqr gặp lỗi ngoại lệ', error);
    failed++;
  } finally {
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
  console.log(`Kết quả kiểm thử payment-request-vietqr: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite payment-request-vietqr:', err);
  process.exit(1);
});
