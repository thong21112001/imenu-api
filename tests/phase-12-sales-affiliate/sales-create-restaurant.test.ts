import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';

const TEST_PORT = 3134;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 12 Suite 2: Assisted Restaurant Creation & Cross-Sales Isolation (Port ${TEST_PORT}) ${colors.reset}`);
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

    const usersCollection = connection.collection('users');
    const rolesCollection = connection.collection('roles');
    const restaurantsCollection = connection.collection('restaurants');
    const tablesCollection = connection.collection('tables');
    const menuItemsCollection = connection.collection('menu_items');

    // Retrieve sales_rep role
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

    // Create Sales Rep A
    const salesAId = new Types.ObjectId();
    const salesAEmail = `sales.a.${timestamp}@imenu.vn`;
    await usersCollection.insertOne({
      _id: salesAId,
      email: salesAEmail,
      phone: `0901${String(timestamp).slice(-6)}`,
      fullName: 'Sales Rep Alpha',
      password: hashedPassword,
      role: salesRole?._id,
      referralCode: `IMENU-ALPHA-${String(timestamp).slice(-4)}`,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Sales Rep B
    const salesBId = new Types.ObjectId();
    const salesBEmail = `sales.b.${timestamp}@imenu.vn`;
    await usersCollection.insertOne({
      _id: salesBId,
      email: salesBEmail,
      phone: `0902${String(timestamp).slice(-6)}`,
      fullName: 'Sales Rep Beta',
      password: hashedPassword,
      role: salesRole?._id,
      referralCode: `IMENU-BETA-${String(timestamp).slice(-4)}`,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Login Sales Rep A
    const loginARes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: salesAEmail, password: 'Password@123' }),
    });
    const tokenA = loginARes.data?.data?.accessToken;
    if (!tokenA) {
      throw new Error(`Failed to login Sales Rep A: ${JSON.stringify(loginARes.data)}`);
    }

    // Login Sales Rep B
    const loginBRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: salesBEmail, password: 'Password@123' }),
    });
    const tokenB = loginBRes.data?.data?.accessToken;
    if (!tokenB) {
      throw new Error(`Failed to login Sales Rep B: ${JSON.stringify(loginBRes.data)}`);
    }

    // -------------------------------------------------------------------------
    // TC-12.07: Assisted Restaurant Creation (POST /api/sales/restaurants)
    // -------------------------------------------------------------------------
    let createdRestId: string = '';
    const assistedOwnerEmail = `owner.assisted.${timestamp}@gmail.com`;
    try {
      const createRes = await request('/sales/restaurants', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          restaurant: {
            name: `Phở Bò Giao Tuyết ${timestamp}`,
            phone: `0905${String(timestamp).slice(-6)}`,
            address: '88 Phố Huế, Q. Hoàn Kiếm, Hà Nội',
            tagline: 'Phở bò truyền thống gia truyền',
          },
          owner: {
            fullName: 'Lê Giao Tuyết',
            phone: `0905${String(timestamp).slice(-6)}`,
            email: assistedOwnerEmail,
            password: 'MatKhau@123',
          },
          seedDemoTables: true,
          seedDemoMenu: true,
        }),
      });

      if (createRes.status !== 201 && createRes.status !== 200) {
        throw new Error(`Expected 201/200, got ${createRes.status}: ${JSON.stringify(createRes.data)}`);
      }

      createdRestId = createRes.data?.data?.restaurant?.id || createRes.data?.restaurant?.id;
      const restDoc = await restaurantsCollection.findOne({ _id: new Types.ObjectId(createdRestId) });
      if (!restDoc) {
        throw new Error(`Restaurant ${createdRestId} not found in DB`);
      }

      if (String(restDoc.referredBySalesId) !== String(salesAId)) {
        throw new Error(`Expected referredBySalesId = ${salesAId}, got: ${restDoc.referredBySalesId}`);
      }
      if (String(restDoc.createdBySalesId) !== String(salesAId)) {
        throw new Error(`Expected createdBySalesId = ${salesAId}, got: ${restDoc.createdBySalesId}`);
      }
      if (restDoc.acquisitionChannel !== 'SALES_ASSISTED') {
        throw new Error(`Expected acquisitionChannel = 'SALES_ASSISTED', got: ${restDoc.acquisitionChannel}`);
      }

      pass('TC-12.07: Assisted Restaurant Creation (creates restaurant, assigns attribution to sales rep)');
      passed++;
    } catch (err: any) {
      fail('TC-12.07: Assisted Restaurant Creation', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.08: Automated Onboarding Assets Seeding (12 Tables + 4 Menu Items)
    // -------------------------------------------------------------------------
    try {
      const tablesCount = await tablesCollection.countDocuments({ restaurantId: new Types.ObjectId(createdRestId) });
      if (tablesCount !== 12) {
        throw new Error(`Expected 12 seeded tables, found: ${tablesCount}`);
      }

      const menuCount = await menuItemsCollection.countDocuments({ restaurantId: new Types.ObjectId(createdRestId) });
      if (menuCount !== 4) {
        throw new Error(`Expected 4 seeded menu items, found: ${menuCount}`);
      }

      pass('TC-12.08: Automated Onboarding Assets (seeds 12 starter tables & 4 signature menu items)');
      passed++;
    } catch (err: any) {
      fail('TC-12.08: Automated Onboarding Assets', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.09: Cross-Sales Isolation & Tenant Scoping (AUD-12.4)
    // -------------------------------------------------------------------------
    try {
      // Sales Rep A should see 1 restaurant
      const resA = await request('/sales/restaurants', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (resA.status !== 200) {
        throw new Error(`Sales A failed to get restaurants: ${JSON.stringify(resA.data)}`);
      }
      const dataA = resA.data?.data?.data || resA.data?.data || [];
      const foundInA = dataA.some((r: any) => String(r.id || r._id) === createdRestId);
      if (!foundInA) {
        throw new Error(`Sales A should see their assisted restaurant in list`);
      }

      // Sales Rep B should NOT see Sales Rep A's restaurant
      const resB = await request('/sales/restaurants', {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      if (resB.status !== 200) {
        throw new Error(`Sales B failed to get restaurants: ${JSON.stringify(resB.data)}`);
      }
      const dataB = resB.data?.data?.data || resB.data?.data || [];
      const foundInB = dataB.some((r: any) => String(r.id || r._id) === createdRestId);
      if (foundInB) {
        throw new Error(`Data leakage! Sales B should NOT see restaurant created by Sales A (AUD-12.4 violation)`);
      }

      pass('TC-12.09: Cross-Sales Isolation (AUD-12.4 - Sales Rep B cannot see Sales Rep A referred restaurants)');
      passed++;
    } catch (err: any) {
      fail('TC-12.09: Cross-Sales Isolation (AUD-12.4)', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.10: Sales Rep Operational Route Access Block (AUD-12.4)
    // -------------------------------------------------------------------------
    try {
      // Sales rep token has no restaurantId and should not be able to access bills or internal kitchen/table operations
      const billsRes = await request('/bills', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      // Should be rejected (400 Bad Request: restaurantId missing, or 403 Forbidden)
      if (billsRes.status !== 400 && billsRes.status !== 403) {
        throw new Error(`Expected status 400 or 403 when sales rep accesses /bills, got ${billsRes.status}`);
      }

      const tablesRes = await request('/tables', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (tablesRes.status !== 400 && tablesRes.status !== 403) {
        throw new Error(`Expected status 400 or 403 when sales rep accesses /tables, got ${tablesRes.status}`);
      }

      pass('TC-12.10: Sales Rep Operational Route Block (AUD-12.4 - prevents sales rep accessing internal restaurant operations)');
      passed++;
    } catch (err: any) {
      fail('TC-12.10: Sales Rep Operational Route Block (AUD-12.4)', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-12.11: Assisted Restaurant Owner Login
    // -------------------------------------------------------------------------
    try {
      const ownerLoginRes = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: assistedOwnerEmail, password: 'MatKhau@123' }),
      });
      if (ownerLoginRes.status !== 200 || !ownerLoginRes.data?.data?.accessToken) {
        throw new Error(`Assisted owner could not login: ${JSON.stringify(ownerLoginRes.data)}`);
      }

      const ownerData = ownerLoginRes.data?.data || ownerLoginRes.data;
      const ownerRestId = ownerData?.user?.restaurantId || ownerData?.restaurant?.id;
      if (String(ownerRestId) !== createdRestId) {
        throw new Error(`Owner token restaurant ID mismatch: expected ${createdRestId}, got: ${ownerRestId}`);
      }

      pass('TC-12.11: Assisted Restaurant Owner Login (owner logs in smoothly with generated credentials)');
      passed++;
    } catch (err: any) {
      fail('TC-12.11: Assisted Restaurant Owner Login', err);
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
  console.log(`Phase 12 Suite 2 Summary: Total = ${passed + failed}, Passed = ${passed}, Failed = ${failed}`);
  console.log(`------------------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
