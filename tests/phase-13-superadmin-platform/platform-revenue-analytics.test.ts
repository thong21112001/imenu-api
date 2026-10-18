import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { getTestNumberSecret } from '../shared/test-credentials.helper';
import { AppModule } from '../../src/app.module';

const TEST_PORT = 3138;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 13 Suite 2: Platform Revenue Analytics & Dual Net Profit (Port ${TEST_PORT}) ${colors.reset}`);
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

    // 2. Clean up test users / restaurants / orders / subs / ledgers
    await db.collection('users').deleteMany({ email: /.*@test-rev-p13\.vn/ });
    await db.collection('restaurants').deleteMany({ slug: /^test-rev-/ });

    const hashedPassword = await bcrypt.hash(getTestNumberSecret(), 10);

    // Seed SuperAdmin
    const superAdminId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: superAdminId,
      username: 'superadmin_rev_p13',
      email: 'superadmin@test-rev-p13.vn',
      fullName: 'Super Admin Rev',
      phone: '0909000010',
      password: hashedPassword,
      role: superRole!._id,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Sales Rep
    const salesId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: salesId,
      username: 'sales_rev_p13',
      email: 'sales@test-rev-p13.vn',
      fullName: 'Sales Partner Rev',
      phone: '0909000011',
      password: hashedPassword,
      role: salesRole!._id,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      referralCode: 'SALES_REV_P13',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Restaurant A (2 branches)
    const restAId = new Types.ObjectId();
    const branchA1Id = new Types.ObjectId();
    const branchA2Id = new Types.ObjectId();
    await db.collection('restaurants').insertOne({
      _id: restAId,
      name: 'Phở Bò Gia Truyền P13',
      slug: 'test-rev-pho-bo',
      phone: '0909000012',
      address: '100 Nguyễn Huệ, Q1',
      plan: 'Pro',
      subscriptionStatus: 'ACTIVE_PAID',
      isSuspended: false,
      referredBySalesId: salesId,
      branches: [
        {
          _id: branchA1Id,
          name: 'Chi nhánh Quận 1',
          address: '100 Nguyễn Huệ, Q1',
          phone: '0909000012',
          isMainBranch: true,
          isOpen: true,
        },
        {
          _id: branchA2Id,
          name: 'Chi nhánh Quận 3',
          address: '200 Cách Mạng Tháng 8, Q3',
          phone: '0909000013',
          isMainBranch: false,
          isOpen: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Restaurant B (1 branch)
    const restBId = new Types.ObjectId();
    const branchB1Id = new Types.ObjectId();
    await db.collection('restaurants').insertOne({
      _id: restBId,
      name: 'Trà Sữa Matcha P13',
      slug: 'test-rev-tra-sua',
      phone: '0909000014',
      address: '50 Trường Chinh, Tân Bình',
      plan: 'Standard',
      subscriptionStatus: 'ACTIVE_PAID',
      isSuspended: false,
      referredBySalesId: salesId,
      branches: [
        {
          _id: branchB1Id,
          name: 'Chi nhánh Tân Bình',
          address: '50 Trường Chinh, Tân Bình',
          phone: '0909000014',
          isMainBranch: true,
          isOpen: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Owner A
    const ownerAId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: ownerAId,
      username: 'owner_a_rev_p13',
      email: 'owner@test-rev-p13.vn',
      fullName: 'Chủ Quán Phở A',
      phone: '0909000015',
      password: hashedPassword,
      role: ownerRole!._id,
      restaurantId: restAId,
      branchId: branchA1Id.toString(),
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Clean old test orders for these restaurants
    await db.collection('orders').deleteMany({
      $or: [
        { restaurantId: { $in: [restAId, restBId] } },
        { orderCode: { $regex: /^ORD-REV-/ } },
      ],
    });
    await db.collection('subscription_transactions').deleteMany({
      $or: [
        { restaurantId: { $in: [restAId, restBId] } },
        { transactionCode: { $regex: /^SUB-REV-/ } },
      ],
    });
    await db.collection('commission_ledgers').deleteMany({
      $or: [
        { restaurantId: { $in: [restAId, restBId] } },
        { ledgerCode: { $regex: /^COM-REV-/ } },
      ],
    });

    // Seed Orders for Restaurant A
    // Branch Q1: Cash 150,000 + VietQR 250,000 = 400,000
    // Branch Q3: Card 500,000 + Transfer 100,000 = 600,000
    const now = new Date();
    await db.collection('orders').insertMany([
      {
        restaurantId: restAId,
        branchId: branchA1Id.toString(),
        orderNumber: 'REV-01',
        orderCode: 'ORD-REV-01',
        totalAmount: 150000,
        paymentMethod: 'Cash',
        paymentStatus: 'PAID',
        isPaid: true,
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: restAId,
        branchId: branchA1Id.toString(),
        orderNumber: 'REV-02',
        orderCode: 'ORD-REV-02',
        totalAmount: 250000,
        paymentMethod: 'VietQR',
        paymentStatus: 'PAID',
        isPaid: true,
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: restAId,
        branchId: branchA2Id.toString(),
        orderNumber: 'REV-03',
        orderCode: 'ORD-REV-03',
        totalAmount: 500000,
        paymentMethod: 'Card',
        paymentStatus: 'PAID',
        isPaid: true,
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: restAId,
        branchId: branchA2Id.toString(),
        orderNumber: 'REV-04',
        orderCode: 'ORD-REV-04',
        totalAmount: 100000,
        paymentMethod: 'Transfer',
        paymentStatus: 'PAID',
        isPaid: true,
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      },
      // Seed Orders for Restaurant B
      // Branch TB: VietQR 80,000 + Cash 120,000 = 200,000
      {
        restaurantId: restBId,
        branchId: branchB1Id.toString(),
        orderNumber: 'REV-05',
        orderCode: 'ORD-REV-05',
        totalAmount: 80000,
        paymentMethod: 'VietQR',
        paymentStatus: 'PAID',
        isPaid: true,
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: restBId,
        branchId: branchB1Id.toString(),
        orderNumber: 'REV-06',
        orderCode: 'ORD-REV-06',
        totalAmount: 120000,
        paymentMethod: 'Cash',
        paymentStatus: 'PAID',
        isPaid: true,
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Seed SaaS Subscriptions
    // Sub 1: Rest A, INITIAL_SETUP, 5,000,000
    // Sub 2: Rest B, RENEWAL, 3,000,000
    await db.collection('subscription_transactions').insertMany([
      {
        transactionCode: 'SUB-REV-01',
        restaurantId: restAId,
        salesId: salesId,
        plan: 'Pro',
        billingCycle: 'YEARLY',
        transactionType: 'INITIAL_SETUP',
        grossAmount: 5000000,
        netAmount: 5000000,
        paymentStatus: 'PAID',
        createdAt: now,
        updatedAt: now,
      },
      {
        transactionCode: 'SUB-REV-02',
        restaurantId: restBId,
        salesId: salesId,
        plan: 'Standard',
        billingCycle: 'YEARLY',
        transactionType: 'RENEWAL',
        grossAmount: 3000000,
        netAmount: 3000000,
        paymentStatus: 'PAID',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Seed Commission Ledgers
    // Ledger 1: PAID, 2,500,000
    // Ledger 2: APPROVED, 600,000
    // Ledger 3: PENDING, 400,000
    await db.collection('commission_ledgers').insertMany([
      {
        ledgerCode: 'COM-REV-01',
        salesId: salesId,
        restaurantId: restAId,
        commissionType: 'SETUP_COMMISSION',
        commissionRate: 50,
        orderTotalAmount: 5000000,
        commissionAmount: 2500000,
        status: 'PAID',
        createdAt: now,
        updatedAt: now,
      },
      {
        ledgerCode: 'COM-REV-02',
        salesId: salesId,
        restaurantId: restBId,
        commissionType: 'RENEWAL_COMMISSION',
        commissionRate: 20,
        orderTotalAmount: 3000000,
        commissionAmount: 600000,
        status: 'APPROVED',
        createdAt: now,
        updatedAt: now,
      },
      {
        ledgerCode: 'COM-REV-03',
        salesId: salesId,
        restaurantId: restAId,
        commissionType: 'RECURRING_COMMISSION',
        commissionRate: 5,
        orderTotalAmount: 8000000,
        commissionAmount: 400000,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Login SuperAdmin
    const loginSuper = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@test-rev-p13.vn', password: getTestNumberSecret() }),
    });
    const superToken = loginSuper.data?.data?.accessToken;

    // Login Owner
    const loginOwner = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@test-rev-p13.vn', password: getTestNumberSecret() }),
    });
    const ownerToken = loginOwner.data?.data?.accessToken;

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/platform/revenues/restaurants (Toàn sàn GMV theo 4 phương thức)
    // -------------------------------------------------------------------------
    const resGmv = await request('/platform/revenues/restaurants', {
      headers: { Authorization: `Bearer ${superToken}` },
    });

    const gmvData = resGmv.data?.data;
    const restAItem = gmvData?.restaurants?.find((r: any) => r.restaurantId === restAId.toString());
    const restBItem = gmvData?.restaurants?.find((r: any) => r.restaurantId === restBId.toString());

    if (
      resGmv.status === 200 &&
      resGmv.data?.success === true &&
      gmvData &&
      gmvData.isDrillDown === false &&
      restAItem?.totalRevenue === 1000000 &&
      restAItem?.paymentMethods?.Cash === 150000 &&
      restAItem?.paymentMethods?.VietQR === 250000 &&
      restAItem?.paymentMethods?.Card === 500000 &&
      restAItem?.paymentMethods?.Transfer === 100000 &&
      restBItem?.totalRevenue === 200000 &&
      restBItem?.paymentMethods?.VietQR === 80000 &&
      restBItem?.paymentMethods?.Cash === 120000
    ) {
      pass('TEST 1: GET /api/platform/revenues/restaurants tổng hợp GMV chuẩn xác trên 4 phương thức thanh toán (Cash, VietQR, Card, Transfer)');
      passed++;
    } else {
      fail('TEST 1: GET /api/platform/revenues/restaurants sai dữ liệu GMV', { resGmv, restAItem, restBItem });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/platform/revenues/restaurants?restaurantId=... (Drill-down Chi nhánh)
    // -------------------------------------------------------------------------
    const resDrill = await request(`/platform/revenues/restaurants?restaurantId=${restAId.toString()}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });

    const drillData = resDrill.data?.data;
    const branch1 = drillData?.branches?.find((b: any) => b.branchId === branchA1Id.toString());
    const branch2 = drillData?.branches?.find((b: any) => b.branchId === branchA2Id.toString());

    if (
      resDrill.status === 200 &&
      drillData?.isDrillDown === true &&
      drillData?.restaurant?.id === restAId.toString() &&
      drillData?.summary?.totalRevenue === 1000000 &&
      drillData?.summary?.totalOrders === 4 &&
      branch1?.totalRevenue === 400000 &&
      branch1?.paymentMethods?.Cash === 150000 &&
      branch1?.paymentMethods?.VietQR === 250000 &&
      branch2?.totalRevenue === 600000 &&
      branch2?.paymentMethods?.Card === 500000 &&
      branch2?.paymentMethods?.Transfer === 100000
    ) {
      pass('TEST 2: GET /api/platform/revenues/restaurants với restaurantId drill-down chính xác từng chi nhánh và kênh thanh toán');
      passed++;
    } else {
      fail('TEST 2: Drill-down chi nhánh thất bại', { resDrill, drillData, branch1, branch2 });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 3: GET /api/platform/revenues/saas (Doanh thu SaaS & Đối soát lợi nhuận ròng kép)
    // -------------------------------------------------------------------------
    const resSaas = await request('/platform/revenues/saas', {
      headers: { Authorization: `Bearer ${superToken}` },
    });

    const saasSummary = resSaas.data?.data?.summary;
    if (
      resSaas.status === 200 &&
      saasSummary &&
      saasSummary.totalSaaSRevenue >= 8000000 &&
      saasSummary.initialSetupRevenue >= 5000000 &&
      saasSummary.renewalRevenue >= 3000000 &&
      saasSummary.commissions?.paid >= 2500000 &&
      saasSummary.commissions?.approved >= 600000 &&
      saasSummary.commissions?.pending >= 400000 &&
      saasSummary.profits?.accrualNetProfit !== undefined &&
      saasSummary.profits?.cashFlowNetProfit !== undefined &&
      saasSummary.profits.accrualNetProfit === (saasSummary.totalSaaSRevenue - saasSummary.commissions.totalIncurred) &&
      saasSummary.profits.cashFlowNetProfit === (saasSummary.totalSaaSRevenue - saasSummary.commissions.paid)
    ) {
      pass(`TEST 3: GET /api/platform/revenues/saas đối soát chuẩn xác Lợi nhuận ròng kế toán (${saasSummary.profits.accrualNetProfit.toLocaleString()}₫) và Lợi nhuận dòng tiền (${saasSummary.profits.cashFlowNetProfit.toLocaleString()}₫)`);
      passed++;
    } else {
      fail('TEST 3: Đối soát doanh thu SaaS & Lợi nhuận ròng sai lệch', { resSaas, saasSummary });
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 4: AUD-13.1 Strict Security Check on Revenue endpoints
    // -------------------------------------------------------------------------
    const resOwnerGmvBlock = await request('/platform/revenues/restaurants', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const resOwnerSaasBlock = await request('/platform/revenues/saas', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const resAnonGmvBlock = await request('/platform/revenues/restaurants');

    if (
      resOwnerGmvBlock.status === 403 &&
      resOwnerSaasBlock.status === 403 &&
      resAnonGmvBlock.status === 401
    ) {
      pass('TEST 4: AUD-13.1 Strict Privilege Boundary bảo vệ tuyệt đối cổng doanh thu toàn sàn trước restaurant_admin và anon');
      passed++;
    } else {
      fail('TEST 4: Lỗ hổng bảo mật cổng doanh thu', { resOwnerGmvBlock, resOwnerSaasBlock, resAnonGmvBlock });
      failed++;
    }

  } catch (err: any) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    if (app) await app.close();
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Kết quả Test Suite 2: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------------------------------\n');
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
