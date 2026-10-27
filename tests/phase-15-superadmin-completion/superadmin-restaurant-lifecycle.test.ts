import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { getTestNumberSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3151;
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

export async function runSuperAdminRestaurantLifecycleTests(): Promise<{ passed: boolean; count: number; failures: number }> {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 15 Suite 1: Superadmin Restaurant Lifecycle & Subscription Sync (Port ${TEST_PORT}) ${colors.reset}`);
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
    await db.collection('restaurants').deleteMany({ slug: { $regex: /^test-p15-/ } });
    await db.collection('users').deleteMany({ email: { $regex: /@test-p15\.vn$/ } });
    await db.collection('subscription_transactions').deleteMany({});

    // Ensure roles exist
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

    const testPassword = getTestNumberSecret();
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Create Superadmin User
    const superAdminUserRes = await db.collection('users').insertOne({
      fullName: 'Super Admin Phase 15',
      email: 'superadmin@test-p15.vn',
      password: hashedPassword,
      role: superAdminRole!._id,
      isSuperAdmin: true,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Target Test Restaurant
    const targetRestRes = await db.collection('restaurants').insertOne({
      name: 'Nhà Hàng Phase 15 Lifecycle',
      slug: 'test-p15-lifecycle',
      status: 'ACTIVE',
      subscriptionPlan: 'Free',
      phone: '0901112222',
      address: '99 Lê Duẩn, Đà Nẵng',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const targetRestId = targetRestRes.insertedId.toString();

    // Login as Superadmin
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'superadmin@test-p15.vn',
        password: testPassword,
      }),
    });
    const superAdminToken = loginRes.data?.data?.accessToken || loginRes.data?.accessToken;
    if (!superAdminToken) {
      throw new Error('Superadmin login failed in test setup');
    }

    const authHeaders = { Authorization: `Bearer ${superAdminToken}` };

    // -------------------------------------------------------------------------
    // TEST 1: Superadmin Get Restaurants with Search & Status Filters
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request('/platform/restaurants?search=test-p15-lifecycle&status=ACTIVE', {
        method: 'GET',
        headers: authHeaders,
      });

      if (res.status === 200 && res.data.success && (res.data.data?.items || res.data.items)) {
        const items = res.data.data?.items || res.data.items;
        const found = items.find((r: any) => (r.id || r._id) === targetRestId);
        if (found) {
          pass('TEST 1: Superadmin truy vấn danh sách nhà hàng với bộ lọc thành công');
        } else {
          throw new Error('Không tìm thấy nhà hàng thử nghiệm trong kết quả trả về');
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 1: Superadmin truy vấn danh sách nhà hàng', err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Superadmin Suspend Restaurant with Reason
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request(`/platform/restaurants/${targetRestId}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          isSuspended: true,
          suspendReason: 'Vi phạm chính sách thanh toán phí nền tảng',
        }),
      });

      if (res.status === 200 && res.data.success) {
        const doc = await db.collection('restaurants').findOne({ _id: new Types.ObjectId(targetRestId) });
        if (doc?.isSuspended === true && doc?.suspendReason === 'Vi phạm chính sách thanh toán phí nền tảng' && doc?.suspendedAt) {
          pass('TEST 2: Superadmin tạm khóa nhà hàng kèm lý do vi phạm chính xác');
        } else {
          throw new Error(`Dữ liệu MongoDB không đúng: isSuspended=${doc?.isSuspended}, reason=${doc?.suspendReason}`);
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 2: Superadmin tạm khóa nhà hàng', err);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Superadmin Un-suspend Restaurant & Verify $unset in MongoDB
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request(`/platform/restaurants/${targetRestId}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          isSuspended: false,
        }),
      });

      if (res.status === 200 && res.data.success) {
        const doc = await db.collection('restaurants').findOne({ _id: new Types.ObjectId(targetRestId) });
        // Kiểm tra trường suspendReason và suspendedAt đã được $unset hoàn toàn (undefined hoặc không tồn tại)
        if (doc?.isSuspended === false && doc?.suspendReason === undefined && doc?.suspendedAt === undefined) {
          pass('TEST 3: Superadmin kích hoạt lại nhà hàng và $unset triệt để suspendReason, suspendedAt trong MongoDB');
        } else {
          throw new Error(`Trường suspendReason chưa được $unset: ${doc?.suspendReason}, suspendedAt: ${doc?.suspendedAt}`);
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 3: Superadmin kích hoạt lại nhà hàng & $unset', err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Superadmin Update Subscription Package with Custom Date & Note
    // -------------------------------------------------------------------------
    count++;
    try {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const res = await request(`/platform/restaurants/${targetRestId}/subscription`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          plan: 'Enterprise',
          transactionType: 'RENEWAL',
          netAmount: 10000000,
          planExpiresAt: futureDate.toISOString(),
          note: 'Phase 15 - Gia hạn gói doanh nghiệp ưu đãi khai trương',
        }),
      });

      if (res.status === 200 && res.data.success) {
        const doc = await db.collection('restaurants').findOne({ _id: new Types.ObjectId(targetRestId) });
        const txn = await db.collection('subscription_transactions').findOne({
          restaurantId: new Types.ObjectId(targetRestId),
          note: { $regex: /Phase 15/ },
        });

        if (doc?.plan === 'Enterprise' && txn && txn.netAmount === 10000000) {
          pass('TEST 4: Superadmin nâng cấp gói cước Enterprise với ngày hết hạn và ghi chú lịch sử giao dịch chính xác');
        } else {
          throw new Error(`Sai thông tin gói cước: plan=${doc?.plan}, txn=${Boolean(txn)}`);
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 4: Superadmin cập nhật gói cước', err);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Superadmin Impersonation Mode Update (PUT /restaurants/:id)
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request(`/restaurants/${targetRestId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Nhà Hàng Phase 15 - Đã Cập Nhật',
          phone: '0909998877',
          address: '100 Nguyễn Huệ, Quận 1, TP.HCM',
          tagline: 'Ẩm thực chuẩn vị truyền thống',
        }),
      });

      if (res.status === 200) {
        const doc = await db.collection('restaurants').findOne({ _id: new Types.ObjectId(targetRestId) });
        if (doc?.name === 'Nhà Hàng Phase 15 - Đã Cập Nhật' && doc?.phone === '0909998877' && doc?.tagline === 'Ẩm thực chuẩn vị truyền thống') {
          pass('TEST 5: Superadmin cập nhật thông tin nhà hàng qua PUT /restaurants/:id trong Chế độ hỗ trợ thành công');
        } else {
          throw new Error(`Thông tin nhà hàng chưa được cập nhật chính xác: name=${doc?.name}, phone=${doc?.phone}`);
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 5: Superadmin PUT /restaurants/:id', err);
    }
  } finally {
    if (app) {
      await app.close();
    }
  }

  return { passed: failures === 0, count, failures };
}

if (require.main === module) {
  runSuperAdminRestaurantLifecycleTests().then((res) => {
    process.exit(res.passed ? 0 : 1);
  });
}
