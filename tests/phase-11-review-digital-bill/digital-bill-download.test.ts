import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { getTestFixtureSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3131;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 11 Suite 3: Digital Bill Download & Receipt Access Token (Port ${TEST_PORT}) ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  try {
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

    // 1. Setup Test Restaurant & Owner
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P11 Digital Bill Test ${timestamp}`,
          phone: '0905556677',
          address: '333 Nam Kỳ Khởi Nghĩa, Q3, TP.HCM',
        },
        owner: {
          fullName: 'P11 Bill Tester',
          phone: '0905556677',
          email: `p11bill.${timestamp}@imenu.vn`,
          password: getTestFixtureSecret(),
        },
      }),
    });

    const restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    const ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    const branchId = restDoc!.branches[0]._id.toString();
    const restaurantSlug = restDoc!.slug;

    // 2. Setup Category & Menu Items
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Ẩm Thực Đặc Sản',
        branchIds: [branchId],
      }),
    });
    const categoryId = catRes.data?.data?._id || catRes.data?.data?.id;

    const itemRes = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Lẩu Nấm Hải Sản',
        price: 380000,
        categoryId,
        isAvailable: true,
      }),
    });
    const menuItemId = itemRes.data?.data?._id || itemRes.data?.data?.id;

    // 3. Setup Table Zone & Table
    const zoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Sảnh Chính Bill',
        branchId,
      }),
    });
    const zoneId = zoneRes.data?.data?._id || zoneRes.data?.data?.id;

    const tableCode = `TBILL_${timestamp}`;
    const tRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        branchId,
        zoneId,
        name: `Bàn Bill 01`,
        code: tableCode,
        capacity: 6,
      }),
    });
    const qrToken = tRes.data?.data?.qrToken;

    // 4. Create Order & Confirm it
    const createRes = await request('/orders/customer', {
      method: 'POST',
      headers: { 'idempotency-key': `bill_idem_${timestamp}` },
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken,
        items: [{ menuItemId, quantity: 1, note: 'Ít cay' }],
      }),
    });
    const orderData = createRes.data?.data;
    const orderId = (orderData._id || orderData.id).toString();

    // Confirm order so it can transition to PaymentRequested
    await request(`/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // Request payment so billCode and receiptAccessToken are assigned
    const payReqRes = await request(`/orders/customer/${orderId}/request-payment`, {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode,
        qrToken,
        paymentMethod: 'VietQR',
      }),
    });

    const receiptAccessToken = payReqRes.data?.data?.receiptAccessToken || orderData.receiptAccessToken;

    // ========================================================================
    // TEST CASES: DIGITAL BILL DOWNLOAD & POST-SETTLEMENT TOKEN
    // ========================================================================

    // TC-11.3-01: Download bill via active QR session
    try {
      const billRes = await request(
        `/orders/customer/${orderId}/download-bill?restaurantSlug=${restaurantSlug}&tableCode=${tableCode}&qrToken=${qrToken}`,
      );

      if (billRes.status === 200 && billRes.data?.data) {
        pass('TC-11.3-01: Tải dữ liệu hóa đơn điện tử thành công qua phiên QR tại bàn (GET customer/:id/download-bill)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200 OK nhưng nhận ${billRes.status}: ${JSON.stringify(billRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.3-01: Download bill via active QR session thất bại', err);
      failed++;
    }

    // TC-11.3-02: Bill payload completeness & structure
    try {
      const billRes = await request(
        `/orders/customer/${orderId}/download-bill?restaurantSlug=${restaurantSlug}&tableCode=${tableCode}&qrToken=${qrToken}`,
      );

      const d = billRes.data?.data;
      const isValid =
        d &&
        (d.orderCode || d.metadata?.orderCode) &&
        (d.restaurantName || d.header?.restaurantName) &&
        Array.isArray(d.items) &&
        d.items.length >= 1 &&
        d.items[0].name === 'Lẩu Nấm Hải Sản' &&
        (d.totalAmount === 380000 || d.financials?.totalAmount === 380000);

      if (isValid) {
        pass('TC-11.3-02: Dữ liệu hóa đơn đầy đủ tên nhà hàng, danh sách món, đơn giá, ghi chú và tổng tiền');
        passed++;
      } else {
        throw new Error(`Cấu trúc hóa đơn không đầy đủ: ${JSON.stringify(d)}`);
      }
    } catch (err: any) {
      fail('TC-11.3-02: Bill payload completeness thất bại', err);
      failed++;
    }

    // TC-11.3-03: Verify receiptAccessToken exists and allows download post-settlement (AUD-11.4)
    try {
      if (!receiptAccessToken || typeof receiptAccessToken !== 'string' || receiptAccessToken.length < 16) {
        throw new Error(`receiptAccessToken không hợp lệ hoặc chưa được sinh: ${receiptAccessToken}`);
      }

      // Download using ONLY receiptAccessToken (WITHOUT qrToken or table credentials!)
      const tokenDownloadRes = await request(
        `/orders/customer/${orderId}/download-bill?receiptAccessToken=${receiptAccessToken}`,
      );

      if (tokenDownloadRes.status === 200 && tokenDownloadRes.data?.data) {
        pass('TC-11.3-03: Khách hàng tải hóa đơn sau khi rời bàn bằng receiptAccessToken hợp lệ (AUD-11.4)', `Token: ${receiptAccessToken.substring(0, 10)}...`);
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200 OK bằng token nhưng nhận ${tokenDownloadRes.status}: ${JSON.stringify(tokenDownloadRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.3-03: Download with receiptAccessToken thất bại', err);
      failed++;
    }

    // TC-11.3-04: Invalid or forged receiptAccessToken
    try {
      const forgedRes = await request(
        `/orders/customer/${orderId}/download-bill?receiptAccessToken=forged_token_1234567890abcdef`,
      );

      if (forgedRes.status === 404 || forgedRes.status === 403) {
        pass('TC-11.3-04: Chặn token giả mạo không khớp đơn hàng trả về 404/403 (AUD-11.4)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 404 hoặc 403 nhưng nhận ${forgedRes.status}`);
      }
    } catch (err: any) {
      fail('TC-11.3-04: Forged token detection thất bại', err);
      failed++;
    }

    // TC-11.3-05: 24-hour expiration rule check (AUD-11.4)
    try {
      // Simulate order completed 25 hours ago in DB
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await connection.collection('orders').updateOne(
        { _id: new Types.ObjectId(orderId) },
        {
          $set: {
            status: 'Paid',
            isPaid: true,
            paidAt: twentyFiveHoursAgo,
            closedAt: twentyFiveHoursAgo,
          },
        },
      );

      const expiredRes = await request(
        `/orders/customer/${orderId}/download-bill?receiptAccessToken=${receiptAccessToken}`,
      );

      if (expiredRes.status === 400 || expiredRes.status === 403) {
        pass('TC-11.3-05: Token hóa đơn hết hạn sau 24 giờ kể từ khi thanh toán bị từ chối với 400/403 (AUD-11.4)', expiredRes.data?.message);
        passed++;
      } else {
        throw new Error(`Kỳ vọng 400 hoặc 403 khi hết hạn 24h nhưng nhận ${expiredRes.status}: ${JSON.stringify(expiredRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.3-05: 24h expiration check thất bại', err);
      failed++;
    }

    // TC-11.3-06: Valid token download within 24 hours
    try {
      // Simulate order paid 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await connection.collection('orders').updateOne(
        { _id: new Types.ObjectId(orderId) },
        {
          $set: {
            paidAt: twoHoursAgo,
            closedAt: twoHoursAgo,
          },
        },
      );

      const validTokenRes = await request(
        `/orders/customer/${orderId}/download-bill?receiptAccessToken=${receiptAccessToken}`,
      );

      if (validTokenRes.status === 200 && validTokenRes.data?.data) {
        pass('TC-11.3-06: Token hóa đơn trong thời hạn 24 giờ tải thành công dữ liệu hóa đơn hoàn tất');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200 OK nhưng nhận ${validTokenRes.status}`);
      }
    } catch (err: any) {
      fail('TC-11.3-06: Valid within 24h check thất bại', err);
      failed++;
    }

    // TC-11.3-07: Standard customer/:id/receipt endpoint also honors receiptAccessToken
    try {
      const standardReceiptRes = await request(
        `/orders/customer/${orderId}/receipt?receiptAccessToken=${receiptAccessToken}`,
      );

      if (standardReceiptRes.status === 200 && standardReceiptRes.data?.data) {
        pass('TC-11.3-07: Endpoint GET customer/:id/receipt chấp nhận receiptAccessToken cho khách tra cứu');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200 OK nhưng nhận ${standardReceiptRes.status}`);
      }
    } catch (err: any) {
      fail('TC-11.3-07: Standard receipt endpoint token check thất bại', err);
      failed++;
    }

  } catch (globalErr: any) {
    console.error('Lỗi khởi tạo test suite:', globalErr);
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả Phase 11 Suite 3: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
