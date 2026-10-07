import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { UsersService } from '../../src/modules/users/users.service';
import { OrderFinancialCalculator } from '../../src/modules/orders/domain/order-financial.calculator';
import { CategoriesService } from '../../src/modules/menu/categories.service';
import { TablesService } from '../../src/modules/tables/tables.service';

const TEST_PORT = 3099;
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
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Sub-phase 6.3: POS Cashier Order Endpoints Test Suite     ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // ========================================================================
  // SECTION 1: UNIT TEST ORDER FINANCIAL CALCULATOR (XOR, TAXABLE BASE, ROUNDING)
  // ========================================================================
  console.log(`\n${colors.bold}--- PHẦN A: KIỂM TRA BỘ TÍNH TOÁN TÀI CHÍNH (ORDER FINANCIAL CALCULATOR) ---${colors.reset}`);

  // 1.1: Fixed amounts calculation
  try {
    const res = OrderFinancialCalculator.calculate({
      subTotal: 100000,
      discountAmount: 10000,
      serviceFee: 5000,
      vatAmount: 8000,
    });
    if (res.taxableBase === 90000 && res.totalAmount === 103000) {
      pass('1.1: Tính toán tài chính với số tiền cố định', 'subTotal: 100k, discount: 10k, taxableBase: 90k, fee: 5k, VAT: 8k -> total: 103k');
      passed++;
    } else {
      fail('1.1: Tính toán tài chính với số tiền cố định', JSON.stringify(res));
      failed++;
    }
  } catch (e: any) {
    fail('1.1: Tính toán tài chính với số tiền cố định', e.message);
    failed++;
  }

  // 1.2: Percentage calculation with correct taxable base order
  try {
    // subTotal = 200,000
    // discountPercent = 10% -> discount = 20,000
    // taxableBase = 180,000
    // serviceFeePercent = 5% -> fee = 180,000 * 5% = 9,000
    // vatPercent = 8% -> VAT = (180,000 + 9,000) * 8% = 189,000 * 8% = 15,120
    // totalAmount = 180,000 + 9,000 + 15,120 = 204,120
    const res = OrderFinancialCalculator.calculate({
      subTotal: 200000,
      discountPercent: 10,
      serviceFeePercent: 5,
      vatPercent: 8,
    });
    if (
      res.discountAmount === 20000 &&
      res.taxableBase === 180000 &&
      res.serviceFee === 9000 &&
      res.vatAmount === 15120 &&
      res.totalAmount === 204120
    ) {
      pass('1.2: Tính toán theo tỷ lệ phần trăm chuẩn F&B', 'Thuế & phí tính trên taxableBase, total = 204,120 đ chính xác');
      passed++;
    } else {
      fail('1.2: Tính toán theo tỷ lệ phần trăm chuẩn F&B', JSON.stringify(res));
      failed++;
    }
  } catch (e: any) {
    fail('1.2: Tính toán theo tỷ lệ phần trăm chuẩn F&B', e.message);
    failed++;
  }

  // 1.3: XOR violation: both discountAmount and discountPercent
  try {
    OrderFinancialCalculator.calculate({
      subTotal: 100000,
      discountAmount: 10000,
      discountPercent: 10,
    });
    fail('1.3: Chặn vi phạm XOR Discount', 'Lẽ ra phải ném 400 nhưng không ném');
    failed++;
  } catch (e: any) {
    pass('1.3: Chặn vi phạm XOR Discount', 'Ném BadRequestException thành công');
    passed++;
  }

  // 1.4: XOR violation: both serviceFee and serviceFeePercent
  try {
    OrderFinancialCalculator.calculate({
      subTotal: 100000,
      serviceFee: 5000,
      serviceFeePercent: 5,
    });
    fail('1.4: Chặn vi phạm XOR Service Fee', 'Lẽ ra phải ném 400 nhưng không ném');
    failed++;
  } catch (e: any) {
    pass('1.4: Chặn vi phạm XOR Service Fee', 'Ném BadRequestException thành công');
    passed++;
  }

  // 1.5: XOR violation: both vatAmount and vatPercent
  try {
    OrderFinancialCalculator.calculate({
      subTotal: 100000,
      vatAmount: 8000,
      vatPercent: 8,
    });
    fail('1.5: Chặn vi phạm XOR VAT', 'Lẽ ra phải ném 400 nhưng không ném');
    failed++;
  } catch (e: any) {
    pass('1.5: Chặn vi phạm XOR VAT', 'Ném BadRequestException thành công');
    passed++;
  }

  // 1.6: Discount exceeds subTotal
  try {
    OrderFinancialCalculator.calculate({
      subTotal: 100000,
      discountAmount: 150000,
    });
    fail('1.6: Chặn giảm giá vượt subTotal', 'Lẽ ra phải ném 400 nhưng không ném');
    failed++;
  } catch (e: any) {
    pass('1.6: Chặn giảm giá vượt subTotal', 'Ném BadRequestException thành công');
    passed++;
  }

  // 1.7: Percent out of bounds
  try {
    OrderFinancialCalculator.calculate({
      subTotal: 100000,
      vatPercent: 150,
    });
    fail('1.7: Chặn phần trăm vượt quá 100%', 'Lẽ ra phải ném 400 nhưng không ném');
    failed++;
  } catch (e: any) {
    pass('1.7: Chặn phần trăm vượt quá 100%', 'Ném BadRequestException thành công');
    passed++;
  }

  // ========================================================================
  // SECTION 2: HTTP INTEGRATION TESTS (POS CASHIER FLOWS)
  // ========================================================================
  console.log(`\n${colors.bold}--- PHẦN B: KIỂM THỬ TÍCH HỢP HTTP ENDPOINTS VỚI SERVER POS ---${colors.reset}`);
  console.log('Khởi động test server trên port', TEST_PORT, '...');
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const connection: Connection = app.get(getConnectionToken());
  const rolesService = app.get(RolesService);
  await rolesService.seedDefaultRoles();

  const usersService = app.get(UsersService);
  await usersService.initAdmin();

  const categoriesService = app.get(CategoriesService);
  const tablesService = app.get(TablesService);

  await app.listen(TEST_PORT);
  console.log('Test server đã sẵn sàng!\n');

  const timestamp = Date.now();
  let restaurantId = '';
  let branchId = '';
  let subBranchId = '';
  let restBId = '';
  let ownerToken = '';
  let cashierToken = '';
  let waiterToken = '';
  let subBranchCashierToken = '';
  let restBCashierToken = '';
  let superAdminToken = '';

  let table1Id = '';
  let table2Id = '';
  let emptyTableId = '';
  let menuItemId = '';
  let menuItem2Id = '';
  let item1Price = 50000;
  let item2BasePrice = 80000;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Tạo Nhà Hàng A, Chi Nhánh Phụ, Bàn Ăn, Thực Đơn & Tài Khoản
    // ------------------------------------------------------------------------
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng POS 6.3 ${timestamp}`,
          phone: '0901234567',
          address: '456 Đường Nguyễn Trãi, Quận 5',
        },
        owner: {
          fullName: 'Chủ Quán POS',
          phone: '0901234567',
          email: `owner.pos.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branchId = restDoc!.branches[0]._id.toString();

    // Thêm chi nhánh phụ cho Nhà Hàng A
    subBranchId = new Types.ObjectId().toString();
    await connection.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantId) },
      {
        $push: {
          branches: {
            _id: new Types.ObjectId(subBranchId),
            name: 'Chi Nhánh Quận 7',
            address: '789 Đường Nguyễn Thị Thập',
            phone: '0908888999',
            isMainBranch: false,
            status: 'ACTIVE',
            isDeleted: false,
          },
        } as any,
      },
    );

    // Tạo Nhà hàng B (Multi-Tenant Isolation)
    const regBRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng Đối Thủ B ${timestamp}`,
          phone: '0909999888',
          address: '999 Đường Lê Lợi, Quận 1',
        },
        owner: {
          fullName: 'Chủ Quán B',
          phone: '0909999888',
          email: `owner.b.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restBId = regBRes.data?.data?.restaurant?.id || regBRes.data?.data?.restaurant?._id;
    const restBToken = regBRes.data?.data?.accessToken;

    // Lấy Role IDs
    const cashierRole = await rolesService.findBySlug('cashier');
    const waiterRole = await rolesService.findBySlug('waiter');

    // Tạo Cashier Nhà hàng A
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngân Chính',
        username: `cashier_main_${timestamp}`,
        email: `cashier.main.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0902222111',
        roleId: cashierRole._id.toString(),
      }),
    });

    // Tạo Waiter Nhà hàng A
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Phục Vụ Bàn',
        username: `waiter_${timestamp}`,
        email: `waiter.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0902222222',
        roleId: waiterRole._id.toString(),
      }),
    });

    // Tạo Cashier Chi Nhánh Phụ qua API
    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Thu Ngân Chi Nhánh Phụ',
        username: `cashier_sub_${timestamp}`,
        email: `cashier.sub.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0902222333',
        roleId: cashierRole._id.toString(),
        branchId: subBranchId,
      }),
    });

    // Helper đăng nhập lấy token qua email
    const loginUser = async (email: string) => {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'Password@123' }),
      });
      return res.data?.data?.accessToken;
    };

    cashierToken = await loginUser(`cashier.main.${timestamp}@imenu.vn`);
    waiterToken = await loginUser(`waiter.${timestamp}@imenu.vn`);
    subBranchCashierToken = await loginUser(`cashier.sub.${timestamp}@imenu.vn`);

    // Đăng nhập Super Admin
    const loginSuperAdmin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@imenu.vn', password: 'SuperAdmin@2026!' }),
    });
    superAdminToken = loginSuperAdmin.data?.data?.accessToken;

    // Login Cashier Rest B
    restBCashierToken = restBToken;

    // Tạo Zone & Bàn ăn
    const zoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: 'Khu Vực Quầy POS' }),
    });
    const zoneId = zoneRes.data?.data?._id;

    const t1Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ code: `P01_${timestamp}`, name: 'Bàn POS 01', zoneId, capacity: 4 }),
    });
    table1Id = t1Res.data?.data?._id;

    const t2Res = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ code: `P02_${timestamp}`, name: 'Bàn POS 02', zoneId, capacity: 4 }),
    });
    table2Id = t2Res.data?.data?._id;

    const tEmptyRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ code: `P03_${timestamp}`, name: 'Bàn Trống POS', zoneId, capacity: 2 }),
    });
    emptyTableId = tEmptyRes.data?.data?._id;

    // Khởi tạo Thực đơn mặc định qua categoriesService
    await categoriesService.seedDefaultMenu(restaurantId);
    const getMenu = await request('/menu-items', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const menuItemsList = getMenu.data?.data?.items || getMenu.data?.data || [];
    menuItemId = menuItemsList[0]?._id || menuItemsList[0]?.id;
    menuItem2Id = menuItemsList[1]?._id || menuItemsList[1]?.id;
    item1Price = menuItemsList[0]?.price || 50000;
    item2BasePrice = menuItemsList[1]?.price || 80000;

    // ------------------------------------------------------------------------
    // TEST 1: SEAT GUESTS (Mở bàn chưa gọi món: Available -> Occupied với totalGuests)
    // ------------------------------------------------------------------------
    const seatRes = await request(`/tables/${table1Id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({ status: 'Occupied', totalGuests: 4 }),
    });

    if (
      seatRes.status === 200 &&
      seatRes.data?.data?.status === 'Occupied' &&
      seatRes.data?.data?.totalGuests === 4 &&
      !seatRes.data?.data?.currentOrderId
    ) {
      pass('TC-6.3-01: Mở bàn ghi nhận khách ngồi (Available -> Occupied, totalGuests = 4, chưa có order)');
      passed++;
    } else {
      fail('TC-6.3-01: Mở bàn ghi nhận khách ngồi', JSON.stringify(seatRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 2: POS ORDER CREATION (Factory Semantic: Round 1 Confirmed, Items Waiting, Order Preparing)
    // ------------------------------------------------------------------------
    const createOrderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        tableId: table1Id,
        orderSource: 'STAFF_POS',
        customerNote: 'Khách yêu cầu nhiều ớt',
        items: [
          { menuItemId, quantity: 2, note: 'Ít bánh' },
        ],
      }),
    });

    const order1 = createOrderRes.data?.data;
    const order1Id = order1?._id;

    if (
      createOrderRes.status === 201 &&
      order1?.status === 'Preparing' &&
      order1?.rounds[0]?.status === 'Confirmed' &&
      order1?.rounds[0]?.source === 'STAFF_POS' &&
      order1?.items[0]?.status === 'Waiting' &&
      order1?.subTotal === item1Price * 2
    ) {
      pass('TC-6.3-02: POS tạo đơn hàng (Order = Preparing, Round 1 = Confirmed, Items = Waiting, Snapshot Price = 100k)');
      passed++;
    } else {
      fail('TC-6.3-02: POS tạo đơn hàng', JSON.stringify(createOrderRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 3: CONFLICT HANDLING (Chặn tạo thêm đơn POS trên bàn đang Occupied có Active Order)
    // ------------------------------------------------------------------------
    const conflictRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        tableId: table1Id,
        orderSource: 'STAFF_POS',
        items: [{ menuItemId, quantity: 1 }],
      }),
    });

    if (conflictRes.status === 409) {
      pass('TC-6.3-03: Chống trùng đơn tại quầy POS', 'HTTP 409 Conflict thành công khi bàn đang có đơn hoạt động');
      passed++;
    } else {
      fail('TC-6.3-03: Chống trùng đơn tại quầy POS', `Mong đợi 409 nhưng nhận: ${conflictRes.status} ${JSON.stringify(conflictRes.data)}`);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 4: QUERY ACTIVE ORDER BY TABLE (GET /orders/by-table/:tableId)
    // ------------------------------------------------------------------------
    const byTableRes = await request(`/orders/by-table/${table1Id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    if (byTableRes.status === 200 && byTableRes.data?.data?._id === order1Id) {
      pass('TC-6.3-04.1: Lấy Active Order của bàn trên sơ đồ POS thành công', `Order ID: ${order1Id}`);
      passed++;
    } else {
      fail('TC-6.3-04.1: Lấy Active Order của bàn', JSON.stringify(byTableRes.data));
      failed++;
    }

    // Truy vấn bàn trống -> data: null
    const emptyTableRes = await request(`/orders/by-table/${emptyTableId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    if (emptyTableRes.status === 200 && emptyTableRes.data?.data === null) {
      pass('TC-6.3-04.2: Truy vấn bàn trống trả về data: null chính xác');
      passed++;
    } else {
      fail('TC-6.3-04.2: Truy vấn bàn trống trả về data: null', JSON.stringify(emptyTableRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 5: POS APPEND ITEMS (Gọi thêm món tạo Round 2 auto-Confirmed)
    // ------------------------------------------------------------------------
    const addItemsRes = await request(`/orders/${order1Id}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        items: [{ menuItemId: menuItem2Id, quantity: 1, note: 'Ăn thêm' }],
      }),
    });

    const order1AfterAdd = addItemsRes.data?.data;
    const expectedSubTotalAfterAdd = item1Price * 2 + item2BasePrice; // 100k + 80k = 180k
    if (
      addItemsRes.status === 200 &&
      order1AfterAdd?.rounds?.length === 2 &&
      order1AfterAdd?.rounds[1]?.status === 'Confirmed' &&
      order1AfterAdd?.subTotal === expectedSubTotalAfterAdd
    ) {
      pass('TC-6.3-05: Thu ngân gọi thêm món Round 2 (Round 2 = Confirmed, subTotal cập nhật = 180k)');
      passed++;
    } else {
      fail('TC-6.3-05: Thu ngân gọi thêm món Round 2', JSON.stringify(addItemsRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 6: BILL PREVIEW (GET /orders/:id/bill-preview)
    // ------------------------------------------------------------------------
    // 6.1: Fixed amount calculation
    const previewFixedRes = await request(
      `/orders/${order1Id}/bill-preview?discountAmount=20000&serviceFee=10000&vatAmount=15000`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${cashierToken}` },
      },
    );
    const pFixed = previewFixedRes.data?.data;
    const expFixedDiscount = 20000;
    const expFixedFee = 10000;
    const expFixedVat = 15000;
    const expFixedTaxable = expectedSubTotalAfterAdd - expFixedDiscount;
    const expFixedTotal = expFixedTaxable + expFixedFee + expFixedVat;

    if (
      previewFixedRes.status === 200 &&
      pFixed?.subTotal === expectedSubTotalAfterAdd &&
      pFixed?.discountAmount === expFixedDiscount &&
      pFixed?.taxableBase === expFixedTaxable &&
      pFixed?.serviceFee === expFixedFee &&
      pFixed?.vatAmount === expFixedVat &&
      pFixed?.totalAmount === expFixedTotal
    ) {
      pass('TC-6.3-06.1: Tạm tính hóa đơn với số tiền cố định chính xác', `Total = ${expFixedTotal.toLocaleString('vi-VN')} đ`);
      passed++;
    } else {
      fail('TC-6.3-06.1: Tạm tính hóa đơn với số tiền cố định', JSON.stringify(previewFixedRes.data));
      failed++;
    }

    // 6.2: Percentage calculation
    const previewPctRes = await request(
      `/orders/${order1Id}/bill-preview?discountPercent=10&serviceFeePercent=5&vatPercent=8`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${cashierToken}` },
      },
    );
    const pPct = previewPctRes.data?.data;
    const expPctDiscount = Math.round(expectedSubTotalAfterAdd * 0.1);
    const expPctTaxable = expectedSubTotalAfterAdd - expPctDiscount;
    const expPctFee = Math.round(expPctTaxable * 0.05);
    const expPctVat = Math.round((expPctTaxable + expPctFee) * 0.08);
    const expPctTotal = expPctTaxable + expPctFee + expPctVat;

    if (
      previewPctRes.status === 200 &&
      pPct?.discountAmount === expPctDiscount &&
      pPct?.taxableBase === expPctTaxable &&
      pPct?.serviceFee === expPctFee &&
      pPct?.vatAmount === expPctVat &&
      pPct?.totalAmount === expPctTotal
    ) {
      pass('TC-6.3-06.2: Tạm tính hóa đơn theo tỷ lệ % chuẩn F&B', `TaxableBase = ${expPctTaxable}, VAT tính trên base+fee, total = ${expPctTotal.toLocaleString('vi-VN')} đ`);
      passed++;
    } else {
      fail('TC-6.3-06.2: Tạm tính hóa đơn theo tỷ lệ %', JSON.stringify(previewPctRes.data));
      failed++;
    }

    // 6.3: XOR violation check (truyền cả amount và percent) -> 400 Bad Request
    const previewXorRes = await request(
      `/orders/${order1Id}/bill-preview?discountAmount=10000&discountPercent=10`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${cashierToken}` },
      },
    );
    if (previewXorRes.status === 400) {
      pass('TC-6.3-06.3: Chặn vi phạm XOR trong bill-preview', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('TC-6.3-06.3: Chặn vi phạm XOR trong bill-preview', `Mong đợi 400 nhưng nhận: ${previewXorRes.status}`);
      failed++;
    }

    // 6.4: Bill preview không làm thay đổi trạng thái trong DB (Pure read-only)
    const orderCheckAfterPreview = await connection.collection('orders').findOne({ _id: new Types.ObjectId(order1Id) });
    if (orderCheckAfterPreview?.status === 'Preparing' && !orderCheckAfterPreview?.isPaid) {
      pass('TC-6.3-06.4: Bill preview hoàn toàn read-only, không làm thay đổi Order trong DB');
      passed++;
    } else {
      fail('TC-6.3-06.4: Bill preview vi phạm làm bẩn dữ liệu trong DB', JSON.stringify(orderCheckAfterPreview));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 7: PAYMENT REQUEST & REVERT PAYMENT REQUEST
    // ------------------------------------------------------------------------
    // Chuyển món từ Waiting -> Cooking -> Ready -> Served theo quy trình KDS
    for (const item of order1AfterAdd.items) {
      await request(`/orders/${order1Id}/items/${item._id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ status: 'Cooking' }),
      });
      await request(`/orders/${order1Id}/items/${item._id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ status: 'Ready' }),
      });
      await request(`/orders/${order1Id}/items/${item._id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ status: 'Served' }),
      });
    }

    // 7.1: Yêu cầu thanh toán (Served -> PaymentRequested)
    const reqPayRes = await request(`/orders/${order1Id}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    if (reqPayRes.status === 200 && reqPayRes.data?.data?.status === 'PaymentRequested') {
      pass('TC-6.3-07.1: Yêu cầu thanh toán (Served -> PaymentRequested thành công)');
      passed++;
    } else {
      fail('TC-6.3-07.1: Yêu cầu thanh toán', JSON.stringify(reqPayRes.data));
      failed++;
    }

    // 7.2: Hoàn tác yêu cầu thanh toán (PaymentRequested -> Served)
    const revertPayRes = await request(`/orders/${order1Id}/revert-payment-request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    if (revertPayRes.status === 200 && revertPayRes.data?.data?.status === 'Served') {
      pass('TC-6.3-07.2: Hoàn tác yêu cầu thanh toán (PaymentRequested -> Served thành công)');
      passed++;
    } else {
      fail('TC-6.3-07.2: Hoàn tác yêu cầu thanh toán', JSON.stringify(revertPayRes.data));
      failed++;
    }

    // 7.3: Yêu cầu lại thanh toán (Served -> PaymentRequested)
    await request(`/orders/${order1Id}/request-payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    // ------------------------------------------------------------------------
    // TEST 8: CASH PAYMENT & CHANGE CALCULATION
    // ------------------------------------------------------------------------
    // 8.1: Khách đưa thiếu tiền -> 400 Bad Request
    const payShortCashRes = await request(`/orders/${order1Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        paymentMethod: 'Cash',
        amountReceived: 10000, // Total hơn 100k mà khách chỉ đưa 10k
      }),
    });
    if (payShortCashRes.status === 400) {
      pass('TC-6.3-08.1: Chặn thanh toán tiền mặt khi khách đưa thiếu tiền', 'HTTP 400 Bad Request thành công');
      passed++;
    } else {
      fail('TC-6.3-08.1: Chặn thanh toán tiền mặt khi khách đưa thiếu tiền', `Mong đợi 400 nhưng nhận: ${payShortCashRes.status}`);
      failed++;
    }

    // 8.2: Khách đưa đủ tiền -> 200 OK & tính tiền thối lại changeAmount
    const expDiscountCash = Math.round(expectedSubTotalAfterAdd * 0.1);
    const expTotalCash = expectedSubTotalAfterAdd - expDiscountCash;
    const expAmountReceived = 200000;
    const expChangeCash = expAmountReceived - expTotalCash;

    const payCashRes = await request(`/orders/${order1Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        paymentMethod: 'Cash',
        discountPercent: 10,
        amountReceived: expAmountReceived,
      }),
    });

    const payCashData = payCashRes.data?.data;
    if (
      payCashRes.status === 200 &&
      payCashData?.order?.status === 'Paid' &&
      payCashData?.order?.isPaid === true &&
      payCashData?.order?.totalAmount === expTotalCash &&
      payCashData?.changeAmount === expChangeCash
    ) {
      // Kiểm tra Bàn 01 đã được giải phóng Available
      const table1Check = await connection.collection('tables').findOne({ _id: new Types.ObjectId(table1Id) });
      if (table1Check?.status === 'Available' && !table1Check?.currentOrderId && table1Check?.totalGuests === 0) {
        pass('TC-6.3-08.2: Thanh toán tiền mặt Cash thành công', `Total = ${expTotalCash.toLocaleString('vi-VN')} đ, tiền thừa = ${expChangeCash.toLocaleString('vi-VN')} đ, Bàn 01 giải phóng Available`);
        passed++;
      } else {
        fail('TC-6.3-08.2: Thanh toán tiền mặt Cash', `Bàn chưa giải phóng: ${JSON.stringify(table1Check)}`);
        failed++;
      }
    } else {
      fail('TC-6.3-08.2: Thanh toán tiền mặt Cash', JSON.stringify(payCashRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 9: QUICK-PAY VỚI VIETQR & BÀN TỰ ĐỘNG GIẢI PHÓNG
    // ------------------------------------------------------------------------
    // Tạo đơn mới trên Bàn 02
    const createOrder2Res = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        tableId: table2Id,
        orderSource: 'STAFF_POS',
        items: [{ menuItemId, quantity: 1 }],
      }),
    });
    const order2Id = createOrder2Res.data?.data?._id;

    // Quick pay trực tiếp từ Preparing sang Paid qua VietQR
    const payVietQrRes = await request(`/orders/${order2Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        paymentMethod: 'VietQR',
        vatPercent: 8,
      }),
    });

    if (
      payVietQrRes.status === 200 &&
      payVietQrRes.data?.data?.order?.status === 'Paid' &&
      payVietQrRes.data?.data?.order?.vatAmount === Math.round(item1Price * 0.08)
    ) {
      const table2Check = await connection.collection('tables').findOne({ _id: new Types.ObjectId(table2Id) });
      if (table2Check?.status === 'Available') {
        pass('TC-6.3-09: Quick-pay VietQR từ trạng thái Preparing thành công', 'Order = Paid, VAT 8%, Bàn 02 giải phóng Available');
        passed++;
      } else {
        fail('TC-6.3-09: Quick-pay VietQR', 'Bàn 02 chưa giải phóng');
        failed++;
      }
    } else {
      fail('TC-6.3-09: Quick-pay VietQR', JSON.stringify(payVietQrRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 10: TERMINAL INVARIANT (Chặn sửa / thanh toán lại đơn đã Paid)
    // ------------------------------------------------------------------------
    const rePayRes = await request(`/orders/${order1Id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });
    if (rePayRes.status === 400) {
      pass('TC-6.3-10.1: Chặn thanh toán lại đơn đã Paid (HTTP 400 Bad Request thành công)');
      passed++;
    } else {
      fail('TC-6.3-10.1: Chặn thanh toán lại đơn đã Paid', `Mong đợi 400 nhưng nhận: ${rePayRes.status}`);
      failed++;
    }

    const addItemsPaidRes = await request(`/orders/${order1Id}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({ items: [{ menuItemId, quantity: 1 }] }),
    });
    if (addItemsPaidRes.status === 400) {
      pass('TC-6.3-10.2: Chặn thêm món vào đơn đã Paid (HTTP 400 Bad Request thành công)');
      passed++;
    } else {
      fail('TC-6.3-10.2: Chặn thêm món vào đơn đã Paid', `Mong đợi 400 nhưng nhận: ${addItemsPaidRes.status}`);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 11: RBAC ENFORCEMENT
    // ------------------------------------------------------------------------
    // Waiter cố gắng thanh toán -> 403 Forbidden (chỉ POS.CONFIRM mới được thanh toán)
    // Tạo 1 order tạm trên bàn trống để test
    const tempOrderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        tableId: emptyTableId,
        orderSource: 'STAFF_POS',
        items: [{ menuItemId, quantity: 1 }],
      }),
    });
    const tempOrderId = tempOrderRes.data?.data?._id;

    const waiterPayRes = await request(`/orders/${tempOrderId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waiterToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });
    if (waiterPayRes.status === 403) {
      pass('TC-6.3-11.1: RBAC - Chặn Waiter thanh toán (HTTP 403 Forbidden thành công)');
      passed++;
    } else {
      fail('TC-6.3-11.1: RBAC - Chặn Waiter thanh toán', `Mong đợi 403 nhưng nhận: ${waiterPayRes.status}`);
      failed++;
    }

    // Cashier cố gắng hủy đơn -> 403 Forbidden (chỉ Quản lý có POS.UPDATE mới được hủy)
    const cashierCancelRes = await request(`/orders/${tempOrderId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({ reason: 'Thu ngân tự ý hủy' }),
    });
    if (cashierCancelRes.status === 403) {
      pass('TC-6.3-11.2: RBAC - Chặn Cashier hủy đơn (HTTP 403 Forbidden thành công, chỉ Manager có POS.UPDATE)');
      passed++;
    } else {
      fail('TC-6.3-11.2: RBAC - Chặn Cashier hủy đơn', `Mong đợi 403 nhưng nhận: ${cashierCancelRes.status}`);
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 12: BRANCH & TENANT ISOLATION
    // ------------------------------------------------------------------------
    // Cashier chi nhánh phụ cố gắng thanh toán đơn chi nhánh chính -> 403 Forbidden
    const subCashierPayRes = await request(`/orders/${tempOrderId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${subBranchCashierToken}` },
      body: JSON.stringify({ paymentMethod: 'Cash' }),
    });
    if (subCashierPayRes.status === 403) {
      pass('TC-6.3-12.1: Phân lập chi nhánh (Branch Isolation) - Chặn thanh toán đơn chi nhánh khác (HTTP 403)');
      passed++;
    } else {
      fail('TC-6.3-12.1: Phân lập chi nhánh', `Mong đợi 403 nhưng nhận: ${subCashierPayRes.status}`);
      failed++;
    }

    // Cashier Nhà hàng B cố gắng truy cập đơn Nhà hàng A -> 404 Not Found
    const restBCashierRes = await request(`/orders/${tempOrderId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${restBCashierToken}` },
    });
    if (restBCashierRes.status === 404) {
      pass('TC-6.3-12.2: Phân lập đa người thuê (Multi-Tenant) - Nhà hàng B không thể xem đơn Nhà hàng A (HTTP 404)');
      passed++;
    } else {
      fail('TC-6.3-12.2: Phân lập đa người thuê', `Mong đợi 404 nhưng nhận: ${restBCashierRes.status}`);
      failed++;
    }

    // Super Admin có thể xem chi tiết đơn xuyên suốt các nhà hàng
    const superAdminViewRes = await request(`/orders/${tempOrderId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    if (superAdminViewRes.status === 200 && superAdminViewRes.data?.data?._id === tempOrderId) {
      pass('TC-6.3-12.3: Super Admin có quyền xem đơn hàng xuyên hệ thống thành công');
      passed++;
    } else {
      fail('TC-6.3-12.3: Super Admin xem đơn', JSON.stringify(superAdminViewRes.data));
      failed++;
    }

    // ------------------------------------------------------------------------
    // TEST 13: ATOMIC PAYMENT CLAIM UNDER CONCURRENCY (Promise.all concurrent pay requests)
    // ------------------------------------------------------------------------
    const tConcurrentRes = await request('/tables', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ code: `CONC_${timestamp}`, name: 'Bàn Test Concurrent', zoneId, capacity: 4 }),
    });
    const concurrentTableId = tConcurrentRes.data?.data?._id;

    // Tạo đơn hàng POS hợp lệ trên bàn (Status = Preparing)
    const createConcurrentOrderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        tableId: concurrentTableId,
        orderSource: 'STAFF_POS',
        items: [{ menuItemId, quantity: 2 }],
      }),
    });
    const concurrentOrderId = createConcurrentOrderRes.data?.data?._id;

    // Bắn 2 request POST /orders/:id/pay đồng thời qua Promise.all
    const payPayload = {
      paymentMethod: 'VietQR',
      discountPercent: 5,
      vatPercent: 8,
    };

    const [payRes1, payRes2] = await Promise.all([
      request(`/orders/${concurrentOrderId}/pay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify(payPayload),
      }),
      request(`/orders/${concurrentOrderId}/pay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify(payPayload),
      }),
    ]);

    const successCount = [payRes1, payRes2].filter((r) => r.status === 200).length;
    const failCount = [payRes1, payRes2].filter((r) => r.status >= 400).length;

    // Kiểm tra Order và Table trong DB
    const finalOrder = await connection.collection('orders').findOne({ _id: new Types.ObjectId(concurrentOrderId) });
    const finalTable = await connection.collection('tables').findOne({ _id: new Types.ObjectId(concurrentTableId) });

    if (
      successCount === 1 &&
      failCount === 1 &&
      finalOrder?.isPaid === true &&
      finalOrder?.status === 'Paid' &&
      finalTable?.status === 'Available' &&
      !finalTable?.currentOrderId
    ) {
      pass(
        'TC-6.3-13: Atomic Payment Claim under Concurrency',
        `2 request đồng thời qua Promise.all -> Chính xác 1 thành công (200), 1 thất bại (400), Order Paid 1 lần, Bàn giải phóng 1 lần`,
      );
      passed++;
    } else {
      fail(
        'TC-6.3-13: Atomic Payment Claim under Concurrency',
        `Success: ${successCount}, Fail: ${failCount}, Res1: ${payRes1.status}, Res2: ${payRes2.status}`,
      );
      failed++;
    }

  } catch (err: any) {
    console.error('Lỗi nghiêm trọng trong quá trình kiểm thử:', err);
    failed++;
  } finally {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Kết quả kiểm thử Sub-phase 6.3: ${passed} passed, ${failed} failed`);
    console.log(`----------------------------------------------------------------\n`);

    console.log('[Teardown] Dọn dẹp tài nguyên kiểm thử Sub-phase 6.3...');
    try {
      if (restaurantId) {
        await connection.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await connection.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await connection.collection('table_zones').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await connection.collection('menu_items').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await connection.collection('menu_categories').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await connection.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
      }
      if (restBId) {
        await connection.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restBId) });
        await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restBId) });
      }
      console.log('  ✔ Đã dọn dẹp sạch sẽ toàn bộ dữ liệu kiểm thử (Zero Garbage)');
    } catch (e: any) {
      console.error('Lỗi khi dọn dẹp:', e.message);
    }

    await app.close();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
