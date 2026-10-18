import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { SalesService } from '../../src/modules/sales/services/sales.service';

const TEST_PORT = 3135;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 12 Suite 3: 4-Tier Commission Engine & Atomic CAS Concurrency (Port ${TEST_PORT}) ${colors.reset}`);
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
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(TEST_PORT);

    const connection: Connection = app.get(getConnectionToken());
    const salesService = app.get(SalesService);
    const timestamp = Date.now();

    const usersCollection = connection.collection('users');
    const rolesCollection = connection.collection('roles');
    const restaurantsCollection = connection.collection('restaurants');
    const ledgersCollection = connection.collection('commission_ledgers');
    const transactionsCollection = connection.collection('subscription_transactions');

    try {
      await ledgersCollection.dropIndexes();
      await transactionsCollection.dropIndexes();
    } catch {}

    // Retrieve or seed sales_rep role
    let salesRole = await rolesCollection.findOne({ slug: 'sales_rep' });
    if (!salesRole) {
      salesRole = await rolesCollection.findOne({ name: 'sales_rep' });
    }
    if (!salesRole) {
      const roleId = new Types.ObjectId();
      await rolesCollection.insertOne({
        _id: roleId,
        name: 'sales_rep',
        slug: 'sales_rep',
        description: 'Chuyên viên kinh doanh / Đối tác phân phối',
        permissions: ['SALES_VIEW', 'SALES_CREATE_RESTAURANT'],
        isSystemRole: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      salesRole = await rolesCollection.findOne({ slug: 'sales_rep' });
    } else if (!salesRole.slug) {
      await rolesCollection.updateOne({ _id: salesRole._id }, { $set: { slug: 'sales_rep' } });
      salesRole.slug = 'sales_rep';
    }

    const hashedPassword = await bcrypt.hash('Password@123', 10);

    // 1. Parent Sales Rep
    const parentId = new Types.ObjectId();
    const parentEmail = `parent.sales.${timestamp}@imenu.vn`;
    await usersCollection.insertOne({
      _id: parentId,
      email: parentEmail,
      phone: `0931${String(timestamp).slice(-6)}`,
      fullName: 'Trưởng Nhóm Kinh Doanh',
      password: hashedPassword,
      role: salesRole?._id,
      referralCode: `IMENU-LEADER-${String(timestamp).slice(-4)}`,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Sub-team CTV (with parentSalesId = parentId)
    const ctvId = new Types.ObjectId();
    const ctvEmail = `ctv.sales.${timestamp}@imenu.vn`;
    await usersCollection.insertOne({
      _id: ctvId,
      email: ctvEmail,
      phone: `0932${String(timestamp).slice(-6)}`,
      fullName: 'Cộng Tác Viên Tuyến Dưới',
      password: hashedPassword,
      role: salesRole?._id,
      parentSalesId: parentId,
      referralCode: `IMENU-SUBCTV-${String(timestamp).slice(-4)}`,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Login Parent
    const loginParentRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: parentEmail, password: 'Password@123' }),
    });
    const parentToken = loginParentRes.data?.data?.accessToken;

    // Login CTV
    const loginCtvRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: ctvEmail, password: 'Password@123' }),
    });
    const ctvToken = loginCtvRes.data?.data?.accessToken;

    // 3. Create Restaurant 1 referred by CTV
    const rest1Id = new Types.ObjectId();
    await restaurantsCollection.insertOne({
      _id: rest1Id,
      name: `Quán Ăn Phố Núi ${timestamp}`,
      slug: `quan-an-pho-nui-${timestamp}`,
      phone: `0933${String(timestamp).slice(-6)}`,
      address: '12 Lê Lai, TP. Đà Lạt',
      referredBySalesId: ctvId,
      referralCodeUsed: `IMENU-SUBCTV-${String(timestamp).slice(-4)}`,
      acquisitionChannel: 'AFFILIATE_LINK',
      subscriptionStatus: 'TRIAL',
      isActivationQualified: false,
      activationPaidBillsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // -------------------------------------------------------------------------
    // TC-12.12: Tier 1 Setup Commission (50%)
    // -------------------------------------------------------------------------
    try {
      const subRes = await request('/sales/subscriptions/process', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctvToken}` },
        body: JSON.stringify({
          restaurantId: rest1Id.toString(),
          planType: 'SETUP',
          amount: 5000000,
          durationMonths: 12,
          transactionId: `TX-SETUP-${timestamp}`,
          paymentMethod: 'VIETQR',
          note: 'Thanh toán gói Setup 1 năm',
        }),
      });

      if (subRes.status !== 201 && subRes.status !== 200) {
        throw new Error(`Process setup subscription failed: ${subRes.status} - ${JSON.stringify(subRes.data)}`);
      }

      // Verify transaction in DB
      const txDoc = await transactionsCollection.findOne({ transactionId: `TX-SETUP-${timestamp}` });
      if (!txDoc || (txDoc.planType !== 'SETUP' && txDoc.transactionType !== 'INITIAL_SETUP') || (txDoc.amount !== 5000000 && txDoc.grossAmount !== 5000000)) {
        throw new Error(`Invalid transaction doc: ${JSON.stringify(txDoc)}`);
      }

      // Verify commission ledger for CTV (50% = 2,500,000)
      const ledgerDoc = await ledgersCollection.findOne({
        salesId: ctvId,
        commissionType: 'SETUP_COMMISSION',
        restaurantId: rest1Id,
      });
      if (!ledgerDoc || ledgerDoc.commissionAmount !== 2500000 || ledgerDoc.commissionRate !== 50) {
        throw new Error(`Invalid setup commission ledger: ${JSON.stringify(ledgerDoc)}`);
      }

      // Verify restaurant subscriptionStatus = 'ACTIVE'
      const restDoc = await restaurantsCollection.findOne({ _id: rest1Id });
      if (restDoc?.subscriptionStatus !== 'ACTIVE' || !restDoc?.planExpiresAt) {
        throw new Error(`Restaurant subscription not updated properly: ${JSON.stringify(restDoc)}`);
      }

      pass('TC-12.12: Tier 1 Setup Commission (awards 50% commission = 2.500.000đ and activates subscription)');
      passed++;
    } catch (err: any) {
      fail('TC-12.12: Tier 1 Setup Commission', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.13: Tier 2 Renewal Commission (20%)
    // -------------------------------------------------------------------------
    try {
      const renewRes = await request('/sales/subscriptions/process', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctvToken}` },
        body: JSON.stringify({
          restaurantId: rest1Id.toString(),
          planType: 'RENEWAL',
          amount: 3000000,
          durationMonths: 12,
          transactionId: `TX-RENEW-${timestamp}`,
          paymentMethod: 'BANK_TRANSFER',
          note: 'Gia hạn gói dịch vụ năm 2',
        }),
      });

      if (renewRes.status !== 201 && renewRes.status !== 200) {
        throw new Error(`Process renewal subscription failed: ${renewRes.status} - ${JSON.stringify(renewRes.data)}`);
      }

      // Verify renewal commission ledger (20% = 600,000)
      const renewalLedger = await ledgersCollection.findOne({
        salesId: ctvId,
        commissionType: 'RENEWAL_COMMISSION',
        restaurantId: rest1Id,
      });
      if (!renewalLedger || renewalLedger.commissionAmount !== 600000 || renewalLedger.commissionRate !== 20) {
        throw new Error(`Invalid renewal commission ledger: ${JSON.stringify(renewalLedger)}`);
      }

      pass('TC-12.13: Tier 2 Renewal Commission (awards 20% commission = 600.000đ and extends plan)');
      passed++;
    } catch (err: any) {
      fail('TC-12.13: Tier 2 Renewal Commission', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.14: Duplicate Subscription Transaction Id Guard
    // -------------------------------------------------------------------------
    try {
      const dupRes = await request('/sales/subscriptions/process', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctvToken}` },
        body: JSON.stringify({
          restaurantId: rest1Id.toString(),
          planType: 'SETUP',
          amount: 5000000,
          durationMonths: 12,
          transactionId: `TX-SETUP-${timestamp}`, // Duplicate
          paymentMethod: 'VIETQR',
        }),
      });

      if (dupRes.status !== 400) {
        throw new Error(`Expected 400 Bad Request for duplicate transactionId, got ${dupRes.status}`);
      }

      pass('TC-12.14: Duplicate Subscription Guard (rejects re-processing existing transactionId)');
      passed++;
    } catch (err: any) {
      fail('TC-12.14: Duplicate Subscription Guard', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.15: Tier 3 Activation Bonus (250,000 VND) via 5 Paid Bills
    // -------------------------------------------------------------------------
    try {
      // Simulate bills 1, 2, 3, 4
      for (let i = 1; i <= 4; i++) {
        await salesService.onBillPaid(rest1Id.toString());
      }

      let checkRest = await restaurantsCollection.findOne({ _id: rest1Id });
      if (checkRest?.activationPaidBillsCount !== 4 || checkRest?.isActivationQualified !== false) {
        throw new Error(`At 4 bills, restaurant should NOT be qualified yet: ${JSON.stringify(checkRest)}`);
      }

      let actLedger = await ledgersCollection.findOne({
        restaurantId: rest1Id,
        commissionType: 'ACTIVATION_BONUS',
      });
      if (actLedger) {
        throw new Error(`Activation bonus awarded prematurely at 4 bills!`);
      }

      // Simulate 5th bill
      await salesService.onBillPaid(rest1Id.toString());

      checkRest = await restaurantsCollection.findOne({ _id: rest1Id });
      if (checkRest?.activationPaidBillsCount !== 5 || checkRest?.isActivationQualified !== true) {
        throw new Error(`At 5 bills, restaurant MUST be qualified: ${JSON.stringify(checkRest)}`);
      }

      actLedger = await ledgersCollection.findOne({
        restaurantId: rest1Id,
        commissionType: 'ACTIVATION_BONUS',
      });
      if (!actLedger || actLedger.commissionAmount !== 250000 || String(actLedger.salesId) !== String(ctvId)) {
        throw new Error(`Activation bonus ledger invalid: ${JSON.stringify(actLedger)}`);
      }

      pass('TC-12.15: Tier 3 Activation Bonus (awards 250.000đ bonus to CTV upon 5th paid bill)');
      passed++;
    } catch (err: any) {
      fail('TC-12.15: Tier 3 Activation Bonus', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.16: High-Concurrency CAS Race Condition Test (AUD-12.1, AUD-12.2)
    // -------------------------------------------------------------------------
    try {
      const restRaceId = new Types.ObjectId();
      await restaurantsCollection.insertOne({
        _id: restRaceId,
        name: `Quán Đua Concurrency ${timestamp}`,
        slug: `quan-dua-concurrency-${timestamp}`,
        phone: `0934${String(timestamp).slice(-6)}`,
        address: '99 Đua Tốc Độ, TP.HCM',
        referredBySalesId: ctvId,
        referralCodeUsed: `IMENU-SUBCTV-${String(timestamp).slice(-4)}`,
        acquisitionChannel: 'AFFILIATE_LINK',
        subscriptionStatus: 'ACTIVE',
        isActivationQualified: false,
        activationPaidBillsCount: 4, // 4 bills already paid
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Launch 10 simultaneous parallel calls to onBillPaid
      const promises = Array.from({ length: 10 }).map(() =>
        salesService.onBillPaid(restRaceId.toString()).catch((err) => ({ error: err })),
      );

      await Promise.all(promises);

      // Verify that EXACTLY 1 activation ledger was created
      const ledgersCount = await ledgersCollection.countDocuments({
        restaurantId: restRaceId,
        commissionType: 'ACTIVATION_BONUS',
      });

      if (ledgersCount !== 1) {
        throw new Error(`Race condition failed! Expected exactly 1 activation ledger, found: ${ledgersCount}`);
      }

      const finalRest = await restaurantsCollection.findOne({ _id: restRaceId });
      if (finalRest?.isActivationQualified !== true) {
        throw new Error(`Restaurant isActivationQualified should be true`);
      }

      pass('TC-12.16: High-Concurrency CAS Race Condition (AUD-12.1, AUD-12.2 - 10 parallel hits yield exactly 1 bonus)');
      passed++;
    } catch (err: any) {
      fail('TC-12.16: High-Concurrency CAS Race Condition', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.17: Tier 4 Team Override Bonus (250,000 VND) on CTV's 1st Qualified Restaurant
    // -------------------------------------------------------------------------
    try {
      const overrideDoc = await ledgersCollection.findOne({
        salesId: parentId,
        sourceSalesId: ctvId,
        commissionType: 'TEAM_OVERRIDE_BONUS',
      });

      if (!overrideDoc || overrideDoc.commissionAmount !== 250000) {
        throw new Error(`Team override bonus not awarded to parent sales rep: ${JSON.stringify(overrideDoc)}`);
      }

      pass('TC-12.17: Tier 4 Team Override Bonus (awards 250.000đ leadership bonus to parent sales rep)');
      passed++;
    } catch (err: any) {
      fail('TC-12.17: Tier 4 Team Override Bonus', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.18: Single Override Bonus Per CTV Guard
    // -------------------------------------------------------------------------
    try {
      // Restaurant 2 (restRaceId) was also referred by the same CTV and reached 5 bills in TC-12.16.
      // Verify that Parent did NOT receive a SECOND team override bonus for the same CTV.
      const overrideCount = await ledgersCollection.countDocuments({
        salesId: parentId,
        sourceSalesId: ctvId,
        commissionType: 'TEAM_OVERRIDE_BONUS',
      });

      if (overrideCount !== 1) {
        throw new Error(`Duplicate override bonus awarded! Expected 1, found: ${overrideCount}`);
      }

      pass('TC-12.18: Single Override Bonus Per CTV (prevents multiple team bonuses from the same CTV)');
      passed++;
    } catch (err: any) {
      fail('TC-12.18: Single Override Bonus Per CTV', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.19: Payout Bank Account Update
    // -------------------------------------------------------------------------
    try {
      const bankRes = await request('/sales/profile/bank-account', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ctvToken}` },
        body: JSON.stringify({
          bankId: 'VCB',
          bankName: 'Vietcombank',
          accountNo: '001100998877',
          accountName: 'CONG TAC VIEN TUYEN DUOI',
        }),
      });

      if (bankRes.status !== 200) {
        throw new Error(`Failed to update payout bank: ${JSON.stringify(bankRes.data)}`);
      }

      const userDoc = await usersCollection.findOne({ _id: ctvId });
      if (
        userDoc?.payoutBankAccount?.bankName !== 'Vietcombank' ||
        userDoc?.payoutBankAccount?.accountNo !== '001100998877'
      ) {
        throw new Error(`Bank account not properly persisted in User entity: ${JSON.stringify(userDoc?.payoutBankAccount)}`);
      }

      pass('TC-12.19: Payout Bank Account Update (stores bank payout details safely on sales user profile)');
      passed++;
    } catch (err: any) {
      fail('TC-12.19: Payout Bank Account Update', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.20: Commission Ledger Query Scoping
    // -------------------------------------------------------------------------
    try {
      // CTV querying commissions: should see SETUP, RENEWAL, and 2 ACTIVATION bonuses
      const ctvComRes = await request('/sales/commissions', {
        headers: { Authorization: `Bearer ${ctvToken}` },
      });
      if (ctvComRes.status !== 200) {
        throw new Error(`CTV failed to get commissions: ${JSON.stringify(ctvComRes.data)}`);
      }
      const ctvLedgers = ctvComRes.data?.data?.data || ctvComRes.data?.data || [];
      if (ctvLedgers.length < 4) {
        throw new Error(`Expected at least 4 commissions for CTV, got: ${ctvLedgers.length}`);
      }

      // Parent querying commissions: should see 1 TEAM_OVERRIDE_BONUS
      const parentComRes = await request('/sales/commissions', {
        headers: { Authorization: `Bearer ${parentToken}` },
      });
      if (parentComRes.status !== 200) {
        throw new Error(`Parent failed to get commissions: ${JSON.stringify(parentComRes.data)}`);
      }
      const parentLedgers = parentComRes.data?.data?.data || parentComRes.data?.data || [];
      const hasOverride = parentLedgers.some((l: any) => l.commissionType === 'TEAM_OVERRIDE_BONUS');
      if (!hasOverride) {
        throw new Error(`Parent should see TEAM_OVERRIDE_BONUS in their commission query`);
      }

      pass('TC-12.20: Commission Ledger Query Scoping (queries correctly scoped to sales user with full audit snapshot)');
      passed++;
    } catch (err: any) {
      fail('TC-12.20: Commission Ledger Query Scoping', err);
      failed++;
    }

  } catch (err: any) {
    console.error('Fatal test bootstrap error:', err);
    failed++;
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n------------------------------------------------------------------------`);
  console.log(`Phase 12 Suite 3 Summary: Total = ${passed + failed}, Passed = ${passed}, Failed = ${failed}`);
  console.log(`------------------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
