import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { getTestFixtureSecret, getTestNumberSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3141;
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

function fail(name: string, error?: any) {
  console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${name}`);
  if (error) {
    console.error(`    ${colors.red}${error?.stack || error?.message || (typeof error === 'object' ? JSON.stringify(error) : error)}${colors.reset}`);
  }
}

async function request(endpoint: string, options: any = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

export async function runSuperAdminWorkspaceIsolationTests(): Promise<{ passed: boolean; count: number; failures: number }> {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  PHASE 14 AUD-14.2 / 14.3 / 14.4: SUPERADMIN WORKSPACE PURIFICATION    ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let testCount = 0;
  let failures = 0;

  const webRoot = path.resolve(__dirname, '../../../imenu-menudientu');

  // ---------------------------------------------------------------------------
  // TEST 1: AUD-14.2 Frontend Route Redirection & Navigation Protection Verification
  // ---------------------------------------------------------------------------
  testCount++;
  try {
    const routeGuardPath = path.join(webRoot, 'apps/imenu-admin/src/components/RouteAccessGuard.tsx');
    const adminSidebarPath = path.join(webRoot, 'apps/imenu-admin/src/components/AdminSidebar.tsx');
    const pageHomePath = path.join(webRoot, 'apps/imenu-admin/src/app/page.tsx');

    if (fs.existsSync(routeGuardPath) && fs.existsSync(adminSidebarPath) && fs.existsSync(pageHomePath)) {
      const routeGuardCode = fs.readFileSync(routeGuardPath, 'utf8');
      const sidebarCode = fs.readFileSync(adminSidebarPath, 'utf8');
      const homePageCode = fs.readFileSync(pageHomePath, 'utf8');

      // 1. Route guard must enforce Superadmin redirection to /platform/dashboard
      const hasSuperAdminGuardCheck =
        routeGuardCode.includes('isSuperAdmin') &&
        routeGuardCode.includes('/platform/dashboard') &&
        routeGuardCode.includes("router.replace('/platform/dashboard')");

      // 2. AdminSidebar must isolate SUPERADMIN_NAV_GROUPS to strictly platform routes & staff
      const hasSuperAdminNavGroups =
        sidebarCode.includes('SUPERADMIN_NAV_GROUPS') &&
        sidebarCode.includes('/platform/dashboard') &&
        sidebarCode.includes('/platform/restaurants') &&
        sidebarCode.includes('/platform/revenues') &&
        sidebarCode.includes('/platform/sales') &&
        sidebarCode.includes('/staff');

      // 3. Store routes must be excluded from Superadmin nav
      const excludesStoreNavFromSuperAdmin =
        sidebarCode.includes('visibleGroups = SUPERADMIN_NAV_GROUPS') &&
        sidebarCode.includes('!isSuperAdmin &&') &&
        sidebarCode.includes('Menu QR Khách');

      // 4. Root page must perform immediate redirect for SuperAdmin
      const hasHomePageSuperAdminRedirect =
        homePageCode.includes('system_admin') &&
        homePageCode.includes('/platform/dashboard');

      if (
        hasSuperAdminGuardCheck &&
        hasSuperAdminNavGroups &&
        excludesStoreNavFromSuperAdmin &&
        hasHomePageSuperAdminRedirect
      ) {
        pass(
          'TEST 1: AUD-14.2 RouteAccessGuard, AdminSidebar & HomePage cô lập 100% không gian làm việc Superadmin vào Trung tâm Điều hành Nền tảng'
        );
      } else {
        failures++;
        fail('TEST 1: AUD-14.2 Kiểm tra logic Route Guard và Sidebar không thỏa điều kiện cô lập Superadmin', {
          hasSuperAdminGuardCheck,
          hasSuperAdminNavGroups,
          excludesStoreNavFromSuperAdmin,
          hasHomePageSuperAdminRedirect,
        });
      }
    } else {
      failures++;
      fail('TEST 1: AUD-14.2 Các tệp frontend cần kiểm tra không tồn tại theo đường dẫn chỉ định');
    }
  } catch (err) {
    failures++;
    fail('TEST 1: Kiểm tra RouteAccessGuard và AdminSidebar gặp lỗi', err);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: AUD-14.3 Header, Sound Chimes & Store Control Elimination
  // ---------------------------------------------------------------------------
  testCount++;
  try {
    const adminHeaderPath = path.join(webRoot, 'apps/imenu-admin/src/components/AdminHeader.tsx');

    if (fs.existsSync(adminHeaderPath)) {
      const headerCode = fs.readFileSync(adminHeaderPath, 'utf8');

      // 1. Impersonation banner, restaurant switcher, branch switcher, and open/close status toggle hidden for Superadmin
      const hasBranchSwitcherHidden =
        headerCode.includes('!isSuperAdmin &&') &&
        headerCode.includes('handleToggleBranchStatus');

      // 2. Sound mute button hidden for Superadmin
      const hasSoundButtonHidden =
        headerCode.includes('!isSuperAdmin && (') &&
        headerCode.includes('isMuted') &&
        headerCode.includes('handleToggleMute');

      // 3. Table and kitchen chime listeners bypassed for Superadmin
      const hasChimeBypass =
        headerCode.includes('if (!isSuperAdmin) {') &&
        headerCode.includes('realtimeHub.subscribe');

      // 4. Royal Badge present for Superadmin
      const hasSuperAdminBadge =
        headerCode.includes('👑 Quản Trị Viên Tối Cao (Superadmin)') &&
        headerCode.includes('isSuperAdmin');

      if (hasBranchSwitcherHidden && hasSoundButtonHidden && hasChimeBypass && hasSuperAdminBadge) {
        pass(
          'TEST 2: AUD-14.3 AdminHeader ẩn hoàn toàn Branch Switcher, Open/Close Toggle, Mute Button, tắt chuông đơn/bếp và hiển thị Huy hiệu Superadmin'
        );
      } else {
        failures++;
        fail('TEST 2: AUD-14.3 AdminHeader chưa triệt để loại bỏ thành phần store và chuông thông báo', {
          hasBranchSwitcherHidden,
          hasSoundButtonHidden,
          hasChimeBypass,
          hasSuperAdminBadge,
        });
      }
    } else {
      failures++;
      fail('TEST 2: AUD-14.3 Tệp AdminHeader.tsx không tồn tại');
    }
  } catch (err) {
    failures++;
    fail('TEST 2: Kiểm tra AdminHeader gặp lỗi', err);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: AUD-14.4 Backend Platform RBAC Strict Enforcement & Store Protection
  // ---------------------------------------------------------------------------
  testCount++;
  let conn: Connection | null = null;
  try {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(TEST_PORT);

    conn = app.get<Connection>(getConnectionToken());
    const db = conn.db;
    if (!db) throw new Error('Database connection failed');

    // 1. Seed SuperAdmin role (slug: system_admin) & Store Staff role (cashier)
    let superRole = await db.collection('roles').findOne({ slug: 'system_admin' });
    if (!superRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'Super Admin',
        slug: 'system_admin',
        description: 'Platform Super Admin',
        permissions: ['*'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      superRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    let cashierRole = await db.collection('roles').findOne({ slug: 'cashier' });
    if (!cashierRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'Cashier',
        slug: 'cashier',
        description: 'Store Cashier',
        permissions: ['orders:read', 'orders:update'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      cashierRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    // 2. Clean test users
    await db.collection('users').deleteMany({ email: /.*@test-p14-isolation\.vn/ });

    const hashedPassword = await bcrypt.hash(getTestNumberSecret(), 10);

    // Seed SuperAdmin
    await db.collection('users').insertOne({
      _id: new Types.ObjectId(),
      username: 'superadmin_p14',
      email: 'superadmin@test-p14-isolation.vn',
      fullName: 'Super Admin P14',
      phone: '0909001401',
      password: hashedPassword,
      role: superRole!._id,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed Store Cashier
    await db.collection('users').insertOne({
      _id: new Types.ObjectId(),
      username: 'cashier_p14',
      email: 'cashier@test-p14-isolation.vn',
      fullName: 'Cashier P14',
      phone: '0909001402',
      password: hashedPassword,
      role: cashierRole!._id,
      status: 'ACTIVE',
      isRoleActive: true,
      tokenVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Login SuperAdmin
    const loginSuper = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@test-p14-isolation.vn', password: getTestNumberSecret() }),
    });
    const superToken = loginSuper.data?.data?.accessToken;

    // Login Cashier
    const loginCashier = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'cashier@test-p14-isolation.vn', password: getTestNumberSecret() }),
    });
    const cashierToken = loginCashier.data?.data?.accessToken;

    // A. SuperAdmin access to /platform/restaurants is allowed (200 OK)
    const resPlatformSuper = await request('/platform/restaurants', {
      headers: { Authorization: `Bearer ${superToken}` },
    });

    // B. SuperAdmin access to /platform/revenues/restaurants is allowed (200 OK)
    const resRevSuper = await request('/platform/revenues/restaurants', {
      headers: { Authorization: `Bearer ${superToken}` },
    });

    // C. Store Cashier access to /platform/restaurants is strictly FORBIDDEN (403 Forbidden)
    const resPlatformCashier = await request('/platform/restaurants', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    // D. Store Cashier access to /platform/revenues/restaurants is strictly FORBIDDEN (403 Forbidden)
    const resRevCashier = await request('/platform/revenues/restaurants', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });

    if (
      resPlatformSuper.status === 200 &&
      resRevSuper.status === 200 &&
      resPlatformCashier.status === 403 &&
      resRevCashier.status === 403
    ) {
      pass(
        'TEST 3: AUD-14.4 Backend bảo vệ nghiêm ngặt các endpoint /api/platform/*: Superadmin truy cập thành công (200), Store Cashier bị chặn (403)'
      );
    } else {
      failures++;
      fail('TEST 3: AUD-14.4 Phân quyền nền tảng không bảo vệ đúng', {
        superStatus: resPlatformSuper.status,
        superRevStatus: resRevSuper.status,
        cashierStatus: resPlatformCashier.status,
        revCashierStatus: resRevCashier.status,
      });
    }
  } catch (err) {
    failures++;
    fail('TEST 3: Kiểm tra Backend Platform RBAC gặp lỗi', err);
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n  Superadmin Workspace Isolation Summary: ${testCount - failures}/${testCount} tests passed\n`);
  return { passed: failures === 0, count: testCount, failures };
}

if (require.main === module) {
  runSuperAdminWorkspaceIsolationTests().then((res) => {
    if (!res.passed) {
      process.exit(1);
    }
  });
}
