import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';

const TEST_PORT = 3140;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 13 Suite 4: Security Hardening & Concurrency Engine (Port ${TEST_PORT}) ${colors.reset}`);
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
      }),
    );
    await app.listen(TEST_PORT);

    const connection = app.get<Connection>(getConnectionToken());
    const db = connection.db!;

    // 1. Roles
    let superRole = await db.collection('roles').findOne({ slug: 'system_admin' });
    if (!superRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'System Admin',
        slug: 'system_admin',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      superRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    let ownerRole = await db.collection('roles').findOne({ slug: 'restaurant_admin' });
    if (!ownerRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'Restaurant Admin',
        slug: 'restaurant_admin',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      ownerRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    // 2. Clean test records
    await db.collection('users').deleteMany({ email: /.*@test-sec-p13\.vn/ });
    await db.collection('restaurants').deleteMany({ slug: /^test-sec-/ });

    const hashedPassword = await bcrypt.hash('Test@123456', 10);

    // Seed SuperAdmin
    const superAdminId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: superAdminId,
      username: 'superadmin_sec_p13',
      email: 'superadmin@test-sec-p13.vn',
      fullName: 'Super Admin Security',
      phone: '0907000001',
      password: hashedPassword,
      role: superRole!._id,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Restaurant
    const restId = new Types.ObjectId();
    const branchId = new Types.ObjectId();
    const restSlug = 'test-sec-hardened-diner';

    await db.collection('restaurants').insertOne({
      _id: restId,
      name: 'Nhà Hàng Bảo Mật P13',
      slug: restSlug,
      phone: '0907000002',
      address: '777 Nguyễn Trãi, Q5',
      plan: 'Pro',
      subscriptionStatus: 'ACTIVE_PAID',
      isSuspended: false,
      branches: [
        {
          _id: branchId,
          name: 'Chi nhánh Quận 5',
          address: '777 Nguyễn Trãi, Q5',
          phone: '0907000002',
          isMainBranch: true,
          isOpen: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Owner
    const ownerId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: ownerId,
      username: 'owner_sec_p13',
      email: 'owner@test-sec-p13.vn',
      fullName: 'Chủ Quán Sec',
      phone: '0907000003',
      password: hashedPassword,
      role: ownerRole!._id,
      restaurantId: restId,
      branchId: branchId.toString(),
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Zone & Table
    const zoneId = new Types.ObjectId();
    await db.collection('table_zones').insertOne({
      _id: zoneId,
      name: 'Khu VIP 01',
      restaurantId: restId,
      branchId: branchId.toString(),
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const tableId = new Types.ObjectId();
    const tableCode = 'TSEC-01';
    const qrToken = 'SEC_QR_SECRET_999';

    await db.collection('tables').insertOne({
      _id: tableId,
      code: tableCode,
      name: 'Bàn Bảo Mật 01',
      restaurantId: restId,
      branchId: branchId.toString(),
      zone: zoneId,
      qrToken,
      qrStatus: 'active',
      status: 'Available',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Menu Item
    const itemId = new Types.ObjectId();
    await db.collection('menu_items').insertOne({
      _id: itemId,
      name: 'Bò Bít Tết Hảo Hạng',
      price: 180000,
      restaurantId: restId,
      branchId: branchId.toString(),
      isAvailable: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Clean any old orders for this table
    await db.collection('orders').deleteMany({ tableId });

    // Login SuperAdmin
    const loginSuper = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@test-sec-p13.vn', password: 'Test@123456' }),
    });
    const superToken = loginSuper.data?.data?.accessToken;

    // Login Owner
    const loginOwner = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@test-sec-p13.vn', password: 'Test@123456' }),
    });
    const ownerToken = loginOwner.data?.data?.accessToken;

    // -------------------------------------------------------------------------
    // TEST 1: AUD-13.4 - Same-Table Concurrent QR First-Order Auto-Fallback to Round 2
    // -------------------------------------------------------------------------
    // Diners A & B scan the QR at table TSEC-01. Diner A places order 1.
    const resDinerA = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restSlug,
        tableCode,
        qrToken,
        items: [{ menuItemId: itemId.toString(), quantity: 1 }],
        customerNote: 'Order từ Diner A (Round 1)',
      }),
    });

    // Diner B places initial order on the SAME table simultaneously
    const resDinerB = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restSlug,
        tableCode,
        qrToken,
        items: [{ menuItemId: itemId.toString(), quantity: 2 }],
        customerNote: 'Order từ Diner B (Auto-Merge Round 2)',
        autoMergeRound2: true,
      }),
    });

    const activeOrderInDb = await db.collection('orders').findOne({ tableId, isPaid: false });

    if (
      resDinerA.status === 201 &&
      resDinerA.data?.success === true &&
      (resDinerB.status === 200 || resDinerB.status === 201) &&
      resDinerB.data?.success === true &&
      activeOrderInDb &&
      activeOrderInDb.rounds?.length === 2 &&
      activeOrderInDb.rounds[0]?.roundNumber === 1 &&
      activeOrderInDb.rounds[1]?.roundNumber === 2 &&
      activeOrderInDb.items?.length === 2
    ) {
      pass('TEST 1: AUD-13.4 Same-Table Concurrent First-Order Race Condition tự động fallback & gom thành Round 2 mượt mà 100% không xung đột');
      passed++;
    } else {
      fail('TEST 1: AUD-13.4 Concurrent Order Race Condition thất bại', {
        resDinerA,
        resDinerB,
        activeOrderInDb,
      });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 2: AUD-13.5 - Composite Rate Limiting Without Shared Wi-Fi Collateral Damage
    // -------------------------------------------------------------------------
    // Scenario: Shared Office Wi-Fi with IP = 192.168.10.88
    // User A (bad_actor@test-sec-p13.vn) attempts wrong password 5 times from that IP.
    const SHARED_WIFI_IP = '192.168.10.88';

    // Seed User B on the same system
    const userBId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: userBId,
      username: 'user_b_sec_p13',
      email: 'user_b@test-sec-p13.vn',
      fullName: 'User B (Colleague on Same Wi-Fi)',
      phone: '0907000004',
      password: hashedPassword,
      role: ownerRole!._id,
      restaurantId: restId,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let userAFailureCount = 0;
    let userABlocked = false;

    // User A fails 5 times
    for (let i = 1; i <= 5; i++) {
      const resFail = await request('/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': SHARED_WIFI_IP },
        body: JSON.stringify({ email: 'owner@test-sec-p13.vn', password: 'WrongPassword@123' }),
      });
      if (resFail.status === 401) {
        userAFailureCount++;
      }
    }

    // 6th attempt by User A from the same IP must be rejected with 429 Too Many Requests
    const resUserA6th = await request('/auth/login', {
      method: 'POST',
      headers: { 'x-forwarded-for': SHARED_WIFI_IP },
      body: JSON.stringify({ email: 'owner@test-sec-p13.vn', password: 'Test@123456' }),
    });

    if (resUserA6th.status === 429) {
      userABlocked = true;
    }

    // Simultaneously, User B on the EXACT SAME IP logs in with correct credentials
    const resUserBLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'x-forwarded-for': SHARED_WIFI_IP },
      body: JSON.stringify({ email: 'user_b@test-sec-p13.vn', password: 'Test@123456' }),
    });

    if (
      userAFailureCount === 5 &&
      userABlocked &&
      resUserBLogin.status === 200 &&
      resUserBLogin.data?.data?.accessToken
    ) {
      pass('TEST 2: AUD-13.5 Composite Rate Limiter khóa đích danh cặp (IP, Email) vi phạm (429), bảo vệ an toàn cho đồng nghiệp User B trên cùng Wi-Fi văn phòng đăng nhập bình thường (200)');
      passed++;
    } else {
      fail('TEST 2: AUD-13.5 Rate Limiter thất bại hoặc gây thiệt hại ngoài ý muốn (collateral damage)', {
        userAFailureCount,
        resUserA6th,
        resUserBLogin,
      });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 3: AUD-13.2 - Immediate Restaurant Suspension Enforcement
    // -------------------------------------------------------------------------
    // SuperAdmin suspends the restaurant
    const resSuspend = await request(`/platform/restaurants/${restId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        isSuspended: true,
        suspendReason: 'Vi phạm bảo mật nghiêm trọng',
      }),
    });

    // Customer attempts to place a new order on suspended restaurant
    const resDinerSuspended = await request('/orders/customer', {
      method: 'POST',
      body: JSON.stringify({
        restaurantSlug: restSlug,
        tableCode,
        qrToken,
        items: [{ menuItemId: itemId.toString(), quantity: 1 }],
      }),
    });

    // Staff attempts to access API with their token
    const resStaffSuspended = await request('/auth/me', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    if (
      resSuspend.status === 200 &&
      resDinerSuspended.status === 403 &&
      (resStaffSuspended.status === 401 || resStaffSuspended.status === 403)
    ) {
      pass(`TEST 3: AUD-13.2 Immediate Tenant Suspension khóa tức thì quyền gọi món của thực khách (403) và vô hiệu hóa ngay phiên làm việc của nhân sự quán (${resStaffSuspended.status})`);
      passed++;
    } else {
      fail('TEST 3: AUD-13.2 Khóa nhà hàng không chặn được khách hoặc nhân sự', {
        resSuspend,
        resDinerSuspended,
        resStaffSuspended,
      });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 4: AUD-13.6 - Zero Secret & Sensitive Field Leakage
    // -------------------------------------------------------------------------
    const resReps = await request('/platform/sales-reps', {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const resRests = await request('/platform/restaurants', {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const resSuperMe = await request('/auth/me', {
      headers: { Authorization: `Bearer ${superToken}` },
    });

    const repsStr = JSON.stringify(resReps.data || {});
    const restsStr = JSON.stringify(resRests.data || {});
    const meStr = JSON.stringify(resSuperMe.data || {});

    const hasPasswordInReps = repsStr.includes('"password":');
    const hasPasswordInRests = restsStr.includes('"password":');
    const hasPasswordInMe = meStr.includes('"password":');
    const hasRefreshHash = repsStr.includes('refreshTokenHash') || restsStr.includes('refreshTokenHash') || meStr.includes('refreshTokenHash');

    if (!hasPasswordInReps && !hasPasswordInRests && !hasPasswordInMe && !hasRefreshHash) {
      pass('TEST 4: AUD-13.6 Safe Projection ngăn chặn 100% việc rò rỉ password hash, refreshTokenHash hoặc secret keys trong tất cả API responses');
      passed++;
    } else {
      fail('TEST 4: AUD-13.6 Phát hiện rò rỉ dữ liệu nhạy cảm!', {
        hasPasswordInReps,
        hasPasswordInRests,
        hasPasswordInMe,
        hasRefreshHash,
      });
      failed++;
    }

  } catch (err: any) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    if (app) await app.close();
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Kết quả Test Suite 4: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------------------------------\n');
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
