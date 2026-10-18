import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';

const TEST_PORT = 3139;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 13 Suite 3: Sales Reps & Atomic Commission Payout Batch (Port ${TEST_PORT}) ${colors.reset}`);
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

    let salesRole = await db.collection('roles').findOne({ slug: 'sales_rep' });
    if (!salesRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'Sales Rep',
        slug: 'sales_rep',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      salesRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    // 2. Clean test records
    await db.collection('users').deleteMany({ email: /.*@test-sales-p13\.vn/ });
    await db.collection('sales_applications').deleteMany({ email: /.*@test-sales-p13\.vn/ });
    await db.collection('commission_ledgers').deleteMany({ ledgerCode: /^COM-PAYOUT-/ });

    const hashedPassword = await bcrypt.hash('Test@123456', 10);

    // Seed SuperAdmin
    const superAdminId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: superAdminId,
      username: 'superadmin_sales_p13',
      email: 'superadmin@test-sales-p13.vn',
      fullName: 'Super Admin Sales',
      phone: '0908000001',
      password: hashedPassword,
      role: superRole!._id,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Restaurant Admin (non-superadmin)
    const ownerId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: ownerId,
      username: 'owner_sales_p13',
      email: 'owner@test-sales-p13.vn',
      fullName: 'Owner Test Sales',
      phone: '0908000002',
      password: hashedPassword,
      role: ownerRole!._id,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Candidate Application
    const candidateAppId = new Types.ObjectId();
    await db.collection('sales_applications').insertOne({
      _id: candidateAppId,
      fullName: 'Nguyễn Văn Ứng Tuyển',
      email: 'candidate@test-sales-p13.vn',
      phone: '0988776655',
      coverLetter: 'Tôi có 3 năm kinh nghiệm sales F&B',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed 3 Commission Ledgers
    const ledger1Id = new Types.ObjectId();
    const ledger2Id = new Types.ObjectId();
    const ledger3Id = new Types.ObjectId();
    const testSalesId = new Types.ObjectId();
    const now = new Date();

    await db.collection('commission_ledgers').insertMany([
      {
        _id: ledger1Id,
        ledgerCode: 'COM-PAYOUT-01',
        salesId: testSalesId,
        commissionType: 'SETUP_COMMISSION',
        commissionRate: 50,
        orderTotalAmount: 3000000,
        commissionAmount: 1500000,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: ledger2Id,
        ledgerCode: 'COM-PAYOUT-02',
        salesId: testSalesId,
        commissionType: 'RENEWAL_COMMISSION',
        commissionRate: 20,
        orderTotalAmount: 4000000,
        commissionAmount: 800000,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: ledger3Id,
        ledgerCode: 'COM-PAYOUT-03',
        salesId: testSalesId,
        commissionType: 'SETUP_COMMISSION',
        commissionRate: 50,
        orderTotalAmount: 2400000,
        commissionAmount: 1200000,
        status: 'APPROVED',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Login SuperAdmin
    const loginSuper = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@test-sales-p13.vn', password: 'Test@123456' }),
    });
    const superToken = loginSuper.data?.data?.accessToken;

    // Login Owner
    const loginOwner = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@test-sales-p13.vn', password: 'Test@123456' }),
    });
    const ownerToken = loginOwner.data?.data?.accessToken;

    // -------------------------------------------------------------------------
    // TEST 1: POST /api/platform/sales-reps (Tạo mới NVKD với chính sách tùy chỉnh)
    // -------------------------------------------------------------------------
    const resCreateRep = await request('/platform/sales-reps', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        fullName: 'Trần Văn Kinh Doanh',
        email: 'sales_rep_new@test-sales-p13.vn',
        phone: '0977112233',
        password: 'Password@2026',
        referralCode: 'SALES_TOP_99',
        setupCommissionRate: 55,
        renewalCommissionRate: 25,
        payoutBankAccount: {
          bankName: 'MBBank',
          accountNumber: '999988887777',
          accountHolder: 'TRAN VAN KINH DOANH',
        },
      }),
    });

    const createdRepId = resCreateRep.data?.data?.id;

    if (
      resCreateRep.status === 201 &&
      resCreateRep.data?.success === true &&
      resCreateRep.data?.data?.referralCode === 'SALES_TOP_99' &&
      resCreateRep.data?.data?.salesCommissionPolicy?.setupCommissionRate === 55 &&
      resCreateRep.data?.data?.salesCommissionPolicy?.renewalCommissionRate === 25
    ) {
      pass('TEST 1: POST /api/platform/sales-reps khởi tạo NVKD với chính sách hoa hồng cá nhân hóa thành công');
      passed++;
    } else {
      fail('TEST 1: Khởi tạo NVKD thất bại', resCreateRep);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 2: PATCH /api/platform/sales-reps/:id (Cập nhật chính sách & ngân hàng)
    // -------------------------------------------------------------------------
    const resUpdateRep = await request(`/platform/sales-reps/${createdRepId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        setupCommissionRate: 60,
        payoutBankAccount: {
          bankName: 'Vietcombank',
          accountNumber: '0071000123456',
        },
      }),
    });

    if (
      resUpdateRep.status === 200 &&
      resUpdateRep.data?.data?.salesCommissionPolicy?.setupCommissionRate === 60 &&
      resUpdateRep.data?.data?.payoutBankAccount?.bankName === 'Vietcombank'
    ) {
      pass('TEST 2: PATCH /api/platform/sales-reps/:id cập nhật chính sách hoa hồng Setup 60% và tài khoản Vietcombank thành công');
      passed++;
    } else {
      fail('TEST 2: Cập nhật NVKD thất bại', resUpdateRep);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 3: Duyệt đơn ứng tuyển đối tác & tự động tạo tài khoản NVKD
    // -------------------------------------------------------------------------
    const resGetApps = await request('/platform/sales-applications', {
      headers: { Authorization: `Bearer ${superToken}` },
    });

    const targetApp = (resGetApps.data?.data || []).find((a: any) => a._id === candidateAppId.toString());

    const resApproveApp = await request(`/platform/sales-applications/${candidateAppId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}` },
    });

    const approvedUser = await db.collection('users').findOne({ email: 'candidate@test-sales-p13.vn' });
    const updatedApp = await db.collection('sales_applications').findOne({ _id: candidateAppId });

    if (
      targetApp &&
      (resApproveApp.status === 200 || resApproveApp.status === 201) &&
      resApproveApp.data?.success === true &&
      approvedUser &&
      approvedUser.role?.toString() === salesRole!._id.toString() &&
      approvedUser.referralCode &&
      updatedApp?.status === 'APPROVED'
    ) {
      pass(`TEST 3: Phê duyệt đơn ứng tuyển thành công, tự sinh tài khoản NVKD với mã giới thiệu ${approvedUser.referralCode}`);
      passed++;
    } else {
      fail('TEST 3: Duyệt đơn ứng tuyển thất bại', { resGetApps, resApproveApp, approvedUser, updatedApp });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 4: GET /api/platform/sales-reps (Danh sách NVKD kèm thống kê)
    // -------------------------------------------------------------------------
    const resListReps = await request('/platform/sales-reps', {
      headers: { Authorization: `Bearer ${superToken}` },
    });

    const listReps = resListReps.data?.data;
    const foundCreatedRep = (listReps || []).find((r: any) => r.id === createdRepId);

    if (
      resListReps.status === 200 &&
      Array.isArray(listReps) &&
      listReps.length >= 2 &&
      foundCreatedRep &&
      foundCreatedRep.stats !== undefined &&
      foundCreatedRep.password === undefined
    ) {
      pass('TEST 4: GET /api/platform/sales-reps trả về danh sách NVKD đầy đủ thống kê và bảo mật không rò rỉ mật khẩu');
      passed++;
    } else {
      fail('TEST 4: Danh sách NVKD sai lệch', { resListReps, listReps });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 5: AUD-13.3 - Phê duyệt hoa hồng theo đợt (action: 'APPROVE')
    // -------------------------------------------------------------------------
    const resApproveBatch = await request('/platform/commission/payout-batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        action: 'APPROVE',
        ledgerIds: [ledger1Id.toString(), ledger2Id.toString()],
      }),
    });

    const l1AfterApprove = await db.collection('commission_ledgers').findOne({ _id: ledger1Id });
    const l2AfterApprove = await db.collection('commission_ledgers').findOne({ _id: ledger2Id });

    const approveCount = resApproveBatch.data?.processedCount ?? resApproveBatch.data?.data?.processedCount;
    if (
      (resApproveBatch.status === 200 || resApproveBatch.status === 201) &&
      approveCount === 2 &&
      l1AfterApprove?.status === 'APPROVED' &&
      l2AfterApprove?.status === 'APPROVED'
    ) {
      pass('TEST 5: AUD-13.3 Batch APPROVE chuyển đổi thành công 2 khoản hoa hồng từ PENDING -> APPROVED');
      passed++;
    } else {
      fail('TEST 5: Batch APPROVE thất bại', { resApproveBatch, l1AfterApprove, l2AfterApprove });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 6: AUD-13.3 - Chi trả hoa hồng theo đợt & Kiểm tra tính lũy đẳng (IDEMPOTENCY)
    // -------------------------------------------------------------------------
    const payoutRef = `BATCH-P13-${Date.now()}`;
    const resPayBatch = await request('/platform/commission/payout-batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        action: 'PAY',
        ledgerIds: [ledger1Id.toString(), ledger2Id.toString(), ledger3Id.toString()],
        payoutReference: payoutRef,
      }),
    });

    const l1AfterPay = await db.collection('commission_ledgers').findOne({ _id: ledger1Id });
    const l2AfterPay = await db.collection('commission_ledgers').findOne({ _id: ledger2Id });
    const l3AfterPay = await db.collection('commission_ledgers').findOne({ _id: ledger3Id });

    // Gọi lại đợt thanh toán với cùng ledgerIds để kiểm tra Idempotency
    const resPayBatchIdempotent = await request('/platform/commission/payout-batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        action: 'PAY',
        ledgerIds: [ledger1Id.toString(), ledger2Id.toString(), ledger3Id.toString()],
        payoutReference: payoutRef,
      }),
    });

    const payCount = resPayBatch.data?.processedCount ?? resPayBatch.data?.data?.processedCount;
    const rePayCount = resPayBatchIdempotent.data?.processedCount ?? resPayBatchIdempotent.data?.data?.processedCount;

    if (
      (resPayBatch.status === 200 || resPayBatch.status === 201) &&
      payCount === 3 &&
      l1AfterPay?.status === 'PAID' &&
      l1AfterPay?.payoutReference === payoutRef &&
      l2AfterPay?.status === 'PAID' &&
      l3AfterPay?.status === 'PAID' &&
      (resPayBatchIdempotent.status === 200 || resPayBatchIdempotent.status === 201) &&
      rePayCount === 0 // 0 bản ghi được chi trả lại!
    ) {
      pass('TEST 6: AUD-13.3 Batch PAY xác nhận chi trả 3 khoản hoa hồng thành công và kiểm tra Lũy đẳng (Idempotent: 0 records re-processed) chống chi trả trùng lặp');
      passed++;
    } else {
      fail('TEST 6: AUD-13.3 Payout Batch hoặc tính lũy đẳng thất bại', {
        resPayBatch,
        resPayBatchIdempotent,
        l1AfterPay,
      });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 7: AUD-13.1 - Privilege Boundary Chặn non-superadmin
    // -------------------------------------------------------------------------
    const resBlockRep = await request('/platform/sales-reps', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const resBlockPayout = await request('/platform/commission/payout-batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ action: 'APPROVE', ledgerIds: [ledger1Id.toString()] }),
    });

    if (resBlockRep.status === 403 && resBlockPayout.status === 403) {
      pass('TEST 7: AUD-13.1 Strict Privilege Boundary chặn tuyệt đối quyền quản lý NVKD và cổng chi trả hoa hồng trước tài khoản thường');
      passed++;
    } else {
      fail('TEST 7: Lỗ hổng bảo mật phân quyền NVKD/Payout', { resBlockRep, resBlockPayout });
      failed++;
    }

  } catch (err: any) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    if (app) await app.close();
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Kết quả Test Suite 3: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------------------------------\n');
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
