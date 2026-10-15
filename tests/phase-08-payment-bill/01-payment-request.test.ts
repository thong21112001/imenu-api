import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';

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
  console.log(`${colors.bold}${colors.cyan}  Phase 8: Payment Request & Revert Workflow (Dual-Gate & State Machine) ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // 1. BOOTSTRAP NESTJS APP
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
  let restaurantSlug = '';
  let ownerToken = '';
  let tableId = '';
  let tableCode = `P8_T01_${timestamp}`;
  let qrToken = '';
  let menuItemId = '';

  try {
    // 2. REGISTER TEST RESTAURANT & OWNER
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 Restaurant ${timestamp}`,
          phone: '0901234567',
          address: '123 Test St, District 1',
        },
        owner: {
          fullName: 'P8 Test Owner',
          phone: '0901234567',
          email: `p8owner.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branchId = restDoc!.branches[0]._id.toString();
    restaurantSlug = restDoc!.slug;

    // Set bankAccount on restaurant
    await connection.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantId) },
      {
        $set: {
          bankAccount: {
            bankId: '970422',
            bankName: 'MBBank',
            accountNo: '0908888888',
            accountName: 'P8 TEST RESTAURANT',
            template: 'compact2',
          },
        },
      },
    );

    // Create Zone & Table
    const zoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu A', branchId }),
    });
    const zoneId = zoneRes.data?.data?._id;

    const tableRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn P8-01',
        code: tableCode,
        capacity: 4,
        branchId,
        zoneId,
      }),
    });
    tableId = tableRes.data?.data?._id;
    qrToken = tableRes.data?.data?.qrToken;

    // Create Category & Menu Item
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Món Chính P8', branchIds: [branchId] }),
    });
    const categoryId = catRes.data?.data?._id;

    const itemRes = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Cơm Tấm Sườn Bì Chả',
        price: 65000,
        categoryId,
        isAvailable: true,
      }),
    });
    menuItemId = itemRes.data?.data?._id;

    console.log(`\n${colors.bold}--- PHẦN 1: TẠO ĐƠN VÀ KIỂM TRA CHẶN WAITING CONFIRMATION ---${colors.reset}`);

    // TC-8.1-01: Tạo đơn khách QR (WaitingConfirmation)
    const createOrderRes = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken,
        items: [{ menuItemId, quantity: 2 }],
      }),
    });
    const orderId = createOrderRes.data?.data?._id;
    if (createOrderRes.status === 201 && orderId) {
      pass('TC-8.1-01: Tạo đơn khách QR thành công (WaitingConfirmation)', `orderId: ${orderId}`);
      passed++;
    } else {
      fail('TC-8.1-01: Tạo đơn khách QR thất bại', createOrderRes.data);
      failed++;
    }

    // TC-8.1-02: Chặn yêu cầu thanh toán khi đơn đang WaitingConfirmation
    const reqWaitingRes = await request(`/orders/${orderId}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    if (reqWaitingRes.status === 400) {
      pass('TC-8.1-02: Chặn yêu cầu thanh toán đơn WaitingConfirmation (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-8.1-02: Không chặn WaitingConfirmation', reqWaitingRes.data);
      failed++;
    }

    // Duyệt đơn hàng: WaitingConfirmation -> Preparing
    const confirmOrderRes = await request(`/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (confirmOrderRes.status === 200 && confirmOrderRes.data?.data?.status === 'Preparing') {
      pass('TC-8.1-03: Xác nhận đơn sang Preparing thành công');
      passed++;
    } else {
      fail('TC-8.1-03: Xác nhận đơn thất bại', confirmOrderRes.data);
      failed++;
    }

    console.log(`\n${colors.bold}--- PHẦN 2: DUAL-GATE PAYMENT REQUEST TỪ PREPARING ---${colors.reset}`);

    // TC-8.1-04: Khách yêu cầu thanh toán qua /orders/customer/:id/request-payment (Public)
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
      pass('TC-8.1-04: Khách yêu cầu thanh toán qua Public endpoint thành công (Preparing -> PaymentRequested)');
      passed++;
    } else {
      fail('TC-8.1-04: Khách yêu cầu thanh toán thất bại', custReqRes.data);
      failed++;
    }

    // TC-8.1-05: Kiểm tra table.status được đồng bộ sang PaymentRequested
    const tableAfterReq = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableId) });
    if (tableAfterReq?.status === 'PaymentRequested') {
      pass('TC-8.1-05: Trạng thái bàn ăn tự động đồng bộ sang PaymentRequested');
      passed++;
    } else {
      fail('TC-8.1-05: Bàn ăn không chuyển PaymentRequested', tableAfterReq?.status);
      failed++;
    }

    // TC-8.1-06: Idempotent re-call: Đơn đã ở PaymentRequested, khách đổi sang Cash
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
      pass('TC-8.1-06: Idempotent re-call cập nhật phương thức sang Cash và trả về 200 OK');
      passed++;
    } else {
      fail('TC-8.1-06: Idempotent re-call thất bại', reCallRes.data);
      failed++;
    }

    // TC-8.1-07: Staff revert payment request: PaymentRequested -> Preparing (do món vẫn ở Waiting)
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
      pass('TC-8.1-07: Revert Payment Request khôi phục đơn về Preparing và bàn về Occupied thành công');
      passed++;
    } else {
      fail('TC-8.1-07: Revert thất bại', { res: revertRes.data, tableStatus: tableAfterRevert?.status });
      failed++;
    }

    // TC-8.1-08: Revert khi đơn không ở PaymentRequested -> 400 Bad Request
    const revertInvalidRes = await request(`/orders/${orderId}/revert-payment-request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (revertInvalidRes.status === 400) {
      pass('TC-8.1-08: Chặn revert khi đơn không ở PaymentRequested (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-8.1-08: Không chặn revert không hợp lệ', revertInvalidRes.data);
      failed++;
    }

    console.log(`\n${colors.bold}--- PHẦN 3: REQUEST PAYMENT TỪ READY VÀ SERVED ---${colors.reset}`);

    // Chuyển món từ Waiting -> Cooking -> Ready
    const activeItem = revertRes.data?.data?.items?.[0];
    const itemId = activeItem?._id || activeItem?.id;
    await request(`/orders/${orderId}/items/${itemId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: 'Cooking' }),
    });
    await request(`/orders/${orderId}/items/${itemId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: 'Ready' }),
    });

    // TC-8.1-09: Request payment từ trạng thái Ready
    const reqReadyRes = await request(`/orders/${orderId}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    if (reqReadyRes.status === 200 && reqReadyRes.data?.data?.status === 'PaymentRequested') {
      pass('TC-8.1-09: Request payment từ trạng thái Ready thành công (Ready -> PaymentRequested)');
      passed++;
    } else {
      fail('TC-8.1-09: Request payment từ Ready thất bại', reqReadyRes.data);
      failed++;
    }

    // Revert lại: khôi phục về Ready
    const revertReadyRes = await request(`/orders/${orderId}/revert-payment-request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (revertReadyRes.status === 200 && revertReadyRes.data?.data?.status === 'Ready') {
      pass('TC-8.1-10: Revert khôi phục trạng thái chuẩn xác về Ready qua Reducer');
      passed++;
    } else {
      fail('TC-8.1-10: Revert về Ready thất bại', revertReadyRes.data);
      failed++;
    }

    // Chuyển món sang Served -> Order = Served
    await request(`/orders/${orderId}/items/${itemId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: 'Served' }),
    });

    // TC-8.1-11: Request payment từ trạng thái Served
    const reqServedRes = await request(`/orders/${orderId}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    if (reqServedRes.status === 200 && reqServedRes.data?.data?.status === 'PaymentRequested') {
      pass('TC-8.1-11: Request payment từ trạng thái Served thành công (Served -> PaymentRequested)');
      passed++;
    } else {
      fail('TC-8.1-11: Request payment từ Served thất bại', reqServedRes.data);
      failed++;
    }

    console.log(`\n${colors.bold}--- PHẦN 4: CHẶN REQUEST PAYMENT TRÊN CANCELLED & PAID ---${colors.reset}`);

    // Thanh toán đơn hàng qua complete-payment
    const payRes = await request(`/orders/${orderId}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    if (payRes.status === 200 && payRes.data?.data?.order?.status === 'Paid') {
      pass('TC-8.1-12: Hoàn tất thanh toán đơn hàng thành công');
      passed++;
    } else {
      fail('TC-8.1-12: Thanh toán đơn hàng thất bại', payRes.data);
      failed++;
    }

    // TC-8.1-13: Chặn request payment trên đơn đã Paid
    const reqPaidRes = await request(`/orders/${orderId}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    if (reqPaidRes.status === 400) {
      pass('TC-8.1-13: Chặn yêu cầu thanh toán trên đơn đã Paid (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-8.1-13: Không chặn đơn đã Paid', reqPaidRes.data);
      failed++;
    }

    // Tạo đơn mới và hủy để kiểm tra chặn trên Cancelled
    const order2Res = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken,
        items: [{ menuItemId, quantity: 1 }],
      }),
    });
    const order2Id = order2Res.data?.data?._id;
    await request(`/orders/${order2Id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Khách đổi ý hủy đơn' }),
    });

    // TC-8.1-14: Chặn request payment trên đơn đã Cancelled
    const reqCancelledRes = await request(`/orders/${order2Id}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    if (reqCancelledRes.status === 400) {
      pass('TC-8.1-14: Chặn yêu cầu thanh toán trên đơn đã Cancelled (HTTP 400 Bad Request)');
      passed++;
    } else {
      fail('TC-8.1-14: Không chặn đơn đã Cancelled', reqCancelledRes.data);
      failed++;
    }

  } catch (error: any) {
    fail('Toàn cục test suite 01-payment-request gặp lỗi ngoại lệ', error);
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
  console.log(`Kết quả kiểm thử 01-payment-request: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite 01-payment-request:', err);
  process.exit(1);
});
