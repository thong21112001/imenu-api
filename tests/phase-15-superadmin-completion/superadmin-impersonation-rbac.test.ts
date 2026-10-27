import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { getTestNumberSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3154;
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

export async function runSuperAdminImpersonationRbacTests(): Promise<{ passed: boolean; count: number; failures: number }> {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 15 Suite 4: Superadmin Impersonation & Strict RBAC Isolation (Port ${TEST_PORT}) ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let count = 0;
  let failures = 0;

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

    // Clean test data
    await db.collection('restaurants').deleteMany({ slug: { $regex: /^test-rbac-p15-/ } });
    await db.collection('branches').deleteMany({ name: { $regex: /P15 RBAC/ } });
    await db.collection('roles').deleteMany({ name: { $regex: /P15 Role/ } });
    await db.collection('users').deleteMany({ email: { $regex: /@test-rbac-p15\.vn$/ } });

    // Roles
    let superAdminRole = await db.collection('roles').findOne({ slug: 'system_admin' });
    if (!superAdminRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'System Admin',
        slug: 'system_admin',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      superAdminRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
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

    let salesRole = await db.collection('roles').findOne({ slug: 'sales_rep' });
    if (!salesRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'Nhân Viên Kinh Doanh',
        slug: 'sales_rep',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      salesRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    let cashierRole = await db.collection('roles').findOne({ slug: 'cashier' });
    if (!cashierRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'Thu ngân',
        slug: 'cashier',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      cashierRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    const testPassword = getTestNumberSecret();
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Target Restaurant
    const targetRestRes = await db.collection('restaurants').insertOne({
      name: 'Nhà Hàng P15 RBAC Test',
      slug: 'test-rbac-p15-main',
      status: 'ACTIVE',
      phone: '0901234567',
      address: '100 Nguyễn Huệ, Quận 1, TP.HCM',
      plan: 'Pro',
      subscriptionPlan: 'Pro',
      branches: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const targetRestId = targetRestRes.insertedId.toString();

    // 1. Superadmin User
    await db.collection('users').insertOne({
      fullName: 'Super Admin RBAC Guard',
      email: 'superadmin@test-rbac-p15.vn',
      password: hashedPassword,
      role: superAdminRole!._id,
      isSuperAdmin: true,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Restaurant Owner User
    await db.collection('users').insertOne({
      fullName: 'Chủ Quán P15',
      email: 'owner@test-rbac-p15.vn',
      password: hashedPassword,
      role: ownerRole!._id,
      restaurantId: targetRestRes.insertedId,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Sales Rep User
    await db.collection('users').insertOne({
      fullName: 'NVKD P15',
      email: 'sales@test-rbac-p15.vn',
      password: hashedPassword,
      role: salesRole!._id,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 4. Cashier User
    await db.collection('users').insertOne({
      fullName: 'Thu Ngân P15',
      email: 'cashier@test-rbac-p15.vn',
      password: hashedPassword,
      role: cashierRole!._id,
      restaurantId: targetRestRes.insertedId,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Login tokens
    async function getToken(email: string) {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: testPassword }),
      });
      return res.data?.data?.accessToken || res.data?.accessToken;
    }

    const superAdminToken = await getToken('superadmin@test-rbac-p15.vn');
    const ownerToken = await getToken('owner@test-rbac-p15.vn');
    const salesToken = await getToken('sales@test-rbac-p15.vn');
    const cashierToken = await getToken('cashier@test-rbac-p15.vn');

    const superAdminHeaders = { Authorization: `Bearer ${superAdminToken}` };
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const salesHeaders = { Authorization: `Bearer ${salesToken}` };
    const cashierHeaders = { Authorization: `Bearer ${cashierToken}` };

    // -------------------------------------------------------------------------
    // TEST 1: Superadmin GET /branches without restaurantId returns empty array
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request('/branches', {
        method: 'GET',
        headers: superAdminHeaders,
      });

      if (res.status === 200 && res.data.success && Array.isArray(res.data.data) && res.data.data.length === 0) {
        pass('TEST 1: Superadmin gọi GET /branches khi chưa chọn nhà hàng trả về mảng rỗng (không 400 Bad Request)');
      } else {
        throw new Error(`Kỳ vọng 200 OK với data rỗng nhưng nhận được status=${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 1: Superadmin GET /branches without restaurantId', err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Superadmin creates branch with restaurantId context
    // -------------------------------------------------------------------------
    count++;
    let createdBranchId = '';
    try {
      const res = await request('/branches', {
        method: 'POST',
        headers: superAdminHeaders,
        body: JSON.stringify({
          name: 'P15 RBAC Chi Nhánh 1',
          address: '100 Lê Duẩn, Đà Nẵng',
          phone: '02363888999',
          restaurantId: targetRestId,
        }),
      });

      if ([200, 201].includes(res.status) && res.data.success) {
        createdBranchId = (res.data.data.id || res.data.data._id || '').toString();
        const restDoc = await db.collection('restaurants').findOne({ _id: new Types.ObjectId(targetRestId) });
        const branchInRest = (restDoc?.branches || []).find((b: any) => b._id.toString() === createdBranchId);
        if (branchInRest && branchInRest.name === 'P15 RBAC Chi Nhánh 1') {
          pass('TEST 2: Superadmin tạo chi nhánh mới cho nhà hàng được chỉ định trong chế độ hỗ trợ thành công');
        } else {
          throw new Error('Chi nhánh được tạo không tìm thấy trong danh sách chi nhánh của nhà hàng trong DB');
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 2: Superadmin tạo chi nhánh cho nhà hàng', err);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Superadmin closes, reopens and updates branch in support mode
    // -------------------------------------------------------------------------
    count++;
    try {
      // Close branch
      const closeRes = await request(`/branches/${createdBranchId}/close?restaurantId=${targetRestId}`, {
        method: 'PATCH',
        headers: superAdminHeaders,
        body: JSON.stringify({ reason: 'Bảo trì hệ thống điện nước' }),
      });

      // Reopen branch
      const reopenRes = await request(`/branches/${createdBranchId}/reopen?restaurantId=${targetRestId}`, {
        method: 'PATCH',
        headers: superAdminHeaders,
      });

      if (closeRes.status === 200 && reopenRes.status === 200) {
        pass('TEST 3: Superadmin thực hiện đóng cửa và mở lại chi nhánh trong chế độ hỗ trợ kỹ thuật thành công');
      } else {
        throw new Error(`Đóng hoặc mở lại chi nhánh thất bại: closeStatus=${closeRes.status}, reopenStatus=${reopenRes.status}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 3: Superadmin đóng/mở chi nhánh', err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Superadmin creates custom role with restaurantId
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request('/roles', {
        method: 'POST',
        headers: superAdminHeaders,
        body: JSON.stringify({
          name: 'P15 Role Quản Lý Ca',
          slug: 'p15_shift_manager',
          description: 'Vai trò tùy chỉnh tạo bởi Superadmin cho nhà hàng',
          permissionIds: ['perm-order-view', 'perm-table-view'],
          restaurantId: targetRestId,
        }),
      });

      if (res.status === 201 && res.data.success) {
        const roleDoc = await db.collection('roles').findOne({ name: 'P15 Role Quản Lý Ca' });
        if (roleDoc && roleDoc.restaurantId?.toString() === targetRestId) {
          pass('TEST 4: Superadmin tạo vai trò phân quyền tùy biến cho nhà hàng thành công');
        } else {
          throw new Error('Vai trò tạo bởi Superadmin không gắn đúng restaurantId');
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 4: Superadmin tạo vai trò tùy biến', err);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Strict RBAC Isolation Boundaries: Sales, Cashier, Owner & Anon
    // -------------------------------------------------------------------------
    count++;
    try {
      // 5a. Sales Rep tries to access /platform/restaurants
      const salesAttempt = await request('/platform/restaurants', {
        method: 'GET',
        headers: salesHeaders,
      });

      // 5b. Cashier tries to access /platform/overview
      const cashierAttempt = await request('/platform/overview', {
        method: 'GET',
        headers: cashierHeaders,
      });

      // 5c. Anonymous tries to access /platform/restaurants
      const anonAttempt = await request('/platform/restaurants', {
        method: 'GET',
      });

      // 5d. Owner tries to update a foreign restaurant via PUT /restaurants/:id
      const foreignRestRes = await db.collection('restaurants').insertOne({
        name: 'Nhà Hàng Cạnh Tranh P15',
        slug: 'test-rbac-p15-foreign',
        status: 'ACTIVE',
        phone: '0909887766',
        address: '200 Lê Lợi, Quận 1, TP.HCM',
        plan: 'Standard',
        branches: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const foreignRestId = foreignRestRes.insertedId.toString();

      const foreignUpdateAttempt = await request(`/restaurants/${foreignRestId}`, {
        method: 'PUT',
        headers: ownerHeaders,
        body: JSON.stringify({ name: 'Tấn Công Sửa Tên' }),
      });

      if (
        salesAttempt.status === 403 &&
        cashierAttempt.status === 403 &&
        anonAttempt.status === 401 &&
        foreignUpdateAttempt.status === 403
      ) {
        pass('TEST 5: Rào cản RBAC cách ly tuyệt đối: Sales (403), Thu ngân (403), Anon (401), Owner sửa quán khác (403)');
      } else {
        throw new Error(
          `Vi phạm ranh giới bảo mật: sales=${salesAttempt.status}, cashier=${cashierAttempt.status}, anon=${anonAttempt.status}, foreign=${foreignUpdateAttempt.status}`
        );
      }
    } catch (err: any) {
      failures++;
      fail('TEST 5: Rào cản RBAC đa phân hệ', err);
    }
  } finally {
    if (app) {
      await app.close();
    }
  }

  return { passed: failures === 0, count, failures };
}

if (require.main === module) {
  runSuperAdminImpersonationRbacTests().then((res) => {
    process.exit(res.passed ? 0 : 1);
  });
}
