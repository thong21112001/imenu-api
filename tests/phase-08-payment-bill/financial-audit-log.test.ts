import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';

const TEST_PORT = 3117;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 8 Suite 3: Financial Audit Log System (Port ${TEST_PORT})            ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // 1. BOOTSTRAP NESTJS APP ON PORT 3117
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
  let restBId = '';
  let branchId = '';
  let restaurantSlug = '';
  let ownerToken = '';
  let ownerBToken = '';
  let menuItemId = '';
  let tableQrToken = '';

  try {
    // 2. REGISTER RESTAURANT A & OWNER A
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 Audit Rest A ${timestamp}`,
          phone: '0901234567',
          address: '555 Le Duan, Q1',
        },
        owner: {
          fullName: 'P8 Audit Owner',
          phone: '0901234567',
          email: `p8audit.owner.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branchId = restDoc!.branches[0]._id.toString();
    restaurantSlug = restDoc!.slug;

    // Register Restaurant B (Competitor for Multi-Tenant Audit Isolation)
    const regBRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 Audit Rest B ${timestamp}`,
          phone: '0907777777',
          address: '777 Vo Thi Sau, Q3',
        },
        owner: {
          fullName: 'P8 Audit Owner B',
          phone: '0907777777',
          email: `p8audit.ownerb.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restBId = regBRes.data?.data?.restaurant?.id || regBRes.data?.data?.restaurant?._id;
    ownerBToken = regBRes.data?.data?.accessToken;

    // Set initial bank on restaurant
    await connection.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantId) },
      {
        $set: {
          bankAccount: {
            bankId: '970422',
            bankName: 'MBBank',
            accountNo: '0901234567',
            accountName: 'P8 AUDIT REST',
            template: 'compact2',
          },
        },
      },
    );

    // Create Zone, Table, Category, Menu Item
    const zoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Sảnh Chính', branchId }),
    });
    const zoneId = zoneRes.data?.data?._id;

    const tableRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn A1',
        code: `A1_${timestamp}`,
        capacity: 4,
        branchId,
        zoneId,
      }),
    });
    tableQrToken = tableRes.data?.data?.qrToken;

    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Đồ Ăn', branchIds: [branchId] }),
    });
    const catId = catRes.data?.data?._id;

    const itemRes = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Lẩu Thái Hải Sản',
        price: 250000,
        categoryId: catId,
        isAvailable: true,
      }),
    });
    menuItemId = itemRes.data?.data?._id;

    console.log(`\n${colors.bold}--- PHẦN 1: AUDIT EVENT - PAYMENT_COMPLETED ---${colors.reset}`);

    // Tạo đơn và thanh toán
    const ordRes = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode: `A1_${timestamp}`,
        qrToken: tableQrToken,
        items: [{ menuItemId, quantity: 1 }],
      }),
    });
    const orderId = ordRes.data?.data?._id;
    const orderCode = ordRes.data?.data?.orderCode;

    await request(`/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    const payRes = await request(`/orders/${orderId}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'VietQR' }),
    });
    const billCode = payRes.data?.data?.bill?.billCode;

    // Chờ 300ms để event emitter ghi DB
    await new Promise((r) => setTimeout(r, 300));

    // TC-8.3-01: Kiểm tra Activity Log PAYMENT_COMPLETED
    const payLog = await connection.collection('activity_logs').findOne({
      restaurantId: new Types.ObjectId(restaurantId),
      action: 'pay',
      module: 'order',
    });

    if (
      payLog &&
      payLog.newData?.orderCode === orderCode &&
      payLog.newData?.billCode === billCode &&
      payLog.newData?.totalAmount === 250000 &&
      payLog.newData?.paymentMethod === 'VietQR'
    ) {
      pass('TC-8.3-01: Ghi nhận Audit Log PAYMENT_COMPLETED với đầy đủ orderCode, billCode, tổng tiền và phương thức');
      passed++;
    } else {
      fail('TC-8.3-01: Audit Log PAYMENT_COMPLETED thất bại', payLog);
      failed++;
    }

    console.log(`\n${colors.bold}--- PHẦN 2: AUDIT EVENT - ORDER_CANCELLED (ORDER & ITEM) ---${colors.reset}`);

    // Tạo đơn 2 với 2 món
    const ord2Res = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode: `A1_${timestamp}`,
        qrToken: tableQrToken,
        items: [
          { menuItemId, quantity: 2 },
          { menuItemId, quantity: 1 },
        ],
      }),
    });
    const order2Id = ord2Res.data?.data?._id;
    const order2Code = ord2Res.data?.data?.orderCode;

    await request(`/orders/${order2Id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // 1. Hủy 1 món trong đơn
    const itemToCancel = ord2Res.data?.data?.items?.[1];
    await request(`/orders/${order2Id}/items/${itemToCancel._id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Khách đổi món khác' }),
    });

    await new Promise((r) => setTimeout(r, 300));

    // TC-8.3-02: Kiểm tra Activity Log cancel item
    const cancelItemLog = await connection.collection('activity_logs').findOne({
      restaurantId: new Types.ObjectId(restaurantId),
      action: 'cancel',
      module: 'order',
      'metadata.itemId': itemToCancel._id.toString(),
    });

    if (
      cancelItemLog &&
      cancelItemLog.metadata?.orderCode === order2Code &&
      cancelItemLog.metadata?.lostRevenue === 250000 &&
      cancelItemLog.metadata?.reason === 'Khách đổi món khác'
    ) {
      pass('TC-8.3-02: Ghi nhận Audit Log ORDER_CANCELLED khi hủy từng món kèm lostRevenue và lý do');
      passed++;
    } else {
      fail('TC-8.3-02: Audit Log cancel item thất bại', cancelItemLog);
      failed++;
    }

    // 2. Hủy toàn bộ đơn hàng
    await request(`/orders/${order2Id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Khách có việc gấp về sớm' }),
    });

    await new Promise((r) => setTimeout(r, 300));

    // TC-8.3-03: Kiểm tra Activity Log cancel order
    const cancelOrderLog = await connection.collection('activity_logs').findOne({
      restaurantId: new Types.ObjectId(restaurantId),
      action: 'cancel',
      module: 'order',
      'metadata.newSubTotal': 0,
    });

    if (
      cancelOrderLog &&
      cancelOrderLog.metadata?.orderCode === order2Code &&
      cancelOrderLog.metadata?.reason === 'Khách có việc gấp về sớm'
    ) {
      pass('TC-8.3-03: Ghi nhận Audit Log ORDER_CANCELLED khi hủy toàn bộ đơn hàng');
      passed++;
    } else {
      fail('TC-8.3-03: Audit Log cancel order thất bại', cancelOrderLog);
      failed++;
    }

    console.log(`\n${colors.bold}--- PHẦN 3: AUDIT EVENT - MENU_PRICE_CHANGED ---${colors.reset}`);

    // Cập nhật giá món ăn từ 250.000 đ lên 280.000 đ qua PUT /menu-items/:id
    const updatePriceRes = await request(`/menu-items/${menuItemId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ price: 280000 }),
    });

    await new Promise((r) => setTimeout(r, 300));

    // TC-8.3-04: Kiểm tra Activity Log MENU_PRICE_CHANGED
    const priceLog = await connection.collection('activity_logs').findOne({
      restaurantId: new Types.ObjectId(restaurantId),
      module: 'menu',
      action: 'update',
      target_id: menuItemId,
      'metadata.newPrice': 280000,
    });

    if (
      priceLog &&
      priceLog.metadata?.oldPrice === 250000 &&
      priceLog.metadata?.newPrice === 280000
    ) {
      pass('TC-8.3-04: Ghi nhận Audit Log MENU_PRICE_CHANGED khi giá món ăn thay đổi (250.000 đ -> 280.000 đ)');
      passed++;
    } else {
      fail('TC-8.3-04: Audit Log MENU_PRICE_CHANGED thất bại', priceLog);
      failed++;
    }

    console.log(`\n${colors.bold}--- PHẦN 4: AUDIT EVENT - BANK_ACCOUNT_CHANGED (MASKED PROTECTION) ---${colors.reset}`);

    // Cập nhật số tài khoản ngân hàng nhà hàng từ 0901234567 sang 0909998888 qua PUT /restaurants/current
    const updateBankRes = await request('/restaurants/current', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        bankAccount: {
          bankId: '970415',
          bankName: 'VietinBank',
          accountNo: '0909998888',
          accountName: 'P8 AUDIT REST NEW',
        },
      }),
    });

    await new Promise((r) => setTimeout(r, 300));

    // TC-8.3-05: Kiểm tra Activity Log BANK_ACCOUNT_CHANGED với mặt nạ ***8888
    const bankLog = await connection.collection('activity_logs').findOne({
      restaurantId: new Types.ObjectId(restaurantId),
      module: 'setting',
      action: 'update',
      'metadata.newBankId': '970415',
    });

    if (
      bankLog &&
      bankLog.metadata?.oldBankId === '970422' &&
      bankLog.metadata?.newBankId === '970415' &&
      bankLog.metadata?.oldAccountNoMasked === '***4567' &&
      bankLog.metadata?.newAccountNoMasked === '***8888'
    ) {
      pass('TC-8.3-05: Ghi nhận Audit Log BANK_ACCOUNT_CHANGED với số tài khoản được che mặt nạ an toàn (***4567 -> ***8888)');
      passed++;
    } else {
      fail('TC-8.3-05: Audit Log BANK_ACCOUNT_CHANGED thất bại', bankLog);
      failed++;
    }

    console.log(`\n${colors.bold}--- PHẦN 5: TRUY VẤN VÀ LỌC NHẬT KÝ KIỂM TOÁN (GET /api/activity-logs) ---${colors.reset}`);

    // TC-8.3-06: Lọc theo module=order & action=pay
    const queryLogsRes = await request('/activity-logs?module=order&action=pay', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (queryLogsRes.status === 200 && queryLogsRes.data?.data?.data?.length >= 1) {
      pass('TC-8.3-06: GET /api/activity-logs hỗ trợ lọc chính xác theo module và action');
      passed++;
    } else {
      fail('TC-8.3-06: GET /api/activity-logs lọc thất bại', queryLogsRes.data);
      failed++;
    }

    // TC-8.3-07: Phân lập Multi-Tenant trên Activity Logs - Nhà hàng B không xem được log của Nhà hàng A
    const restBLogsRes = await request('/activity-logs', {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    if (restBLogsRes.status === 200 && restBLogsRes.data?.data?.total === 0) {
      pass('TC-8.3-07: Phân lập Multi-Tenant: Nhà hàng B không thể xem nhật ký kiểm toán của Nhà hàng A (Total = 0)');
      passed++;
    } else {
      fail('TC-8.3-07: Thủng phân lập Multi-Tenant trên Activity Log', restBLogsRes.data);
      failed++;
    }

    // TC-8.3-08 (AUD-8.3): Waiter bị chặn 403 Forbidden khi truy cập /api/activity-logs
    const waiterRole = await connection.collection('roles').findOne({ slug: 'waiter' });
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Phục Vụ Audit Test',
        username: `waiteraudit_${timestamp}`,
        email: `waiter.audit.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0908888888',
        roleId: waiterRole!._id.toString(),
      }),
    });
    const waiterLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `waiter.audit.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    const waiterToken = waiterLoginRes.data?.data?.accessToken;
    const waiterLogsRes = await request('/activity-logs', {
      headers: { Authorization: `Bearer ${waiterToken}` },
    });
    if (waiterLogsRes.status === 403) {
      pass('TC-8.3-08 (AUD-8.3): Chặn đứng nhân viên không có quyền truy cập nhật ký kiểm toán /api/activity-logs (HTTP 403 Forbidden)');
      passed++;
    } else {
      fail('TC-8.3-08: Không chặn Waiter truy cập activity logs', waiterLogsRes.status);
      failed++;
    }

    // TC-8.3-09 (AUD-8.5): AllExceptionsFilter chặn rò rỉ mã lỗi MongoDB E11000 và chuyển hóa thành HTTP 409 Conflict
    const dupRegRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 Dup Rest ${timestamp}`,
          phone: '0901234567',
          address: '123 Nguyen Trai, Q1',
        },
        owner: {
          fullName: 'Dup Owner',
          phone: '0901234567',
          email: `p8audit.owner.${timestamp}@imenu.vn`, // Trùng email đã đăng ký
          password: 'Password@123',
        },
      }),
    });
    const isSanitized =
      dupRegRes.status === 409 &&
      typeof dupRegRes.data?.message === 'string' &&
      !JSON.stringify(dupRegRes.data).includes('E11000') &&
      !JSON.stringify(dupRegRes.data).includes('MongoServerError');
    if (isSanitized) {
      pass('TC-8.3-09 (AUD-8.5): AllExceptionsFilter che giấu 100% chi tiết kỹ thuật MongoDB E11000 thành HTTP 409 Conflict an toàn');
      passed++;
    } else {
      fail('TC-8.3-09: Lộ thông tin nội bộ MongoDB hoặc không trả về 409', dupRegRes.data);
      failed++;
    }

  } catch (error: any) {
    fail('Toàn cục test suite financial-audit-log gặp lỗi ngoại lệ', error);
    failed++;
  } finally {
    console.log(`\n[Teardown] Dọn dẹp tài nguyên kiểm thử...`);
    try {
      const db = connection.db;
      if (db) {
        if (restaurantId) {
          await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
          await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
          await db.collection('tablezones').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
          await db.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
          await db.collection('categories').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
          await db.collection('menuitems').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
          await db.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
          await db.collection('bills').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
          await db.collection('activity_logs').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        }
        if (restBId) {
          await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restBId) });
          await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restBId) });
        }
      }
    } catch {}
    await app.close();
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử financial-audit-log: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite financial-audit-log:', err);
  process.exit(1);
});
