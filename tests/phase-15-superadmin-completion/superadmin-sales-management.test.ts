import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { getTestNumberSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3152;
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

export async function runSuperAdminSalesManagementTests(): Promise<{ passed: boolean; count: number; failures: number }> {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 15 Suite 2: Superadmin Sales Reps & Commission Policy Sync (Port ${TEST_PORT}) ${colors.reset}`);
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
    await db.collection('users').deleteMany({ email: { $regex: /@test-sales-p15\.vn$/ } });
    await db.collection('sales_applications').deleteMany({ email: { $regex: /@test-sales-p15\.vn$/ } });

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

    const testPassword = getTestNumberSecret();
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Create Superadmin User
    await db.collection('users').insertOne({
      fullName: 'Super Admin Sales Manager',
      email: 'superadmin@test-sales-p15.vn',
      password: hashedPassword,
      role: superAdminRole!._id,
      isSuperAdmin: true,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Login as Superadmin
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'superadmin@test-sales-p15.vn',
        password: testPassword,
      }),
    });
    const superAdminToken = loginRes.data?.data?.accessToken || loginRes.data?.accessToken;
    if (!superAdminToken) {
      throw new Error('Superadmin login failed in sales test setup');
    }

    const authHeaders = { Authorization: `Bearer ${superAdminToken}` };
    let createdSalesId = '';

    // -------------------------------------------------------------------------
    // TEST 1: Superadmin Creates Sales Rep with Custom Commission Policies
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request('/platform/sales-reps', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          fullName: 'Nguyễn Văn Kinh Doanh P15',
          email: 'nvkd1@test-sales-p15.vn',
          phone: '0933445566',
          referralCode: 'SALES_P15_01',
          setupCommissionRate: 60,
          renewalCommissionRate: 25,
          activationBonusAmount: 100000,
          teamBonusAmount: 50000,
          payoutBankAccount: {
            bankName: 'MB Bank',
            accountNo: '098877665544',
            accountName: 'NGUYEN VAN KINH DOANH P15',
          },
        }),
      });

      if (res.status === 201 && res.data.success) {
        const rep = res.data.data;
        createdSalesId = rep.id || rep._id;
        const userDoc = await db.collection('users').findOne({ _id: new Types.ObjectId(createdSalesId) });

        if (
          userDoc?.salesCommissionPolicy?.setupCommissionRate === 60 &&
          userDoc?.salesCommissionPolicy?.renewalCommissionRate === 25 &&
          userDoc?.payoutBankAccount?.accountNo === '098877665544'
        ) {
          pass('TEST 1: Superadmin tạo thành công NVKD mới kèm chính sách hoa hồng & tài khoản thụ hưởng');
        } else {
          throw new Error('Chính sách hoa hồng hoặc thông tin ngân hàng trong database không khớp');
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 1: Superadmin tạo NVKD mới', err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Superadmin Updates Sales Rep Policies (PATCH /platform/sales-reps/:id)
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request(`/platform/sales-reps/${createdSalesId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          setupCommissionRate: 65,
          renewalCommissionRate: 30,
          payoutBankAccount: {
            bankName: 'Vietcombank',
            accountNo: '112233445566',
            accountName: 'NGUYEN VAN KINH DOANH P15',
          },
        }),
      });

      if (res.status === 200 && res.data.success) {
        const userDoc = await db.collection('users').findOne({ _id: new Types.ObjectId(createdSalesId) });
        if (
          userDoc?.salesCommissionPolicy?.setupCommissionRate === 65 &&
          userDoc?.salesCommissionPolicy?.renewalCommissionRate === 30 &&
          userDoc?.payoutBankAccount?.bankName === 'Vietcombank'
        ) {
          pass('TEST 2: Superadmin cập nhật chính sách hoa hồng và ngân hàng của NVKD thành công');
        } else {
          throw new Error('Dữ liệu cập nhật chưa được lưu vào MongoDB');
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 2: Superadmin cập nhật chính sách NVKD', err);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Superadmin Locks & Unlocks Sales Rep Status
    // -------------------------------------------------------------------------
    count++;
    try {
      // 3a. Lock
      const lockRes = await request(`/platform/sales-reps/${createdSalesId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: 'INACTIVE' }),
      });
      const lockedDoc = await db.collection('users').findOne({ _id: new Types.ObjectId(createdSalesId) });

      // 3b. Unlock
      const unlockRes = await request(`/platform/sales-reps/${createdSalesId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      const unlockedDoc = await db.collection('users').findOne({ _id: new Types.ObjectId(createdSalesId) });

      if (
        lockRes.status === 200 &&
        lockedDoc?.status === 'INACTIVE' &&
        unlockRes.status === 200 &&
        unlockedDoc?.status === 'ACTIVE'
      ) {
        pass('TEST 3: Superadmin tạm khóa và kích hoạt lại tài khoản NVKD thành công');
      } else {
        throw new Error(`Trạng thái không đúng: locked=${lockedDoc?.status}, unlocked=${unlockedDoc?.status}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 3: Superadmin khóa & mở khóa NVKD', err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Sales Applications Lifecycle: Candidate Applies & Superadmin Approves
    // -------------------------------------------------------------------------
    count++;
    try {
      // 4a. Public application
      const applyRes = await request('/referrals/apply', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Lê Ứng Tuyển Sales P15',
          email: 'ungtuyen@test-sales-p15.vn',
          phone: '0944556677',
          city: 'Đà Nẵng',
          note: 'Muốn phát triển thị trường miền Trung',
        }),
      });

      if (applyRes.status !== 201 && applyRes.status !== 200) {
        throw new Error(`Ứng tuyển thất bại: ${JSON.stringify(applyRes.data)}`);
      }

      // 4b. Superadmin queries applications
      const listAppRes = await request('/platform/sales-applications', {
        method: 'GET',
        headers: authHeaders,
      });

      const apps = listAppRes.data?.data || listAppRes.data;
      const foundApp = Array.isArray(apps) && apps.find((a: any) => a.email === 'ungtuyen@test-sales-p15.vn');
      if (!foundApp) {
        throw new Error('Superadmin không tìm thấy đơn ứng tuyển vừa nộp');
      }

      // 4c. Superadmin approves application
      const approveRes = await request(`/platform/sales-applications/${foundApp._id || foundApp.id}/approve`, {
        method: 'POST',
        headers: authHeaders,
      });

      if ([200, 201].includes(approveRes.status) && approveRes.data.success) {
        const newSales = await db.collection('users').findOne({ email: 'ungtuyen@test-sales-p15.vn' });
        if (newSales && newSales.referralCode && newSales.status === 'ACTIVE') {
          pass('TEST 4: Superadmin phê duyệt đơn ứng tuyển NVKD và cấp tài khoản tự động thành công');
        } else {
          throw new Error('NVKD chưa được tạo sau khi duyệt đơn ứng tuyển');
        }
      } else {
        throw new Error(`Duyệt đơn ứng tuyển thất bại: ${JSON.stringify(approveRes.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 4: Quy trình ứng tuyển & phê duyệt NVKD', err);
    }
  } finally {
    if (app) {
      await app.close();
    }
  }

  return { passed: failures === 0, count, failures };
}

if (require.main === module) {
  runSuperAdminSalesManagementTests().then((res) => {
    process.exit(res.passed ? 0 : 1);
  });
}
