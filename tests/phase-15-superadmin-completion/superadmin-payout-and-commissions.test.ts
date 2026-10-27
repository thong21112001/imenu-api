import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { getTestNumberSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3153;
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

export async function runSuperAdminPayoutAndCommissionsTests(): Promise<{ passed: boolean; count: number; failures: number }> {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 15 Suite 3: Platform Commissions Ledger & Atomic Payout Batches (Port ${TEST_PORT}) ${colors.reset}`);
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
    await db.collection('commission_ledgers').deleteMany({ ledgerCode: { $regex: /^COM-P15-/ } });
    await db.collection('users').deleteMany({ email: { $regex: /@test-comm-p15\.vn$/ } });

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

    // Superadmin User
    await db.collection('users').insertOne({
      fullName: 'Super Admin Commissions Audit',
      email: 'superadmin@test-comm-p15.vn',
      password: hashedPassword,
      role: superAdminRole!._id,
      isSuperAdmin: true,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Beneficiary Sales Rep User
    const salesRepRes = await db.collection('users').insertOne({
      fullName: 'Hoàng Thụ Hưởng NVKD P15',
      email: 'nvkd.payout@test-comm-p15.vn',
      password: hashedPassword,
      role: salesRole!._id,
      isSuperAdmin: false,
      referralCode: 'SALES_PAYOUT_15',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const salesRepId = salesRepRes.insertedId;

    // Login as Superadmin
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'superadmin@test-comm-p15.vn',
        password: testPassword,
      }),
    });
    const superAdminToken = loginRes.data?.data?.accessToken || loginRes.data?.accessToken;
    if (!superAdminToken) {
      throw new Error('Superadmin login failed in commissions test setup');
    }
    const authHeaders = { Authorization: `Bearer ${superAdminToken}` };

    // Seed 3 commission ledgers
    const ledger1Res = await db.collection('commission_ledgers').insertOne({
      ledgerCode: 'COM-P15-001',
      salesId: salesRepId,
      commissionType: 'SETUP',
      sourceType: 'RESTAURANT_SETUP',
      baseAmount: 10000000,
      appliedRate: 50,
      commissionAmount: 5000000,
      status: 'PENDING',
      formulaSnapshot: '50% x 10,000,000đ',
      payoutPeriod: '2026-10-20',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const ledger1Id = ledger1Res.insertedId.toString();

    const ledger2Res = await db.collection('commission_ledgers').insertOne({
      ledgerCode: 'COM-P15-002',
      salesId: salesRepId,
      commissionType: 'RENEWAL',
      sourceType: 'SAAS_RENEWAL',
      baseAmount: 5000000,
      appliedRate: 20,
      commissionAmount: 1000000,
      status: 'PENDING',
      formulaSnapshot: '20% x 5,000,000đ',
      payoutPeriod: '2026-10-20',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const ledger2Id = ledger2Res.insertedId.toString();

    const ledger3Res = await db.collection('commission_ledgers').insertOne({
      ledgerCode: 'COM-P15-003',
      salesId: salesRepId,
      commissionType: 'ACTIVATION_BONUS',
      sourceType: 'RESTAURANT_ACTIVATION',
      baseAmount: 0,
      appliedRate: 0,
      commissionAmount: 200000,
      status: 'PENDING',
      formulaSnapshot: 'Thưởng kích hoạt quán chuẩn',
      payoutPeriod: '2026-10-20',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const ledger3Id = ledger3Res.insertedId.toString();

    // -------------------------------------------------------------------------
    // TEST 1: Superadmin Queries Platform Commissions (GET /platform/commissions)
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request('/platform/commissions?status=PENDING&payoutPeriod=2026-10-20&page=1&limit=10', {
        method: 'GET',
        headers: authHeaders,
      });

      if (res.status === 200 && res.data.success && res.data.data) {
        const data = res.data.data;
        const items = data.items || [];
        const found = items.find((i: any) => (i.id || i._id) === ledger1Id);

        if (found && data.total >= 3 && found.salesId?.fullName === 'Hoàng Thụ Hưởng NVKD P15') {
          pass('TEST 1: Superadmin truy vấn toàn bộ hoa hồng nền tảng theo kỳ đối soát & trạng thái thành công');
        } else {
          throw new Error(`Dữ liệu hoa hồng không đúng: total=${data.total}, found=${Boolean(found)}`);
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 1: Superadmin GET /platform/commissions', err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Superadmin Batch Approval (POST /platform/commissions/payout-batch: APPROVE)
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request('/platform/commissions/payout-batch', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ledgerIds: [ledger1Id, ledger2Id],
          action: 'APPROVE',
        }),
      });

      if ([200, 201].includes(res.status) && res.data.success) {
        const docs = await db.collection('commission_ledgers')
          .find({ _id: { $in: [new Types.ObjectId(ledger1Id), new Types.ObjectId(ledger2Id)] } })
          .toArray();

        const allApproved = docs.every((d) => d.status === 'APPROVED');
        if (allApproved && docs.length === 2) {
          pass('TEST 2: Superadmin phê duyệt hàng loạt hoa hồng (APPROVE) chuyển trạng thái thành công');
        } else {
          throw new Error('Các khoản hoa hồng chưa chuyển sang trạng thái APPROVED');
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 2: Phê duyệt hàng loạt hoa hồng', err);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Superadmin Batch Payout Confirmation (POST /platform/commissions/payout-batch: PAY)
    // -------------------------------------------------------------------------
    count++;
    try {
      const res = await request('/platform/commissions/payout-batch', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ledgerIds: [ledger1Id, ledger2Id],
          action: 'PAY',
          payoutReference: 'MB_P15_BATCH_01',
        }),
      });

      if ([200, 201].includes(res.status) && res.data.success) {
        const docs = await db.collection('commission_ledgers')
          .find({ _id: { $in: [new Types.ObjectId(ledger1Id), new Types.ObjectId(ledger2Id)] } })
          .toArray();

        const allPaid = docs.every((d) => d.status === 'PAID' && d.payoutReference === 'MB_P15_BATCH_01' && d.paidAt);
        if (allPaid && docs.length === 2) {
          pass('TEST 3: Superadmin chốt thanh toán (PAY) kèm mã tham chiếu chuyển khoản thành công');
        } else {
          throw new Error('Các khoản hoa hồng chưa chuyển sang PAID kèm mã đối soát');
        }
      } else {
        throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 3: Chốt thanh toán hoa hồng', err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Atomic Double-Payout Prevention
    // -------------------------------------------------------------------------
    count++;
    try {
      // Gọi lại thanh toán trên các khoản đã PAID
      const res = await request('/platform/commissions/payout-batch', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ledgerIds: [ledger1Id, ledger2Id],
          action: 'PAY',
          payoutReference: 'MB_DUPLICATE_PAYOUT_ATTEMPT',
        }),
      });

      // Hệ thống phải xử lý an toàn (processedCount = 0 hoặc báo lỗi) và không được ghi đè payoutReference
      const docs = await db.collection('commission_ledgers')
        .find({ _id: { $in: [new Types.ObjectId(ledger1Id), new Types.ObjectId(ledger2Id)] } })
        .toArray();

      const refPreserved = docs.every((d) => d.payoutReference === 'MB_P15_BATCH_01');
      if (refPreserved) {
        pass('TEST 4: Cơ chế nguyên tử chống chi trả đúp (Double-Payout Prevention) bảo vệ an toàn 100%');
      } else {
        throw new Error('Mã tham chiếu ban đầu bị ghi đè sau lần gọi thanh toán thứ hai');
      }
    } catch (err: any) {
      failures++;
      fail('TEST 4: Chống chi trả đúp hoa hồng', err);
    }
  } finally {
    if (app) {
      await app.close();
    }
  }

  return { passed: failures === 0, count, failures };
}

if (require.main === module) {
  runSuperAdminPayoutAndCommissionsTests().then((res) => {
    process.exit(res.passed ? 0 : 1);
  });
}
