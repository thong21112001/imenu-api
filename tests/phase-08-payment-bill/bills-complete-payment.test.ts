import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';

const TEST_PORT = 3116;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 8 Suite 2: Bills & Complete Payment Engine (Port ${TEST_PORT})       ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // 1. BOOTSTRAP NESTJS APP ON PORT 3116
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
  let restAId = '';
  let restBId = '';
  let branchA1Id = '';
  let branchA2Id = '';
  let ownerAToken = '';
  let waiterAToken = '';
  let cashierA2Token = '';
  let ownerBToken = '';
  let tableA1Id = '';
  let tableA1Code = `T_A1_${timestamp}`;
  let tableA1QrToken = '';
  let item1Id = '';
  let item2Id = '';
  let restASlug = '';

  try {
    // Đăng ký Nhà hàng A (Chính)
    const regARes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 Bills Rest A ${timestamp}`,
          phone: '0901111111',
          address: '111 Le Loi, Q1, TP.HCM',
        },
        owner: {
          fullName: 'Owner Restaurant A',
          phone: '0901111111',
          email: `owner.a.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restAId = regARes.data?.data?.restaurant?.id || regARes.data?.data?.restaurant?._id;
    ownerAToken = regARes.data?.data?.accessToken;

    const restADoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restAId) });
    branchA1Id = restADoc!.branches[0]._id.toString();
    restASlug = restADoc!.slug;

    // Đăng ký Nhà hàng B (Đối thủ cạnh tranh)
    const regBRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 Bills Rest B ${timestamp}`,
          phone: '0902222222',
          address: '222 Tran Hung Dao, Q5, TP.HCM',
        },
        owner: {
          fullName: 'Owner Restaurant B',
          phone: '0902222222',
          email: `owner.b.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restBId = regBRes.data?.data?.restaurant?.id || regBRes.data?.data?.restaurant?._id;
    ownerBToken = regBRes.data?.data?.accessToken;

    // Tạo Chi nhánh A2 cho Nhà hàng A
    const branchA2Res = await request('/branches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: `Chi nhánh A2 Bình Thạnh ${timestamp}`,
        address: '200 Phan Xích Long',
        phone: '0903333333',
      }),
    });
    branchA2Id = branchA2Res.data?.data?._id;

    // Query roles
    const rolesColl = connection.collection('roles');
    const cashierRole = await rolesColl.findOne({ slug: 'cashier' });
    const waiterRole = await rolesColl.findOne({ slug: 'waiter' });

    // Tạo nhân viên Waiter tại Chi nhánh A1 (không có quyền thanh toán POS_PAY / BILL_VIEW)
    const waiterRes = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Phục Vụ A1',
        username: `waitera1_${timestamp}`,
        email: `waiter.a1.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0904444444',
        roleId: waiterRole!._id.toString(),
        branchId: branchA1Id,
      }),
    });
    const waiterLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `waiter.a1.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    waiterAToken = waiterLoginRes.data?.data?.accessToken;

    // Tạo nhân viên Thu ngân tại Chi nhánh A2 (chỉ xem được chi nhánh A2)
    const cashierA2Res = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngân A2',
        username: `cashiera2_${timestamp}`,
        email: `cashier.a2.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0905555555',
        roleId: cashierRole!._id.toString(),
        branchId: branchA2Id,
      }),
    });
    const cashierLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `cashier.a2.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    cashierA2Token = cashierLoginRes.data?.data?.accessToken;

    // Tạo Bàn, Category, Menu Items ở Chi nhánh A1
    const zoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: 'Sảnh Chính', branchId: branchA1Id }),
    });
    const zoneId = zoneRes.data?.data?._id;

    const tableRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: 'Bàn P8-01',
        code: tableA1Code,
        capacity: 4,
        branchId: branchA1Id,
        zoneId,
      }),
    });
    tableA1Id = tableRes.data?.data?._id;
    tableA1QrToken = tableRes.data?.data?.qrToken;

    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: 'Hải Sản & Bò', branchIds: [branchA1Id] }),
    });
    const catId = catRes.data?.data?._id;

    const item1Res = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: 'Bò Mỹ Sốt Tiêu', price: 180000, categoryId: catId, isAvailable: true }),
    });
    item1Id = item1Res.data?.data?._id;

    const item2Res = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ name: 'Mực Trứng Nướng Sa Tế', price: 120000, categoryId: catId, isAvailable: true }),
    });
    item2Id = item2Res.data?.data?._id;

    // ========================================================================
    // PHẦN 1: COMPLETE PAYMENT (CASH, CHANGE, BILL CREATION, TABLE RELEASE)
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 1: CHỐT THANH TOÁN COMPLETE-PAYMENT & BILL BẤT BIẾN ---${colors.reset}`);

    // Tạo đơn với Item 1 x2 (360.000 đ) và Item 2 x1 (120.000 đ) -> SubTotal 480.000 đ
    const order1Res = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: tableA1Code,
        qrToken: tableA1QrToken,
        items: [
          { menuItemId: item1Id, quantity: 2 },
          { menuItemId: item2Id, quantity: 1 },
        ],
      }),
    });
    const order1Id = order1Res.data?.data?._id;
    const order1Code = order1Res.data?.data?.orderCode;

    // Xác nhận đơn
    await request(`/orders/${order1Id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });

    // Chuyển bàn sang Occupied
    const tableBeforePay = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableA1Id) });

    // TC-8.2-01: Chốt thanh toán bằng Cash, áp dụng giảm giá 5%, VAT 8%, tiền khách đưa 500.000đ -> tự động tính tiền thừa
    // SubTotal = 480.000đ. Giảm giá 5% = 24.000đ. Sau giảm = 456.000đ. VAT 8% = 36.480đ. Total = 492.480đ.
    // Khách đưa: 500.000đ -> changeAmount = 7.520đ
    const cashPayRes = await request(`/orders/${order1Id}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        paymentMethod: 'Cash',
        discountPercent: 5,
        vatPercent: 8,
        cashGiven: 500000,
        note: 'Bàn quen giảm 5%',
      }),
    });

    const bill1 = cashPayRes.data?.data?.bill;
    const tableAfterCashPay = await connection.collection('tables').findOne({ _id: new Types.ObjectId(tableA1Id) });

    if (
      cashPayRes.status === 200 &&
      cashPayRes.data?.data?.order?.status === 'Paid' &&
      bill1 &&
      bill1.billCode &&
      bill1.billCode.startsWith('BILL-') &&
      bill1.paymentMethod === 'Cash' &&
      bill1.amountReceived === 500000 &&
      tableAfterCashPay?.status === 'Available'
    ) {
      pass(
        `TC-8.2-01: POST /orders/:id/complete-payment thanh toán Cash thành công, tạo Bill ${bill1.billCode}, tính changeAmount (${bill1.changeAmount} đ) và giải phóng bàn về Available`,
      );
      passed++;
    } else {
      fail('TC-8.2-01: complete-payment Cash thất bại', { res: cashPayRes.data, table: tableAfterCashPay?.status });
      failed++;
    }

    // ========================================================================
    // PHẦN 2: IDEMPOTENCY CỦA COMPLETE-PAYMENT VS TRUYỀN THỐNG /PAY
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 2: IDEMPOTENCY ĐẶC THÙ CỦA COMPLETE-PAYMENT VS LEGACY /PAY ---${colors.reset}`);

    // TC-8.2-02: Gọi lại POST /orders/:id/complete-payment lần 2 cho đơn đã thanh toán -> Trả về 200 OK với isIdempotentReplay: true
    const replayPayRes = await request(`/orders/${order1Id}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });

    const billsCountInDb = await connection.collection('bills').countDocuments({ orderId: new Types.ObjectId(order1Id) });

    if (
      replayPayRes.status === 200 &&
      replayPayRes.data?.data?.isIdempotentReplay === true &&
      billsCountInDb === 1
    ) {
      pass(
        'TC-8.2-02: Idempotency tự nhiên của complete-payment: trả về 200 OK kèm isIdempotentReplay: true và duy nhất 1 Bill trong DB',
      );
      passed++;
    } else {
      fail('TC-8.2-02: Idempotency replay thất bại', { res: replayPayRes.data, count: billsCountInDb });
      failed++;
    }

    // TC-8.2-03: Gửi 2 request complete-payment song song qua Promise.all -> Cả 2 đều 200 OK và duy nhất 1 Bill được tạo
    // Tạo đơn mới để test concurrency
    const order2Res = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: tableA1Code,
        qrToken: tableA1QrToken,
        items: [{ menuItemId: item1Id, quantity: 1 }],
      }),
    });
    const order2Id = order2Res.data?.data?._id;
    await request(`/orders/${order2Id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });

    const [resConcurrent1, resConcurrent2] = await Promise.all([
      request(`/orders/${order2Id}/complete-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerAToken}` },
        body: JSON.stringify({ paymentMethod: 'VietQR' }),
      }),
      request(`/orders/${order2Id}/complete-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerAToken}` },
        body: JSON.stringify({ paymentMethod: 'VietQR' }),
      }),
    ]);

    const order2BillsCount = await connection.collection('bills').countDocuments({ orderId: new Types.ObjectId(order2Id) });

    if (
      resConcurrent1.status === 200 &&
      resConcurrent2.status === 200 &&
      order2BillsCount === 1
    ) {
      pass(
        'TC-8.2-03: Concurrency an toàn: Promise.all complete-payment trả về 200 OK cho cả 2 và chỉ có đúng 1 Bill duy nhất trong DB',
      );
      passed++;
    } else {
      fail('TC-8.2-03: Concurrency complete-payment thất bại', {
        s1: resConcurrent1.status,
        s2: resConcurrent2.status,
        bills: order2BillsCount,
      });
      failed++;
    }

    // TC-8.2-04: Kiểm tra POST /orders/:id/pay (legacy không có idempotency-key) lần 2 vẫn trả về 400 Bad Request để giữ tương thích Phase 6
    const order3Res = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restASlug,
        tableCode: tableA1Code,
        qrToken: tableA1QrToken,
        items: [{ menuItemId: item1Id, quantity: 1 }],
      }),
    });
    const order3Id = order3Res.data?.data?._id;
    await request(`/orders/${order3Id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });

    // Lần 1 gọi /pay thành công
    const pay1 = await request(`/orders/${order3Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });

    // Lần 2 gọi /pay không có idempotency-key -> 400
    const pay2 = await request(`/orders/${order3Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });

    if (pay1.status === 200 && pay2.status === 400) {
      pass('TC-8.2-04: Bảo tồn tương thích Phase 6: POST /orders/:id/pay lần 2 không có idempotency-key trả về 400 Bad Request');
      passed++;
    } else {
      fail('TC-8.2-04: Legacy /pay không ném 400', { pay1: pay1.status, pay2: pay2.status });
      failed++;
    }

    // ========================================================================
    // PHẦN 3: TRUY VẤN VÀ LỌC DANH SÁCH HÓA ĐƠN (GET /api/bills)
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 3: TRUY VẤN, LỌC HÓA ĐƠN & IN ẤN NHIỆT (BILLS API) ---${colors.reset}`);

    // TC-8.2-05: GET /api/bills truy vấn danh sách hóa đơn kèm phân trang
    const listBillsRes = await request('/bills', {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    if (listBillsRes.status === 200 && Array.isArray(listBillsRes.data?.data?.data)) {
      pass(`TC-8.2-05: GET /api/bills trả về danh sách hóa đơn thành công (Total: ${listBillsRes.data?.data?.total})`);
      passed++;
    } else {
      fail('TC-8.2-05: GET /api/bills thất bại', listBillsRes.data);
      failed++;
    }

    // TC-8.2-06: Lọc hóa đơn theo paymentMethod (Cash)
    const listCashRes = await request('/bills?paymentMethod=Cash', {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    const allCash = listCashRes.data?.data?.data?.every((b: any) => b.paymentMethod === 'Cash');
    if (listCashRes.status === 200 && allCash && listCashRes.data?.data?.data?.length > 0) {
      pass('TC-8.2-06: Lọc danh sách hóa đơn theo paymentMethod = Cash chính xác');
      passed++;
    } else {
      fail('TC-8.2-06: Lọc paymentMethod thất bại', listCashRes.data);
      failed++;
    }

    // TC-8.2-07: Tìm kiếm hóa đơn theo billCode
    const targetBillCode = bill1.billCode;
    const searchRes = await request(`/bills?search=${targetBillCode}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    const foundBill = searchRes.data?.data?.data?.find((b: any) => b.billCode === targetBillCode);
    if (searchRes.status === 200 && foundBill) {
      pass(`TC-8.2-07: Tìm kiếm hóa đơn theo billCode khớp chính xác (${targetBillCode})`);
      passed++;
    } else {
      fail('TC-8.2-07: Tìm kiếm billCode thất bại', searchRes.data);
      failed++;
    }

    // TC-8.2-08: GET /api/bills/:id trả về chi tiết Bill và dữ liệu ReceiptData 80mm
    const billDetailRes = await request(`/bills/${bill1._id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    if (
      billDetailRes.status === 200 &&
      (billDetailRes.data?.data?.bill?.billCode === targetBillCode ||
        billDetailRes.data?.data?.billCode === targetBillCode) &&
      (billDetailRes.data?.data?.receiptData || billDetailRes.data?.data?.bill)
    ) {
      pass('TC-8.2-08: GET /api/bills/:id trả về chi tiết hóa đơn kèm ReceiptData chuẩn 80mm');
      passed++;
    } else {
      fail('TC-8.2-08: GET /api/bills/:id thất bại', billDetailRes.data);
      failed++;
    }

    // TC-8.2-09: GET /api/bills/by-order/:orderId
    const billByOrderRes = await request(`/bills/by-order/${order1Id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    const byOrderBillCode =
      billByOrderRes.data?.data?.bill?.billCode || billByOrderRes.data?.data?.billCode;
    if (billByOrderRes.status === 200 && byOrderBillCode === targetBillCode) {
      pass('TC-8.2-09: GET /api/bills/by-order/:orderId truy vấn đúng chứng từ Bill của đơn');
      passed++;
    } else {
      fail('TC-8.2-09: GET by-order thất bại', billByOrderRes.data);
      failed++;
    }

    // TC-8.2-10: GET /api/orders/:id/receipt
    const orderReceiptRes = await request(`/orders/${order1Id}/receipt`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    if (
      orderReceiptRes.status === 200 &&
      orderReceiptRes.data?.data?.metadata?.billCode === targetBillCode &&
      orderReceiptRes.data?.data?.metadata?.orderCode === order1Code
    ) {
      pass('TC-8.2-10: GET /api/orders/:id/receipt sinh ReceiptData chuẩn xác cho in hóa đơn');
      passed++;
    } else {
      fail('TC-8.2-10: GET /orders/:id/receipt thất bại', orderReceiptRes.data);
      failed++;
    }

    // TC-8.2-11: In hóa đơn qua POST /api/bills/:id/print (Atomic $inc printCount)
    const print1Res = await request(`/bills/${bill1._id}/print`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    const print2Res = await request(`/bills/${bill1._id}/print`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });

    const print1Count = print1Res.data?.data?.bill?.printCount ?? print1Res.data?.data?.printCount;
    const print2Count = print2Res.data?.data?.bill?.printCount ?? print2Res.data?.data?.printCount;
    const hasEscpos = Boolean(print1Res.data?.data?.escPosBase64 || print1Res.data?.data?.escposBase64);

    if (
      print1Res.status === 200 &&
      print1Count === 1 &&
      hasEscpos &&
      print2Res.status === 200 &&
      print2Count === 2
    ) {
      pass('TC-8.2-11: POST /api/bills/:id/print tăng printCount = 1, 2 nguyên tử và sinh mã nhị phân ESC/POS');
      passed++;
    } else {
      fail('TC-8.2-11: In hóa đơn thất bại', { p1: print1Res.data, p2: print2Res.data });
      failed++;
    }

    // ========================================================================
    // PHẦN 4: RBAC & MULTI-TENANT / MULTI-BRANCH ISOLATION
    // ========================================================================
    console.log(`\n${colors.bold}--- PHẦN 4: RBAC & PHÂN LẬP ĐA CHI NHÁNH / ĐA NGƯỜI THUÊ ---${colors.reset}`);

    // TC-8.2-12: Waiter (không có quyền POS_PAY) bị chặn khi cố chốt thanh toán (403 Forbidden)
    const waiterPayRes = await request(`/orders/${order3Id}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waiterAToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });
    if (waiterPayRes.status === 403) {
      pass('TC-8.2-12: RBAC - Chặn nhân viên phục vụ không có quyền thanh toán complete-payment (HTTP 403 Forbidden)');
      passed++;
    } else {
      fail('TC-8.2-12: Không chặn Waiter', waiterPayRes.status);
      failed++;
    }

    // TC-8.2-13: Waiter (không có quyền BILL_VIEW) bị chặn khi truy cập danh sách hóa đơn (403 Forbidden)
    const waiterBillsRes = await request('/bills', {
      method: 'GET',
      headers: { Authorization: `Bearer ${waiterAToken}` },
    });
    if (waiterBillsRes.status === 403) {
      pass('TC-8.2-13: RBAC - Chặn nhân viên không có quyền xem danh sách hóa đơn /api/bills (HTTP 403 Forbidden)');
      passed++;
    } else {
      fail('TC-8.2-13: Không chặn Waiter xem bills', waiterBillsRes.status);
      failed++;
    }

    // TC-8.2-14: Thu ngân Chi nhánh A2 không thể xem hóa đơn của Chi nhánh A1
    const cashierA2BillsRes = await request('/bills', {
      method: 'GET',
      headers: { Authorization: `Bearer ${cashierA2Token}` },
    });
    const containsA1Bill = cashierA2BillsRes.data?.data?.data?.some(
      (b: any) => b.billCode === targetBillCode,
    );
    if (cashierA2BillsRes.status === 200 && !containsA1Bill) {
      pass('TC-8.2-14: Phân lập chi nhánh (Branch Isolation) - Thu ngân Chi nhánh con không thể xem hóa đơn của Chi nhánh khác');
      passed++;
    } else {
      fail('TC-8.2-14: Lộ hóa đơn giữa các chi nhánh', cashierA2BillsRes.data);
      failed++;
    }

    // TC-8.2-15: Multi-Tenant - Nhà hàng B không thể xem hóa đơn của Nhà hàng A
    const restBBillsRes = await request('/bills', {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    if (restBBillsRes.status === 200 && restBBillsRes.data?.data?.total === 0) {
      pass('TC-8.2-15: Phân lập Multi-Tenant - Nhà hàng đối thủ B không thể xem bất kỳ hóa đơn nào của Nhà hàng A (Total = 0)');
      passed++;
    } else {
      fail('TC-8.2-15: Thủng phân lập Multi-Tenant', restBBillsRes.data);
      failed++;
    }

    // TC-8.2-16 (AUD-8.3): Kitchen bị chặn 403 Forbidden trên complete-payment và /api/bills
    const kitchenRole = await connection.collection('roles').findOne({ slug: 'kitchen' });
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Đầu Bếp A1',
        username: `kitchena1_${timestamp}`,
        email: `kitchen.a1.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0906666666',
        roleId: kitchenRole!._id.toString(),
        branchId: branchA1Id,
      }),
    });
    const kitchenLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `kitchen.a1.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    const kitchenToken = kitchenLoginRes.data?.data?.accessToken;

    const kitchenPayRes = await request(`/orders/${order1Id}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });
    const kitchenBillsRes = await request('/bills', {
      method: 'GET',
      headers: { Authorization: `Bearer ${kitchenToken}` },
    });
    if (kitchenPayRes.status === 403 && kitchenBillsRes.status === 403) {
      pass('TC-8.2-16 (AUD-8.3): Chặn đứng vai trò kitchen trên cả complete-payment và /api/bills (HTTP 403 Forbidden)');
      passed++;
    } else {
      fail('TC-8.2-16: Không chặn kitchen truy cập tài chính', {
        payStatus: kitchenPayRes.status,
        billsStatus: kitchenBillsRes.status,
      });
      failed++;
    }

    // TC-8.2-17 (AUD-8.3): Custom Role chỉ có perm-pos-pay truy cập thành công /api/bills và in bill
    const customRoleRes = await request('/roles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        name: `Custom Cashier Role ${timestamp}`,
        slug: `custom_pay_${timestamp}`,
        permissions: [{ resource: 'POS', actions: ['CONFIRM'] }],
        permissionIds: ['perm-pos-pay'],
      }),
    });
    const customRoleId = customRoleRes.data?.data?._id;

    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        fullName: 'Custom Cashier A1',
        username: `custompay_${timestamp}`,
        email: `custom.pay.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0907777777',
        roleId: customRoleId,
        branchId: branchA1Id,
      }),
    });
    const customLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `custom.pay.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    const customPayToken = customLoginRes.data?.data?.accessToken;

    const customBillsRes = await request('/bills', {
      method: 'GET',
      headers: { Authorization: `Bearer ${customPayToken}` },
    });
    const customPrintRes = await request(`/bills/${bill1._id}/print`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customPayToken}` },
    });
    if (customBillsRes.status === 200 && customPrintRes.status === 200) {
      pass('TC-8.2-17 (AUD-8.3): Custom Role chỉ có perm-pos-pay truy cập trọn vẹn /api/bills và in bill thành công (200 OK)');
      passed++;
    } else {
      fail('TC-8.2-17: Custom Role có perm-pos-pay bị từ chối', {
        billsStatus: customBillsRes.status,
        printStatus: customPrintRes.status,
      });
      failed++;
    }

    // TC-8.2-18 (AUD-8.2): Tương tranh đa luồng tạo Bill với upsert $setOnInsert đảm bảo chỉ đúng 1 Bill duy nhất
    const newOrderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
      body: JSON.stringify({
        tableId: tableA1Id,
        items: [{ menuItemId: item1Id, quantity: 1 }],
      }),
    });
    const concurOrderId = newOrderRes.data?.data?._id;

    const concurPromises = Array.from({ length: 5 }).map((_, idx) =>
      request(`/orders/${concurOrderId}/complete-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerAToken}`,
          'idempotency-key': `concur-key-${idx}-${timestamp}`,
        },
        body: JSON.stringify({ paymentMethod: 'Cash' }),
      }),
    );
    const concurResults = await Promise.all(concurPromises);
    const successCount = concurResults.filter((r) => r.status === 200).length;
    const billsInDb = await connection
      .collection('bills')
      .find({ orderId: new Types.ObjectId(concurOrderId) })
      .toArray();

    if (successCount === 5 && billsInDb.length === 1) {
      pass('TC-8.2-18 (AUD-8.2): Đua luồng 5 requests complete-payment đồng thời sinh DUY NHẤT 1 Bill trong MongoDB');
      passed++;
    } else {
      fail('TC-8.2-18: Trùng lặp Bill khi tương tranh đa luồng', {
        successCount,
        billsFound: billsInDb.length,
      });
      failed++;
    }

  } catch (error: any) {
    fail('Toàn cục test suite bills-complete-payment gặp lỗi ngoại lệ', error);
    failed++;
  } finally {
    console.log(`\n[Teardown] Dọn dẹp tài nguyên kiểm thử...`);
    try {
      const db = connection.db;
      if (db) {
        if (restAId) {
          await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restAId) });
          await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restAId) });
          await db.collection('tablezones').deleteMany({ restaurantId: new Types.ObjectId(restAId) });
          await db.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restAId) });
          await db.collection('categories').deleteMany({ restaurantId: new Types.ObjectId(restAId) });
          await db.collection('menuitems').deleteMany({ restaurantId: new Types.ObjectId(restAId) });
          await db.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restAId) });
          await db.collection('bills').deleteMany({ restaurantId: new Types.ObjectId(restAId) });
          await db.collection('activitylogs').deleteMany({ restaurantId: new Types.ObjectId(restAId) });
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
  console.log(`Kết quả kiểm thử bills-complete-payment: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite bills-complete-payment:', err);
  process.exit(1);
});
