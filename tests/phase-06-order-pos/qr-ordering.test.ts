import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { UsersService } from '../../src/modules/users/users.service';

const TEST_PORT = 3108;
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
  console.log(`${colors.bold}${colors.cyan}  HOTFIX VERIFICATION: Case-Insensitive Table & Slug QR Ordering        ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  console.log('Khởi động test server trên port', TEST_PORT, '...');
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const connection: Connection = app.get(getConnectionToken());
  const rolesService = app.get(RolesService);
  await rolesService.seedDefaultRoles();

  const usersService = app.get(UsersService);
  await usersService.initAdmin();

  await app.listen(TEST_PORT);
  console.log('Test server đã sẵn sàng!\n');

  const timestamp = Date.now();
  const restSlug = `coffee-anh-hien-${timestamp}`;
  const restId = new Types.ObjectId();
  const branchId = 'branch-main';
  const zoneId = new Types.ObjectId();
  const tableB03Id = new Types.ObjectId();
  const catId = new Types.ObjectId();
  const menuItemId = new Types.ObjectId();
  const qrTokenB03 = `r6t1mpo7-${timestamp}`;

  try {
    // 1. Tạo Nhà hàng có thông tin ngân hàng & Wifi
    await connection.collection('restaurants').insertOne({
      _id: restId,
      name: 'Coffee Anh Hiền',
      slug: restSlug,
      phone: '0901234567',
      address: '123 Đường Cà Phê, Quận 1',
      isActive: true,
      branches: [
        {
          _id: new Types.ObjectId(),
          name: 'Chi nhánh chính',
          isMainBranch: true,
          isActive: true,
        },
      ],
      bankAccount: {
        bankId: '970422', // MB Bank
        accountNo: '0901234567',
        accountName: 'ANH HIEN COFFEE',
      },
      wifiSsid: 'CoffeeAnhHien_5G',
      wifiPassword: 'cafeanhhien888',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Tạo Zone và Bàn với mã IN HOA "B03"
    await connection.collection('table_zones').insertOne({
      _id: zoneId,
      name: 'Khu vực Tầng 1',
      restaurantId: restId,
      branchId: branchId,
      createdAt: new Date(),
    });

    await connection.collection('tables').insertOne({
      _id: tableB03Id,
      code: 'B03', // IN HOA
      name: 'Bàn B03 VIP',
      zone: zoneId,
      restaurantId: restId,
      branchId: branchId,
      capacity: 4,
      status: 'Available',
      qrToken: qrTokenB03,
      qrStatus: 'active',
      wifiSsid: 'CoffeeAnhHien_B03',
      wifiPassword: 'pass_b03_secret',
      isDeleted: false,
      createdAt: new Date(),
    });

    // 3. Tạo Category & Menu Item
    await connection.collection('menu_categories').insertOne({
      _id: catId,
      name: 'Cà Phê Truyền Thống',
      slug: 'ca-phe-truyen-thong',
      restaurantId: restId,
      branches: [branchId],
      isActive: true,
      order: 1,
    });

    await connection.collection('menu_items').insertOne({
      _id: menuItemId,
      restaurantId: restId,
      category: catId,
      name: 'Cà Phê Sữa Đá',
      slug: 'ca-phe-sua-da',
      price: 35000,
      isAvailable: true,
      isDeleted: false,
    });

    // -------------------------------------------------------------------------
    // TEST CASE 1: GET /api/orders/public/table-context với tableCode: "b03" (chữ thường)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: GET /api/orders/public/table-context với tableCode "b03" chữ thường ---');
    const ctxRes = await request(
      `/orders/public/table-context?restaurantSlug=${restSlug.toUpperCase()}&tableCode=b03&qrToken=${qrTokenB03}`,
    );

    const ctxData = ctxRes.data?.data || ctxRes.data;
    if (
      ctxRes.status === 200 &&
      ctxData?.table?.code === 'B03' &&
      ctxData?.table?.wifiSsid === 'CoffeeAnhHien_B03' &&
      ctxData?.table?.wifiPassword === 'pass_b03_secret' &&
      ctxData?.restaurant?.bankAccount?.accountNo === '0901234567'
    ) {
      pass(
        'HOTFIX-01: GET /api/orders/public/table-context thành công với tableCode "b03" (chữ thường) và slug HOA!',
        `table.code="${ctxData.table.code}", wifiSsid="${ctxData.table.wifiSsid}", bankAccount=${ctxData.restaurant.bankAccount.accountNo}`,
      );
      passed++;
    } else {
      fail('HOTFIX-01: GET /api/orders/public/table-context thất bại', {
        status: ctxRes.status,
        data: ctxRes.data,
      });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST CASE 2: POST /api/orders/customer với tableCode: "b03" (chữ thường)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: POST /api/orders/customer với tableCode "b03" chữ thường ---');
    const orderRes = await request('/orders/customer', {
      method: 'POST',
      headers: { 'idempotency-key': `idem-hotfix-${timestamp}` },
      body: JSON.stringify({
        restaurantSlug: restSlug,
        tableCode: 'b03', // Chữ thường
        qrToken: qrTokenB03,
        items: [
          {
            menuItemId: menuItemId.toString(),
            quantity: 2,
            note: 'Ít ngọt, nhiều đá',
          },
        ],
      }),
    });

    const orderData = orderRes.data?.data || orderRes.data;
    if (
      (orderRes.status === 201 || orderRes.status === 200) &&
      orderData?.orderCode &&
      orderData?.tableId === tableB03Id.toString() &&
      orderData?.status === 'WaitingConfirmation'
    ) {
      pass(
        'HOTFIX-02: POST /api/orders/customer thành công với tableCode "b03" (chữ thường)!',
        `orderCode="${orderData.orderCode}", status="${orderData.status}", tableId="${orderData.tableId}"`,
      );
      passed++;
    } else {
      fail('HOTFIX-02: POST /api/orders/customer thất bại', {
        status: orderRes.status,
        data: orderRes.data,
      });
      failed++;
    }
  } catch (err: any) {
    console.error('Unhandled Exception in Test:', err);
    failed++;
  } finally {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Kết quả kiểm thử Hotfix: ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} failed${colors.reset}`);
    console.log(`----------------------------------------------------------------\n`);

    console.log('[Teardown] Dọn dẹp tài nguyên kiểm thử...');
    try {
      await connection.collection('orders').deleteMany({ restaurantId: restId });
      await connection.collection('tables').deleteMany({ restaurantId: restId });
      await connection.collection('table_zones').deleteMany({ restaurantId: restId });
      await connection.collection('menu_items').deleteMany({ restaurantId: restId });
      await connection.collection('menu_categories').deleteMany({ restaurantId: restId });
      await connection.collection('restaurants').deleteMany({ _id: restId });
      console.log(`  ${colors.green}✔ Đã dọn dẹp sạch sẽ toàn bộ dữ liệu kiểm thử (Zero Garbage)${colors.reset}\n`);
    } catch (cleanErr: any) {
      console.error('Lỗi khi dọn dẹp DB:', cleanErr.message);
    }

    try {
      await connection.close();
    } catch {}
    if (app) {
      await app.close();
    }
  }

  setTimeout(() => {
    process.exit(failed > 0 ? 1 : 0);
  }, 200);
}

main();
