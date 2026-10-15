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
  console.log(`${colors.bold}${colors.cyan}  Phase 8: Bill Entity Lifecycle, Multi-Branch Query & Print Execution   ${colors.reset}`);
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
  let restBId = '';
  let restaurantSlug = '';
  let ownerToken = '';
  let restBOwnerToken = '';
  let item1Id = '';
  let item2Id = '';
  let billId = '';
  let orderId = '';
  let orderCode = '';
  let billCode = '';

  try {
    // 2. SETUP RESTAURANT A & B
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 Bill Life Rest A ${timestamp}`,
          phone: '0901234567',
          address: '777 Tran Hung Dao, Q5',
        },
        owner: {
          fullName: 'P8 Bill Owner A',
          phone: '0901234567',
          email: `p8bill.owner.a.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branchId = restDoc!.branches[0]._id.toString();
    restaurantSlug = restDoc!.slug;

    // Restaurant B (for multi-tenant isolation)
    const regBRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P8 Bill Life Rest B ${timestamp}`,
          phone: '0909999888',
          address: '888 Vo Van Kiet, Q1',
        },
        owner: {
          fullName: 'P8 Bill Owner B',
          phone: '0909999888',
          email: `p8bill.owner.b.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restBId = regBRes.data?.data?.restaurant?.id || regBRes.data?.data?.restaurant?._id;
    restBOwnerToken = regBRes.data?.data?.accessToken;

    // Setup Table, Category, Menu Items in Restaurant A
    const zoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Sân Vườn', branchId }),
    });
    const zoneId = zoneRes.data?.data?._id;

    const tableRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bàn Sân Vườn 08',
        code: `SV08_${timestamp}`,
        capacity: 6,
        branchId,
        zoneId,
      }),
    });
    const tableId = tableRes.data?.data?._id;
    const qrToken = tableRes.data?.data?.qrToken;

    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Món Nướng BBQ', branchIds: [branchId] }),
    });
    const catId = catRes.data?.data?._id;

    const i1Res = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Dẻ Sườn Bò Mỹ', price: 180000, categoryId: catId, isAvailable: true }),
    });
    item1Id = i1Res.data?.data?._id;

    const i2Res = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Bạch Tuộc Sa Tế', price: 110000, categoryId: catId, isAvailable: true }),
    });
    item2Id = i2Res.data?.data?._id;

    console.log(`\n${colors.bold}--- PHẦN 1: TẠO ĐƠN, HỦY MÓN & XÁC THỰC SNAPSHOT BILL ---${colors.reset}`);

    // Tạo đơn với 2 món: Item 1 x2 (360.000 đ), Item 2 x1 (110.000 đ)
    const orderRes = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug,
        tableCode: `SV08_${timestamp}`,
        qrToken,
        items: [
          { menuItemId: item1Id, quantity: 2 },
          { menuItemId: item2Id, quantity: 1 },
        ],
      }),
    });
    orderId = orderRes.data?.data?._id;
    orderCode = orderRes.data?.data?.orderCode;

    // Duyệt đơn hàng
    const confRes = await request(`/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // Hủy món Item 2 (Bạch Tuộc)
    const itemToCancel = confRes.data?.data?.items?.find(
      (it: any) => it.menuItemId === item2Id || it.name.includes('Bạch Tuộc'),
    );
    const cancelItemRes = await request(`/orders/${orderId}/items/${itemToCancel._id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ reason: 'Hết hải sản tươi' }),
    });
    if (cancelItemRes.status === 200 && cancelItemRes.data?.data?.subTotal === 360000) {
      pass('TC-8.4-01: Hủy món thành công, subTotal đơn tự động giảm xuống 360.000 đ');
      passed++;
    } else {
      fail('TC-8.4-01: Hủy món thất bại', cancelItemRes.data);
      failed++;
    }

    // Thanh toán đơn hàng qua complete-payment (với discount 10%, VAT 8%)
    const payRes = await request(`/orders/${orderId}/complete-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        paymentMethod: 'VietQR',
        discountPercent: 10,
        vatPercent: 8,
        note: 'Khách VIP giảm 10%',
      }),
    });

    const billObj = payRes.data?.data?.bill;
    billId = billObj?._id;
    billCode = billObj?.billCode;

    // TC-8.4-02: Kiểm tra cấu trúc Bill Snapshot bất biến: loại trừ món Cancelled
    const billItems = billObj?.items || [];
    const hasCancelled = billItems.some((it: any) => it.name.includes('Bạch Tuộc'));
    if (
      payRes.status === 200 &&
      billId &&
      billCode &&
      billItems.length === 1 &&
      !hasCancelled &&
      billObj?.subTotal === 360000 &&
      billObj?.discountAmount === 36000 &&
      billObj?.taxableBase === 324000 &&
      billObj?.vatAmount === 25920 &&
      billObj?.finalAmount === 349920
    ) {
      pass('TC-8.4-02: Bill Schema tạo thành công với snapshot tài chính chuẩn xác và loại trừ hoàn toàn món Cancelled', `BillCode: ${billCode}`);
      passed++;
    } else {
      fail('TC-8.4-02: Kiểm tra Bill Snapshot thất bại', billObj);
      failed++;
    }

    // TC-8.4-03: Kiểm tra Unique Index { restaurantId: 1, orderId: 1 }
    try {
      await connection.collection('bills').insertOne({
        restaurantId: new Types.ObjectId(restaurantId),
        orderId: new Types.ObjectId(orderId),
        billCode: `BILL-TEST-DUP`,
        orderCode: 'ORD-DUP',
        tableId: new Types.ObjectId(tableId),
        tableName: 'Bàn Test',
        subTotal: 100000,
        finalAmount: 100000,
        paymentMethod: 'VietQR',
        paymentStatus: 'PAID',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      fail('TC-8.4-03: Ràng buộc Unique Index thất bại', 'Lẽ ra phải ném E11000 nhưng chèn thành công');
      failed++;
    } catch (err: any) {
      if (err.code === 11000) {
        pass('TC-8.4-03: Ràng buộc Unique Index { restaurantId: 1, orderId: 1 } chặn trùng lặp chứng từ thành công');
        passed++;
      } else {
        fail('TC-8.4-03: Lỗi không phải duplicate key', err);
        failed++;
      }
    }

    console.log(`\n${colors.bold}--- PHẦN 2: TRUY VẤN VÀ LỌC DANH SÁCH HÓA ĐƠN (GET /api/bills) ---${colors.reset}`);

    // TC-8.4-04: Lấy danh sách hóa đơn chuẩn
    const listRes = await request('/bills', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (listRes.status === 200 && listRes.data?.data?.data?.length >= 1) {
      pass('TC-8.4-04: GET /api/bills trả về danh sách hóa đơn kèm phân trang thành công', `Total: ${listRes.data?.data?.total}`);
      passed++;
    } else {
      fail('TC-8.4-04: GET /api/bills thất bại', listRes.data);
      failed++;
    }

    // TC-8.4-05: Lọc hóa đơn theo paymentMethod: VietQR
    const filterRes = await request('/bills?paymentMethod=VietQR', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const allVietQr = filterRes.data?.data?.data?.every((b: any) => b.paymentMethod === 'VietQR');
    if (filterRes.status === 200 && allVietQr && filterRes.data?.data?.data?.length >= 1) {
      pass('TC-8.4-05: Lọc hóa đơn theo paymentMethod: VietQR chính xác');
      passed++;
    } else {
      fail('TC-8.4-05: Lọc theo paymentMethod thất bại', filterRes.data);
      failed++;
    }

    // TC-8.4-06: Tìm kiếm hóa đơn theo search (mã billCode)
    const searchRes = await request(`/bills?search=${billCode}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (searchRes.status === 200 && searchRes.data?.data?.data?.[0]?.billCode === billCode) {
      pass('TC-8.4-06: Tìm kiếm hóa đơn theo billCode chính xác');
      passed++;
    } else {
      fail('TC-8.4-06: Tìm kiếm theo billCode thất bại', searchRes.data);
      failed++;
    }

    // TC-8.4-07: Phân lập Multi-Tenant: Nhà hàng B gọi /bills không thấy hóa đơn của Nhà hàng A
    const restBListRes = await request('/bills', {
      headers: { Authorization: `Bearer ${restBOwnerToken}` },
    });
    if (restBListRes.status === 200 && restBListRes.data?.data?.total === 0) {
      pass('TC-8.4-07: Phân lập Multi-Tenant: Nhà hàng B không thể xem hóa đơn của Nhà hàng A (Total = 0)');
      passed++;
    } else {
      fail('TC-8.4-07: Multi-Tenant thất bại', restBListRes.data);
      failed++;
    }

    console.log(`\n${colors.bold}--- PHẦN 3: XEM CHI TIẾT VÀ IN HÓA ĐƠN NHIỆT (POST /api/bills/:id/print) ---${colors.reset}`);

    // TC-8.4-08: Xem chi tiết theo Bill ID
    const billDetailRes = await request(`/bills/${billId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (
      billDetailRes.status === 200 &&
      billDetailRes.data?.data?.bill?._id === billId &&
      billDetailRes.data?.data?.receiptData?.metadata?.billCode === billCode
    ) {
      pass('TC-8.4-08: GET /api/bills/:id trả về chi tiết Bill và ReceiptData 80mm ESC/POS hoàn chỉnh');
      passed++;
    } else {
      fail('TC-8.4-08: GET /api/bills/:id thất bại', billDetailRes.data);
      failed++;
    }

    // TC-8.4-09: Xem chi tiết theo Order ID
    const billByOrderRes = await request(`/bills/by-order/${orderId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (billByOrderRes.status === 200 && billByOrderRes.data?.data?.bill?._id === billId) {
      pass('TC-8.4-09: GET /api/bills/by-order/:orderId truy vấn đúng chứng từ hóa đơn theo đơn hàng');
      passed++;
    } else {
      fail('TC-8.4-09: GET /api/bills/by-order/:orderId thất bại', billByOrderRes.data);
      failed++;
    }

    // TC-8.4-10: In hóa đơn lần 1: printCount tăng lên 1, trả về mã lệnh nhị phân Base64
    const print1Res = await request(`/bills/${billId}/print`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (
      print1Res.status === 200 &&
      print1Res.data?.data?.bill?.printCount === 1 &&
      print1Res.data?.data?.escPosBase64 &&
      print1Res.data?.data?.bill?.lastPrintedAt
    ) {
      pass('TC-8.4-10: POST /api/bills/:id/print lần 1 tăng printCount = 1 và sinh mã Base64 ESC/POS chuẩn');
      passed++;
    } else {
      fail('TC-8.4-10: In hóa đơn lần 1 thất bại', print1Res.data);
      failed++;
    }

    // TC-8.4-11: In lại lần 2: printCount tăng lên 2 nguyên tử
    const print2Res = await request(`/bills/${billId}/print`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (print2Res.status === 200 && print2Res.data?.data?.bill?.printCount === 2) {
      pass('TC-8.4-11: In lại lần 2 tăng printCount = 2 nguyên tử (Atomic $inc)');
      passed++;
    } else {
      fail('TC-8.4-11: In hóa đơn lần 2 thất bại', print2Res.data);
      failed++;
    }

  } catch (error: any) {
    fail('Toàn cục test suite 04-bill-lifecycle gặp lỗi ngoại lệ', error);
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
  console.log(`Kết quả kiểm thử 04-bill-lifecycle: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite 04-bill-lifecycle:', err);
  process.exit(1);
});
