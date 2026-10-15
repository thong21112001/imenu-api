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
  console.log(`${colors.bold}${colors.cyan}  Phase 8: Dual Payment Engine & Natural Idempotency Validation          ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // 1. BOOTSTRAP NESTJS APP
  app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
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
  let subBranchId = '';
  let restBId = '';
  let restaurantSlug = '';
  let ownerToken = '';
  let subBranchCashierToken = '';
  let restBOwnerToken = '';
  let menuItemId = '';

  try {
    // 2. SETUP RESTAURANT A & B
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 Dual Pay Rest A ${timestamp}`,
          phone: '0901234567',
          address: '123 Main St, Q1',
        },
        owner: {
          fullName: 'P8 Dual Owner A',
          phone: '0901234567',
          email: `p8dual.owner.a.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branchId = restDoc!.branches[0]._id.toString();
    restaurantSlug = restDoc!.slug;

    // Sub branch for Restaurant A
    subBranchId = new Types.ObjectId().toString();
    await connection.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantId) },
      {
        $push: {
          branches: {
            _id: new Types.ObjectId(subBranchId),
            name: 'Chi Nhánh Phụ Q7',
            address: '456 Nguyen Thi Thap',
            phone: '0908888999',
            isMainBranch: false,
            status: 'ACTIVE',
            isDeleted: false,
          },
        } as any,
      },
    );

    // Create Cashier for Sub Branch
    const rolesColl = connection.collection('roles');
    const cashierRole = await rolesColl.findOne({ slug: 'cashier' });
    const subCashierUser = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngan Chi Nhanh Phu',
        username: `subcashier_${timestamp}`,
        email: `subcashier.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0905555666',
        roleId: cashierRole!._id.toString(),
        branchId: subBranchId,
      }),
    });

    const subLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `subcashier.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    subBranchCashierToken = subLogin.data?.data?.accessToken;

    // Create Restaurant B
    const regBRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 Competitor B ${timestamp}`,
          phone: '0909999888',
          address: '999 Le Loi, Q1',
        },
        owner: {
          fullName: 'P8 Owner B',
          phone: '0909999888',
          email: `p8dual.owner.b.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restBId = regBRes.data?.data?.restaurant?.id || regBRes.data?.data?.restaurant?._id;
    restBOwnerToken = regBRes.data?.data?.accessToken;

    // Create Table, Category, Item in Restaurant A
    const zoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu A', branchId }),
    });
    const zoneId = zoneRes.data?.data?._id;

    const t1Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn 01',
        code: `T1_${timestamp}`,
        capacity: 4,
        branchId,
        zoneId,
      }),
    });
    const table1Id = t1Res.data?.data?._id;
    const table1QrToken = t1Res.data?.data?.qrToken;

    const t2Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn 02',
        code: `T2_${timestamp}`,
        capacity: 4,
        branchId,
        zoneId,
      }),
    });
    const table2Id = t2Res.data?.data?._id;
    const table2QrToken = t2Res.data?.data?.qrToken;

    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Món Hot', branchIds: [branchId] }),
    });
    const catId = catRes.data?.data?._id;

    const itemRes = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bò Wagyu Nướng',
        price: 120000,
        categoryId: catId,
        isAvailable: true,
      }),
    });
    menuItemId = itemRes.data?.data?._id;

    console.log(`\n${colors.bold}--- PHẦN 1: STRICT PAYMENT VIA /orders/:id/pay (PHASE 6 PRESERVATION) ---${colors.reset}`);

    // Tạo đơn 1 tại Bàn 1
    const o1Res = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode: `T1_${timestamp}`,
        qrToken: table1QrToken,
        items: [{ menuItemId, quantity: 1 }],
      }),
    });
    const order1Id = o1Res.data?.data?._id;

    // Duyệt đơn 1
    await request(`/orders/${order1Id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // TC-8.3-01: Thanh toán thành công lần 1 qua /orders/:id/pay
    const pay1Res = await request(`/orders/${order1Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash', cashGiven: 150000 }),
    });
    if (
      pay1Res.status === 200 &&
      pay1Res.data?.data?.order?.status === 'Paid' &&
      pay1Res.data?.data?.bill?.billCode &&
      pay1Res.data?.data?.changeAmount === 30000
    ) {
      pass('TC-8.3-01: POST /orders/:id/pay thanh toán thành công, lưu Bill và tính tiền thừa', `Bill: ${pay1Res.data?.data?.bill?.billCode}`);
      passed++;
    } else {
      fail('TC-8.3-01: POST /orders/:id/pay thất bại', pay1Res.data);
      failed++;
    }

    // TC-8.3-02: Gọi lại /orders/:id/pay KHÔNG có idempotency-key -> Bắt buộc ném 400 Bad Request (Bảo toàn TC-6.3-10.1)
    const repayWithoutKey = await request(`/orders/${order1Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash', cashGiven: 150000 }),
    });
    if (repayWithoutKey.status === 400) {
      pass('TC-8.3-02: POST /orders/:id/pay chặn thanh toán lại khi không có idempotency-key (HTTP 400 - Bảo toàn TC-6.3-10.1)');
      passed++;
    } else {
      fail('TC-8.3-02: POST /orders/:id/pay không ném 400', repayWithoutKey.data);
      failed++;
    }

    console.log(`\n${colors.bold}--- PHẦN 2: NATURAL IDEMPOTENCY VIA /orders/:id/complete-payment ---${colors.reset}`);

    // TC-8.3-03: Gọi /orders/:id/complete-payment trên ĐƠN ĐÃ THANH TOÁN (Order 1) KHÔNG có idempotency-key -> Trả về 200 OK với isIdempotentReplay: true
    const completeOnPaidRes = await request(`/orders/${order1Id}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });
    if (
      completeOnPaidRes.status === 200 &&
      completeOnPaidRes.data?.data?.isIdempotentReplay === true &&
      completeOnPaidRes.data?.data?.order?.status === 'Paid' &&
      completeOnPaidRes.data?.data?.bill?.billCode
    ) {
      pass('TC-8.3-03: POST /orders/:id/complete-payment trả về 200 OK tự nhiên kèm isIdempotentReplay: true mà không ném lỗi 400');
      passed++;
    } else {
      fail('TC-8.3-03: POST /orders/:id/complete-payment trên đơn đã Paid thất bại', completeOnPaidRes.data);
      failed++;
    }

    // Tạo đơn 2 tại Bàn 2
    const o2Res = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode: `T2_${timestamp}`,
        qrToken: table2QrToken,
        items: [{ menuItemId, quantity: 2 }],
      }),
    });
    const order2Id = o2Res.data?.data?._id;

    // Duyệt đơn 2
    await request(`/orders/${order2Id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // TC-8.3-04: Concurrent race trên /orders/:id/complete-payment (2 requests đồng thời bằng Promise.all)
    const [raceRes1, raceRes2] = await Promise.all([
      request(`/orders/${order2Id}/complete-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ paymentMethod: 'VietQR' }),
      }),
      request(`/orders/${order2Id}/complete-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ paymentMethod: 'VietQR' }),
      }),
    ]);

    const bothSuccess = (raceRes1.status === 200 || raceRes1.status === 201) && (raceRes2.status === 200 || raceRes2.status === 201);
    const billsCount = await connection.collection('bills').countDocuments({ orderId: new Types.ObjectId(order2Id) });
    if (bothSuccess && billsCount === 1) {
      pass('TC-8.3-04: Concurrency on complete-payment: cả 2 nhận phản hồi 200 OK thành công và duy nhất 1 Bill được tạo trong DB', `Bills in DB: ${billsCount}`);
      passed++;
    } else {
      fail('TC-8.3-04: Concurrency on complete-payment thất bại', { r1: raceRes1.status, r2: raceRes2.status, billsCount });
      failed++;
    }

    console.log(`\n${colors.bold}--- PHẦN 3: MULTI-TENANT & BRANCH ISOLATION ON COMPLETE-PAYMENT ---${colors.reset}`);

    // TC-8.3-05: Thu ngân chi nhánh phụ không được phép complete-payment trên đơn của chi nhánh chính
    const branchIsolationRes = await request(`/orders/${order1Id}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${subBranchCashierToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });
    if (branchIsolationRes.status === 403) {
      pass('TC-8.3-05: Phân lập chi nhánh (Branch Isolation) - Chặn thu ngân chi nhánh khác hoàn tất thanh toán (HTTP 403 Forbidden)');
      passed++;
    } else {
      fail('TC-8.3-05: Branch Isolation thất bại', branchIsolationRes.data);
      failed++;
    }

    // TC-8.3-06: Nhà hàng B không được phép thao tác trên đơn của Nhà hàng A
    const tenantIsolationRes = await request(`/orders/${order1Id}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${restBOwnerToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });
    if (tenantIsolationRes.status === 403 || tenantIsolationRes.status === 404) {
      pass('TC-8.3-06: Phân lập đa người thuê (Multi-Tenant) - Chặn nhà hàng đối thủ hoàn tất thanh toán (HTTP 403/404)');
      passed++;
    } else {
      fail('TC-8.3-06: Multi-Tenant Isolation thất bại', tenantIsolationRes.data);
      failed++;
    }

  } catch (error: any) {
    fail('Toàn cục test suite 03-dual-payment-idempotency gặp lỗi ngoại lệ', error);
    failed++;
  } finally {
    // TEARDOWN
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
          await db.collection('activitylogs').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
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
  console.log(`Kết quả kiểm thử 03-dual-payment-idempotency: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite 03-dual-payment-idempotency:', err);
  process.exit(1);
});
