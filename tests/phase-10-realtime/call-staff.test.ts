import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { EventEmitter2 } from '@nestjs/event-emitter';

const TEST_PORT = 3131;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 10 Suite 1: Call Staff & Acknowledgment Flow (Port ${TEST_PORT}) ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  try {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(TEST_PORT);

    const connection = app.get<Connection>(getConnectionToken());
    const eventEmitter = app.get<EventEmitter2>(EventEmitter2);

    const timestamp = Date.now();

    // 1. REGISTER TEST RESTAURANT
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Phase 10 Realtime Test ${timestamp}`,
          phone: '0909123456',
          address: '123 Đường Test, Quận 1, TP.HCM',
        },
        owner: {
          fullName: 'Owner Realtime',
          phone: '0909123456',
          email: `owner.p10.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });

    if (regRes.status !== 201) {
      throw new Error(`Đăng ký nhà hàng thất bại: ${JSON.stringify(regRes.data)}`);
    }

    const restaurantId = regRes.data.data.restaurant.id || regRes.data.data.restaurant._id;
    const ownerToken = regRes.data.data.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    const branch1Id = restDoc!.branches[0]._id.toString();
    const restaurantSlug = restDoc!.slug;

    // 2. CREATE BRANCH 2
    const branch2Res = await request('/branches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: `Chi nhánh Đà Nẵng ${timestamp}`,
        address: '456 Bạch Đằng, Đà Nẵng',
        phone: '0912345672',
      }),
    });
    const branch2Id = (branch2Res.data?.data?._id || branch2Res.data?.data?.id || '').toString();

    // 3. CREATE BRANCH 2 STAFF (WAITER)
    const rolesColl = connection.collection('roles');
    const waiterRole = await rolesColl.findOne({ slug: 'waiter' });

    const staff2Res = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Phục Vụ Đà Nẵng',
        username: `waiter_${timestamp}`,
        email: `waiter.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0912345679',
        roleId: waiterRole!._id.toString(),
        branchId: branch2Id,
      }),
    });

    // Login branch 2 staff to get staff token
    const loginStaffRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: `waiter_${timestamp}`,
        password: 'Password@123',
      }),
    });
    const branch2StaffToken = loginStaffRes.data?.data?.accessToken;

    // 4. CREATE ZONE & TABLES IN MONGO
    const zoneCollection = connection.collection('tablezones');
    const zone1Id = new Types.ObjectId();
    await zoneCollection.insertOne({
      _id: zone1Id,
      name: 'Khu Vực Tầng 1',
      restaurantId: new Types.ObjectId(restaurantId),
      branchId: branch1Id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const tableCollection = connection.collection('tables');
    const activeTableId = new Types.ObjectId();
    const revokedTableId = new Types.ObjectId();
    const branch2TableId = new Types.ObjectId();

    await tableCollection.insertMany([
      {
        _id: activeTableId,
        code: 'TB-101',
        name: 'Bàn VIP 101',
        capacity: 4,
        status: 'Available',
        zone: zone1Id,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        qrStatus: 'active',
        qrToken: 'token-active-101',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: revokedTableId,
        code: 'TB-102',
        name: 'Bàn Đã Thu Hồi QR',
        capacity: 2,
        status: 'Available',
        zone: zone1Id,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        qrStatus: 'revoked',
        qrToken: 'token-revoked-102',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: branch2TableId,
        code: 'TB-201',
        name: 'Bàn Đà Nẵng 201',
        capacity: 6,
        status: 'Available',
        zone: zone1Id,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch2Id,
        qrStatus: 'active',
        qrToken: 'token-danang-201',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Capture EventEmitter events
    const capturedEvents: Record<string, any[]> = {
      'table.call_staff': [],
      'table.call_acknowledged': [],
      'table.qr_updated': [],
    };

    eventEmitter.on('table.call_staff', (data) => capturedEvents['table.call_staff'].push(data));
    eventEmitter.on('table.call_acknowledged', (data) => capturedEvents['table.call_acknowledged'].push(data));
    eventEmitter.on('table.qr_updated', (data) => capturedEvents['table.qr_updated'].push(data));

    // TEST 1: TC-10.1.1 - Valid Call Staff request
    try {
      const res = await request(`/tables/${activeTableId.toString()}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({
          reason: 'Xin thêm đá lạnh và nước suối',
          note: 'Mang thêm 2 ly',
          qrToken: 'token-active-101',
          restaurantSlug,
        }),
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      if (!res.data?.data?.notificationId) throw new Error('Missing notificationId in response');
      if (res.data?.data?.cooldownActive !== false) throw new Error('Expected cooldownActive to be false');
      if (capturedEvents['table.call_staff'].length !== 1) throw new Error('Expected table.call_staff event emitted');

      pass('TC-10.1.1: Khách gọi nhân viên hợp lệ (200 OK + Event Emitted)');
      passed++;
    } catch (err) {
      fail('TC-10.1.1: Khách gọi nhân viên hợp lệ', err);
      failed++;
    }

    // TEST 2: TC-10.1.2 - Non-existent table
    try {
      const fakeId = new Types.ObjectId().toString();
      const res = await request(`/tables/${fakeId}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cần hỗ trợ' }),
      });

      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      pass('TC-10.1.2: Bàn không tồn tại trả về 404 Not Found');
      passed++;
    } catch (err) {
      fail('TC-10.1.2: Bàn không tồn tại', err);
      failed++;
    }

    // TEST 3: TC-10.1.3 - Empty reason validation
    try {
      const res = await request(`/tables/${activeTableId.toString()}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: '' }),
      });

      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      pass('TC-10.1.3: Lý do rỗng bị từ chối 400 Bad Request');
      passed++;
    } catch (err) {
      fail('TC-10.1.3: Lý do rỗng validation', err);
      failed++;
    }

    // TEST 4: TC-10.1.4 - Table QR revoked (403 Forbidden)
    try {
      const res = await request(`/tables/${revokedTableId.toString()}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Gọi nhân viên bàn QR bị khóa' }),
      });

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      pass('TC-10.1.4: Bàn có mã QR bị thu hồi/khóa trả về 403 Forbidden');
      passed++;
    } catch (err) {
      fail('TC-10.1.4: Bàn QR revoked', err);
      failed++;
    }

    // TEST 5: TC-10.1.5 - Mismatched qrToken
    try {
      const res = await request(`/tables/${activeTableId.toString()}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Thử qrToken giả', qrToken: 'wrong-token-999' }),
      });

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      pass('TC-10.1.5: Truyền sai qrToken của bàn bị từ chối 403 Forbidden');
      passed++;
    } catch (err) {
      fail('TC-10.1.5: Sai qrToken', err);
      failed++;
    }

    // TEST 6: TC-10.1.6 - Mismatched restaurantSlug
    try {
      const res = await request(`/tables/${activeTableId.toString()}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Thử slug sai', restaurantSlug: 'wrong-restaurant-slug' }),
      });

      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      pass('TC-10.1.6: Truyền sai restaurantSlug của bàn bị từ chối 400 Bad Request');
      passed++;
    } catch (err) {
      fail('TC-10.1.6: Sai restaurantSlug', err);
      failed++;
    }

    // TEST 7: TC-10.1.7 - Anti-spam cooldown (calling again within 10s without bypass)
    try {
      const res = await request(`/tables/${activeTableId.toString()}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Spam gọi lần 2 liên tiếp' }),
      });

      if (res.status !== 200) throw new Error(`Expected 200 OK, got ${res.status}`);
      if (res.data?.data?.cooldownActive !== true) throw new Error('Expected cooldownActive to be true');
      if (typeof res.data?.data?.remainingSeconds !== 'number') throw new Error('Expected remainingSeconds to be present');

      pass('TC-10.1.7: Cooldown chống spam 10s hoạt động (cooldownActive: true)');
      passed++;
    } catch (err) {
      fail('TC-10.1.7: Cooldown chống spam 10s', err);
      failed++;
    }

    // TEST 8: TC-10.1.8 - Bypass cooldown with header
    try {
      const res = await request(`/tables/${activeTableId.toString()}/call-staff`, {
        method: 'POST',
        headers: { 'x-test-bypass-cooldown': 'true' },
        body: JSON.stringify({ reason: 'Gọi nhân viên có bypass cooldown' }),
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data?.data?.cooldownActive !== false) throw new Error('Expected cooldownActive to be false with bypass');

      pass('TC-10.1.8: Bypass cooldown với header x-test-bypass-cooldown thành công');
      passed++;
    } catch (err) {
      fail('TC-10.1.8: Bypass cooldown', err);
      failed++;
    }

    // TEST 9: TC-10.1.9 - Staff acknowledges call assistance (Owner/HQ user)
    try {
      const res = await request(`/tables/${activeTableId.toString()}/acknowledge-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      if (!res.data?.data?.acknowledgedBy) {
        throw new Error(`Expected acknowledgedBy, got ${JSON.stringify(res.data)}`);
      }
      if (capturedEvents['table.call_acknowledged'].length !== 1) {
        throw new Error('Expected table.call_acknowledged event to be emitted');
      }

      pass('TC-10.1.9: Nhân viên xác nhận tiếp nhận hỗ trợ bàn (200 OK + Event Emitted)');
      passed++;
    } catch (err) {
      fail('TC-10.1.9: Nhân viên xác nhận hỗ trợ bàn', err);
      failed++;
    }

    // TEST 10: TC-10.1.10 - Branch Isolation for acknowledgeCallStaff
    try {
      // Phục vụ chi nhánh Đà Nẵng (branch2StaffToken) thử xác nhận bàn ở chi nhánh Quận 1 (activeTableId)
      const res = await request(`/tables/${activeTableId.toString()}/acknowledge-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${branch2StaffToken}` },
      });

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden for cross-branch acknowledge, got ${res.status}: ${JSON.stringify(res.data)}`);
      pass('TC-10.1.10: Nhân viên chi nhánh con không được xác nhận bàn chi nhánh khác (403 Forbidden)');
      passed++;
    } catch (err) {
      fail('TC-10.1.10: Phân lập chi nhánh khi xác nhận bàn', err);
      failed++;
    }

    // TEST 11: TC-10.1.11 - Updating table QR triggers table.qr_updated event
    try {
      const res = await request(`/tables/${activeTableId.toString()}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ qrStatus: 'revoked' }),
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (capturedEvents['table.qr_updated'].length < 1) {
        throw new Error('Expected table.qr_updated event to be emitted on QR status update');
      }

      pass('TC-10.1.11: Thu hồi mã QR bàn phát sự kiện table.qr_updated thành công');
      passed++;
    } catch (err) {
      fail('TC-10.1.11: Phát sự kiện table.qr_updated', err);
      failed++;
    }

    // Clean up test data
    await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
    await tableCollection.deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
    await connection.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });

  } catch (globalErr) {
    console.error('Fatal test error:', globalErr);
    failed++;
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n------------------------------------------------------------------------`);
  console.log(`Phase 10 Suite 1 Result: ${colors.green}${passed} Passed${colors.reset}, ${failed > 0 ? colors.red : colors.reset}${failed} Failed`);
  console.log(`------------------------------------------------------------------------\n`);

  if (failed > 0) process.exit(1);
}

main();
