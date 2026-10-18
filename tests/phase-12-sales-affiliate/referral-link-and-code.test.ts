import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { getTestFixtureSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3133;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 12 Suite 1: Referral Link/Code, Anti-Spam & Attribution (Port ${TEST_PORT}) ${colors.reset}`);
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
    const timestamp = Date.now();

    // Ensure seed sales rep exists
    const usersCollection = connection.collection('users');
    const restaurantsCollection = connection.collection('restaurants');
    const applicationsCollection = connection.collection('sales_applications');

    // Retrieve or check IMENU-DEMO88
    let demoSales = await usersCollection.findOne({ referralCode: 'IMENU-DEMO88' });
    if (!demoSales) {
      const demoId = new Types.ObjectId();
      await usersCollection.insertOne({
        _id: demoId,
        email: `sales.demo.${timestamp}@imenu.vn`,
        phone: '0988889901',
        fullName: 'Nguyễn Văn Kinh Doanh Demo',
        password: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
        referralCode: 'IMENU-DEMO88',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      demoSales = await usersCollection.findOne({ referralCode: 'IMENU-DEMO88' });
    }

    // -------------------------------------------------------------------------
    // TC-12.01: Public Referral Code Validation
    // -------------------------------------------------------------------------
    try {
      const resValid = await request('/referrals/validate/IMENU-DEMO88');
      if (resValid.status !== 200 || !resValid.data?.data?.valid || resValid.data?.data?.referralCode !== 'IMENU-DEMO88') {
        throw new Error(`Expected valid referral info, received: ${JSON.stringify(resValid)}`);
      }

      const resInvalid = await request('/referrals/validate/NON_EXISTENT_CODE_999');
      if (resInvalid.status !== 200 || resInvalid.data?.data?.valid !== false) {
        throw new Error(`Expected { valid: false } for invalid code, received: ${JSON.stringify(resInvalid)}`);
      }

      pass('TC-12.01: Public Referral Code Validation (valid code returns sales metadata, invalid returns false)');
      passed++;
    } catch (err: any) {
      fail('TC-12.01: Public Referral Code Validation', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.02: Sales Rep Application Submission
    // -------------------------------------------------------------------------
    const applicantPhone = `0912${String(timestamp).slice(-6)}`;
    try {
      const applyRes = await request('/referrals/apply', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Trần Văn Ứng Viên',
          phone: applicantPhone,
          email: `ungvien.${timestamp}@gmail.com`,
          city: 'Hà Nội',
          note: 'Muốn làm CTV kinh doanh',
          parentReferralCode: 'IMENU-DEMO88',
        }),
      });

      if (applyRes.status !== 201 && applyRes.status !== 200) {
        throw new Error(`Expected status 201/200, got ${applyRes.status}: ${JSON.stringify(applyRes.data)}`);
      }

      const appDoc = await applicationsCollection.findOne({ phone: applicantPhone });
      if (!appDoc || appDoc.status !== 'PENDING' || !appDoc.parentSalesId) {
        throw new Error(`SalesApplication record not found or invalid in DB: ${JSON.stringify(appDoc)}`);
      }

      pass('TC-12.02: Sales Rep Application Submission (stores PENDING application with parentSalesId attribution)');
      passed++;
    } catch (err: any) {
      fail('TC-12.02: Sales Rep Application Submission', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.03: Anti-spam Rate Limiting Guard (AUD-12.6)
    // -------------------------------------------------------------------------
    try {
      const spamRes = await request('/referrals/apply', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Trần Văn Ứng Viên Spam',
          phone: applicantPhone,
          email: `ungvien.spam.${timestamp}@gmail.com`,
          city: 'Hà Nội',
          note: 'Spam đơn ứng tuyển',
          parentReferralCode: 'IMENU-DEMO88',
        }),
      });

      if (spamRes.status !== 400) {
        throw new Error(`Expected status 400 for duplicate phone within 24h, got ${spamRes.status}: ${JSON.stringify(spamRes.data)}`);
      }

      const errMsg = spamRes.data?.message || '';
      if (!errMsg.includes('24 giờ qua')) {
        throw new Error(`Expected anti-spam error message mentioning 24h, got: ${errMsg}`);
      }

      pass('TC-12.03: Anti-spam Guard (AUD-12.6 - rejects duplicate phone application within 24h)');
      passed++;
    } catch (err: any) {
      fail('TC-12.03: Anti-spam Guard (AUD-12.6)', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.04: Self-referral Prevention Guard (AUD-12.5)
    // -------------------------------------------------------------------------
    try {
      // Sales rep tries to register a restaurant using their own referral code and their own phone/email
      const selfRefRes = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          restaurant: {
            name: `Self Referral Restaurant ${timestamp}`,
            phone: demoSales.phone,
            address: '123 Self Ref Street',
          },
          owner: {
            fullName: demoSales.fullName,
            phone: demoSales.phone,
            email: demoSales.email,
            password: getTestFixtureSecret(),
          },
          referralCode: 'IMENU-DEMO88',
        }),
      });

      if (selfRefRes.status !== 400) {
        throw new Error(`Expected 400 Bad Request for self-referral, got ${selfRefRes.status}: ${JSON.stringify(selfRefRes.data)}`);
      }

      const msg = selfRefRes.data?.message || '';
      if (!msg.toLowerCase().includes('tự giới thiệu')) {
        throw new Error(`Expected self-referral error message, got: ${msg}`);
      }

      pass('TC-12.04: Self-referral Guard (AUD-12.5 - rejects sales rep registering restaurant with own referral code)');
      passed++;
    } catch (err: any) {
      fail('TC-12.04: Self-referral Guard (AUD-12.5)', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.05: Restaurant Registration with Referral Code
    // -------------------------------------------------------------------------
    let createdRestaurantId: string = '';
    let ownerToken: string = '';
    try {
      const regRes = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          restaurant: {
            name: `Nhà Hàng Đại Sứ ${timestamp}`,
            phone: `0977${String(timestamp).slice(-6)}`,
            address: '456 Phố Ẩm Thực, Q1, TP.HCM',
          },
          owner: {
            fullName: 'Chủ Quán Đại Sứ',
            phone: `0977${String(timestamp).slice(-6)}`,
            email: `chuquan.${timestamp}@gmail.com`,
            password: getTestFixtureSecret(),
          },
          referralCode: 'IMENU-DEMO88',
          acquisitionChannel: 'AFFILIATE_LINK',
        }),
      });

      if (regRes.status !== 201 && regRes.status !== 200) {
        throw new Error(`Expected 201/200, got ${regRes.status}: ${JSON.stringify(regRes.data)}`);
      }

      createdRestaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
      ownerToken = regRes.data?.data?.accessToken;

      const restDoc = await restaurantsCollection.findOne({ _id: new Types.ObjectId(createdRestaurantId) });
      if (!restDoc) {
        throw new Error(`Restaurant ${createdRestaurantId} not found in DB`);
      }

      if (String(restDoc.referredBySalesId) !== String(demoSales._id)) {
        throw new Error(`Expected referredBySalesId = ${demoSales._id}, got: ${restDoc.referredBySalesId}`);
      }

      if (restDoc.referralCodeUsed !== 'IMENU-DEMO88') {
        throw new Error(`Expected referralCodeUsed = 'IMENU-DEMO88', got: ${restDoc.referralCodeUsed}`);
      }

      if (restDoc.acquisitionChannel !== 'AFFILIATE_LINK') {
        throw new Error(`Expected acquisitionChannel = 'AFFILIATE_LINK', got: ${restDoc.acquisitionChannel}`);
      }

      pass('TC-12.05: Restaurant Registration with Referral Code (persists attribution and acquisition channel)');
      passed++;
    } catch (err: any) {
      fail('TC-12.05: Restaurant Registration with Referral Code', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.06: Referral Attribution Immutability Guard (AUD-12.3)
    // -------------------------------------------------------------------------
    try {
      const fakeSalesId = new Types.ObjectId().toString();
      // Owner tries to tamper with attribution via restaurant update
      const updateRes = await request('/restaurants/current', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          name: `Nhà Hàng Đại Sứ Updated ${timestamp}`,
          referredBySalesId: fakeSalesId,
          referralCodeUsed: 'FAKE_CODE',
          acquisitionChannel: 'ORGANIC',
        }),
      });

      // Verify that in DB, the original attribution remains intact
      const restDocAfter = await restaurantsCollection.findOne({ _id: new Types.ObjectId(createdRestaurantId) });
      if (String(restDocAfter?.referredBySalesId) !== String(demoSales._id)) {
        throw new Error(`Attribution was mutated! Expected ${demoSales._id}, got: ${restDocAfter?.referredBySalesId}`);
      }
      if (restDocAfter?.referralCodeUsed !== 'IMENU-DEMO88') {
        throw new Error(`Referral code was mutated! Expected IMENU-DEMO88, got: ${restDocAfter?.referralCodeUsed}`);
      }

      pass('TC-12.06: Attribution Immutability Guard (AUD-12.3 - referredBySalesId and referralCode cannot be tampered with)');
      passed++;
    } catch (err: any) {
      fail('TC-12.06: Attribution Immutability Guard (AUD-12.3)', err);
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
  console.log(`Phase 12 Suite 1 Summary: Total = ${passed + failed}, Passed = ${passed}, Failed = ${failed}`);
  console.log(`------------------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
