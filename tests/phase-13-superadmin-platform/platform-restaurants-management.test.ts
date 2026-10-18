import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { getTestNumberSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3137;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 13 Suite 1: Platform Restaurants & Strict Superadmin Boundary (Port ${TEST_PORT}) ${colors.reset}`);
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

    // Clean test data
    await db.collection('restaurants').deleteMany({ slug: { $regex: /^test-p13-/ } });
    await db.collection('users').deleteMany({ email: { $regex: /@test-p13\.vn$/ } });
    await db.collection('subscription_transactions').deleteMany({});
    await db.collection('commission_ledgers').deleteMany({});

    // Find or create roles
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
        name: 'Sales Rep',
        slug: 'sales_rep',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      salesRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(getTestNumberSecret(), salt);

    // Seed 1 Superadmin
    const superAdminId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: superAdminId,
      username: 'superadmin_p13',
      email: 'superadmin@test-p13.vn',
      fullName: 'Super Administrator',
      phone: '0901000001',
      password: hashedPassword,
      role: superAdminRole!._id,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed 1 Sales Rep
    const salesId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: salesId,
      username: 'sales_p13',
      email: 'sales@test-p13.vn',
      fullName: 'Sales Partner',
      phone: '0901000002',
      password: hashedPassword,
      role: salesRole!._id,
      status: 'ACTIVE',
      isRoleActive: true,
      referralCode: 'SALES_P13',
      tokenVersion: 1,
      salesCommissionPolicy: {
        setupCommissionRate: 50,
        renewalCommissionRate: 20,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed 1 Restaurant with Owner
    const restaurantId = new Types.ObjectId();
    const branchId = new Types.ObjectId();
    await db.collection('restaurants').insertOne({
      _id: restaurantId,
      name: 'Test P13 Phở Ngon',
      slug: 'test-p13-pho-ngon',
      phone: '0901000003',
      address: '123 Test Street, Hanoi',
      plan: 'Basic',
      subscriptionStatus: 'TRIAL',
      isSuspended: false,
      referredBySalesId: salesId,
      referralCodeUsed: 'SALES_P13',
      branches: [
        {
          _id: branchId,
          name: 'Chi nhánh 1',
          address: '123 Test Street',
          phone: '0901000003',
          isMainBranch: true,
          isOpen: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ownerId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: ownerId,
      username: 'owner_p13',
      email: 'owner@test-p13.vn',
      fullName: 'Chủ Quán Phở',
      phone: '0901000003',
      password: hashedPassword,
      role: ownerRole!._id,
      restaurantId,
      branchId: branchId.toString(),
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Login SuperAdmin
    const loginSuper = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@test-p13.vn', password: getTestNumberSecret() }),
    });
    const superToken = loginSuper.data?.data?.accessToken;

    // Login Owner
    const loginOwner = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@test-p13.vn', password: getTestNumberSecret() }),
    });
    const ownerToken = loginOwner.data?.data?.accessToken;

    // Login Sales Rep
    const loginSales = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'sales@test-p13.vn', password: getTestNumberSecret() }),
    });
    const salesToken = loginSales.data?.data?.accessToken;

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/platform/overview (Superadmin KPI)
    // -------------------------------------------------------------------------
    const resOverview = await request('/platform/overview', {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    if (
      resOverview.status === 200 &&
      resOverview.data?.success === true &&
      resOverview.data?.data?.kpi?.totalRestaurants >= 1 &&
      resOverview.data?.data?.kpi?.statusBreakdown
    ) {
      pass('TEST 1: GET /api/platform/overview trả về đầy đủ KPI toàn sàn và cấu trúc status breakdown');
      passed++;
    } else {
      fail('TEST 1: GET /api/platform/overview thất bại', resOverview);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/platform/restaurants (Danh sách nhà hàng phân trang)
    // -------------------------------------------------------------------------
    const resRestaurants = await request('/platform/restaurants?search=test-p13', {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const targetRest = resRestaurants.data?.items?.find((r: any) => r.slug === 'test-p13-pho-ngon');
    if (
      resRestaurants.status === 200 &&
      targetRest &&
      targetRest.branchesCount === 1 &&
      targetRest.staffCount === 1 &&
      targetRest.owner?.email === 'owner@test-p13.vn' &&
      targetRest.referredBySales?.referralCode === 'SALES_P13'
    ) {
      pass('TEST 2: GET /api/platform/restaurants tổng hợp chính xác quy mô chi nhánh, nhân sự, chủ quán và NVKD');
      passed++;
    } else {
      fail('TEST 2: GET /api/platform/restaurants sai thông tin liên kết', { resRestaurants, targetRest });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 3: AUD-13.1 - Chặn Non-Superadmin truy cập /api/platform/*
    // -------------------------------------------------------------------------
    const resOwnerBlock = await request('/platform/overview', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const resSalesBlock = await request('/platform/restaurants', {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const resAnonBlock = await request('/platform/overview');

    if (
      resOwnerBlock.status === 403 &&
      resSalesBlock.status === 403 &&
      resAnonBlock.status === 401
    ) {
      pass('TEST 3: AUD-13.1 Strict Privilege Boundary chặn đứng 100% restaurant_admin, sales_rep và anon (403/401)');
      passed++;
    } else {
      fail('TEST 3: AUD-13.1 Privilege Boundary bị hổng!', { resOwnerBlock, resSalesBlock, resAnonBlock });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 4: AUD-13.2 - SuperAdmin tạm khóa nhà hàng (isSuspended: true) & chặn tức thì
    // -------------------------------------------------------------------------
    const resSuspend = await request(`/platform/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        isSuspended: true,
        suspendReason: 'Nghi vấn gian lận giao dịch',
      }),
    });

    // Kiểm tra nhân sự quán gọi API với token hiện tại có bị chặn ngay lập tức không
    const resOwnerOp = await request('/auth/me', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    if (
      resSuspend.status === 200 &&
      resSuspend.data?.data?.isSuspended === true &&
      resSuspend.data?.data?.subscriptionStatus === 'SUSPENDED' &&
      (resOwnerOp.status === 401 || resOwnerOp.status === 403)
    ) {
      pass(`TEST 4: AUD-13.2 Immediate Suspension chặn đứng tức thì JWT đang hoạt động của nhân sự nhà hàng bị khóa (${resOwnerOp.status})`);
      passed++;
    } else {
      fail('TEST 4: AUD-13.2 Suspension không chặn được phiên làm việc', { resSuspend, resOwnerOp });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 5: SuperAdmin mở khóa nhà hàng (isSuspended: false)
    // -------------------------------------------------------------------------
    const resUnsuspend = await request(`/platform/restaurants/${restaurantId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ isSuspended: false }),
    });

    // Login lại để nhận token mới (vì tokenVersion đã được bump khi khóa)
    const reLoginOwner = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@test-p13.vn', password: getTestNumberSecret() }),
    });
    const newOwnerToken = reLoginOwner.data?.data?.accessToken;

    const resOwnerOpAfter = await request('/auth/me', {
      headers: { Authorization: `Bearer ${newOwnerToken}` },
    });

    if (
      resUnsuspend.status === 200 &&
      resUnsuspend.data?.data?.isSuspended === false &&
      resOwnerOpAfter.status === 200
    ) {
      pass('TEST 5: Superadmin mở khóa nhà hàng thành công và nhân sự đăng nhập vận hành trở lại bình thường');
      passed++;
    } else {
      fail('TEST 5: Mở khóa nhà hàng thất bại', { resUnsuspend, resOwnerOpAfter });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 6: Nâng cấp gói cước Pro & Tự động ghi sổ hoa hồng 50% cho NVKD
    // -------------------------------------------------------------------------
    const resUpgrade = await request(`/platform/restaurants/${restaurantId}/subscription`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        plan: 'Pro',
        billingCycle: 'YEARLY',
        transactionType: 'INITIAL_SETUP',
        netAmount: 4800000,
      }),
    });

    const updatedRest = await db.collection('restaurants').findOne({ _id: restaurantId });
    const subTx = await db.collection('subscription_transactions').findOne({ restaurantId });
    const comLedger = await db.collection('commission_ledgers').findOne({
      restaurantId,
      commissionType: 'SETUP_COMMISSION',
    });

    if (
      resUpgrade.status === 200 &&
      updatedRest?.plan === 'Pro' &&
      updatedRest?.subscriptionStatus === 'ACTIVE_PAID' &&
      subTx?.netAmount === 4800000 &&
      comLedger?.salesId?.toString() === salesId.toString() &&
      comLedger?.commissionAmount === 2400000 && // 50% của 4.800.000₫
      comLedger?.status === 'PENDING'
    ) {
      pass('TEST 6: Nâng cấp gói Pro thành công và tự động ghi sổ hoa hồng Setup 50% (2.400.000₫) cho NVKD phụ trách');
      passed++;
    } else {
      fail('TEST 6: Nâng cấp gói hoặc sinh hoa hồng sai', { resUpgrade, updatedRest, subTx, comLedger });
      failed++;
    }

  } catch (err: any) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    if (app) await app.close();
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Kết quả Test Suite 1: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------------------------------\n');
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
