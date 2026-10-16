import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { io, Socket } from 'socket.io-client';

const TEST_PORT = 3125;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;
const WS_URL = `http://localhost:${TEST_PORT}`;

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

function createClient(options: { token?: string; query?: Record<string, string> } = {}): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      transports: ['websocket'],
      forceNew: true,
      auth: options.token ? { token: `Bearer ${options.token}` } : undefined,
      query: options.query,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timed out'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
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
          name: `Phase 10 Suite 1 ${timestamp}`,
          phone: '0909123456',
          address: '123 Đường Test, Quận 1, TP.HCM',
        },
        owner: {
          fullName: 'Owner Realtime',
          phone: '0909123456',
          email: `owner.p10.suite1.${timestamp}@imenu.vn`,
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

    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Phục Vụ Đà Nẵng',
        username: `waiter_s1_${timestamp}`,
        email: `waiter.s1.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0912345679',
        roleId: waiterRole!._id.toString(),
        branchId: branch2Id,
      }),
    });

    const loginStaffRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: `waiter_s1_${timestamp}`,
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
    const deletedTableId = new Types.ObjectId();
    const branch2TableId = new Types.ObjectId();

    await tableCollection.insertMany([
      {
        _id: activeTableId,
        code: 'TB-101',
        name: 'Bàn VIP 101',
        zone: zone1Id,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        capacity: 4,
        status: 'Occupied',
        qrStatus: 'active',
        qrToken: `valid_token_${timestamp}`,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: revokedTableId,
        code: 'TB-102',
        name: 'Bàn Bị Khóa QR',
        zone: zone1Id,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        capacity: 4,
        status: 'Available',
        qrStatus: 'revoked',
        qrToken: `revoked_token_${timestamp}`,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: deletedTableId,
        code: 'TB-103',
        name: 'Bàn Đã Xóa',
        zone: zone1Id,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        capacity: 4,
        status: 'Available',
        qrStatus: 'active',
        qrToken: `deleted_token_${timestamp}`,
        isDeleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: branch2TableId,
        code: 'TB-201',
        name: 'Bàn Đà Nẵng 201',
        zone: zone1Id,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch2Id,
        capacity: 4,
        status: 'Occupied',
        qrStatus: 'active',
        qrToken: `dn_token_${timestamp}`,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Connect real Socket.IO clients
    const staffClient = await createClient({ token: ownerToken });
    const guestTableClient = await createClient({
      query: { tableId: activeTableId.toString(), restaurantId: restaurantId.toString() },
    });

    // -------------------------------------------------------------------------
    // TC-10.1.1: Khách tại bàn hợp lệ gửi yêu cầu -> 200 OK & phát sự kiện WebSocket
    // -------------------------------------------------------------------------
    try {
      let eventPayload: any = null;
      let socketPayload: any = null;

      eventEmitter.once('table.call_staff', (data) => {
        eventPayload = data;
      });

      staffClient.once('table:call_staff', (data) => {
        socketPayload = data;
      });

      const res = await request(`/tables/${activeTableId}/call-staff`, {
        method: 'POST',
        headers: {
          'x-test-bypass-cooldown': 'true',
        },
        body: JSON.stringify({
          reason: 'Xin thêm đá lạnh',
          note: 'Cho 2 ly đá to',
          qrToken: `valid_token_${timestamp}`,
          restaurantSlug,
        }),
      });

      await new Promise((r) => setTimeout(r, 200));

      if (
        res.status === 200 &&
        res.data?.success === true &&
        res.data?.data?.cooldownActive === false &&
        eventPayload?.reason === 'Xin thêm đá lạnh' &&
        eventPayload?.tableName === 'Bàn VIP 101' &&
        socketPayload?.reason === 'Xin thêm đá lạnh'
      ) {
        pass('TC-10.1.1: Khách gọi nhân viên hợp lệ (200 OK + Event & Socket Emitted)', `cooldown: ${res.data?.data?.remainingSeconds || 0}s`);
        passed++;
      } else {
        fail('TC-10.1.1: Gọi nhân viên thất bại', { res, eventPayload, socketPayload });
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.1: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.2: Bàn không tồn tại trả về 404 Not Found
    // -------------------------------------------------------------------------
    try {
      const nonExistentId = new Types.ObjectId();
      const res = await request(`/tables/${nonExistentId}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Gọi nhân viên' }),
      });

      if (res.status === 404) {
        pass('TC-10.1.2: Bàn không tồn tại trả về 404 Not Found');
        passed++;
      } else {
        fail('TC-10.1.2: Bàn không tồn tại không trả về 404', res);
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.2: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.3: Bàn đã xóa mềm trả về 404 Not Found
    // -------------------------------------------------------------------------
    try {
      const res = await request(`/tables/${deletedTableId}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Gọi nhân viên' }),
      });

      if (res.status === 404) {
        pass('TC-10.1.3: Bàn đã xóa mềm (isDeleted: true) trả về 404 Not Found');
        passed++;
      } else {
        fail('TC-10.1.3: Bàn xóa mềm không trả về 404', res);
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.3: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.4: Lý do rỗng bị từ chối 400 Bad Request
    // -------------------------------------------------------------------------
    try {
      const res = await request(`/tables/${activeTableId}/call-staff`, {
        method: 'POST',
        headers: { 'x-test-bypass-cooldown': 'true' },
        body: JSON.stringify({ reason: '' }),
      });

      if (res.status === 400) {
        pass('TC-10.1.4: Lý do rỗng bị từ chối 400 Bad Request');
        passed++;
      } else {
        fail('TC-10.1.4: Lý do rỗng không bị chặn', res);
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.4: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.5: Lý do vượt quá 200 ký tự bị từ chối 400 Bad Request
    // -------------------------------------------------------------------------
    try {
      const longReason = 'A'.repeat(201);
      const res = await request(`/tables/${activeTableId}/call-staff`, {
        method: 'POST',
        headers: { 'x-test-bypass-cooldown': 'true' },
        body: JSON.stringify({ reason: longReason }),
      });

      if (res.status === 400) {
        pass('TC-10.1.5: Lý do vượt quá 200 ký tự bị từ chối 400 Bad Request');
        passed++;
      } else {
        fail('TC-10.1.5: Lý do > 200 ký tự không bị chặn', res);
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.5: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.6: Bàn có mã QR bị thu hồi/khóa trả về 403 Forbidden
    // -------------------------------------------------------------------------
    try {
      const res = await request(`/tables/${revokedTableId}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Xin tương ớt' }),
      });

      if (res.status === 403) {
        pass('TC-10.1.6: Bàn có mã QR bị thu hồi/khóa trả về 403 Forbidden');
        passed++;
      } else {
        fail('TC-10.1.6: Bàn revoked không trả về 403', res);
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.6: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.7: Truyền sai qrToken của bàn bị từ chối 403 Forbidden
    // -------------------------------------------------------------------------
    try {
      const res = await request(`/tables/${activeTableId}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Xin đá', qrToken: 'wrong-token-abc' }),
      });

      if (res.status === 403) {
        pass('TC-10.1.7: Truyền sai qrToken của bàn bị từ chối 403 Forbidden');
        passed++;
      } else {
        fail('TC-10.1.7: Sai qrToken không trả về 403', res);
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.7: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.8: Truyền sai restaurantSlug của bàn bị từ chối 400 Bad Request
    // -------------------------------------------------------------------------
    try {
      const res = await request(`/tables/${activeTableId}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Xin đá', restaurantSlug: 'wrong-slug-restaurant' }),
      });

      if (res.status === 400) {
        pass('TC-10.1.8: Truyền sai restaurantSlug của bàn bị từ chối 400 Bad Request');
        passed++;
      } else {
        fail('TC-10.1.8: Sai restaurantSlug không trả về 400', res);
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.8: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.9: Cooldown chống spam 10s hoạt động
    // -------------------------------------------------------------------------
    try {
      // Gọi lần 1 có bypass để thiết lập mốc cooldown ban đầu
      await request(`/tables/${activeTableId}/call-staff`, {
        method: 'POST',
        headers: { 'x-test-bypass-cooldown': 'true' },
        body: JSON.stringify({ reason: 'Gọi nhân viên lần 1' }),
      });

      // Gọi lần 2 liền tay KHÔNG có bypass -> phải trả về cooldownActive: true
      const res2 = await request(`/tables/${activeTableId}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Gọi nhân viên lần 2 liền tay' }),
      });

      if (
        res2.status === 200 &&
        res2.data?.data?.cooldownActive === true &&
        typeof res2.data?.data?.remainingSeconds === 'number'
      ) {
        pass('TC-10.1.9: Cooldown chống spam 10s hoạt động (cooldownActive: true)', `còn: ${res2.data?.data?.remainingSeconds}s`);
        passed++;
      } else {
        fail('TC-10.1.9: Cooldown không hoạt động', res2);
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.9: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.10: Bypass cooldown với header x-test-bypass-cooldown thành công
    // -------------------------------------------------------------------------
    try {
      const resBypass = await request(`/tables/${activeTableId}/call-staff`, {
        method: 'POST',
        headers: { 'x-test-bypass-cooldown': 'true' },
        body: JSON.stringify({ reason: 'Gọi bypass test' }),
      });

      if (resBypass.status === 200 && resBypass.data?.success === true && resBypass.data?.data?.cooldownActive === false) {
        pass('TC-10.1.10: Bypass cooldown với header x-test-bypass-cooldown thành công');
        passed++;
      } else {
        fail('TC-10.1.10: Bypass cooldown thất bại', resBypass);
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.10: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.11: Nhân viên xác nhận tiếp nhận hỗ trợ bàn -> 200 OK + phát socket tới bàn
    // -------------------------------------------------------------------------
    try {
      let ackEventPayload: any = null;
      let ackSocketPayload: any = null;

      eventEmitter.once('table.call_acknowledged', (data) => {
        ackEventPayload = data;
      });

      guestTableClient.once('table:call_acknowledged', (data) => {
        ackSocketPayload = data;
      });

      const res = await request(`/tables/${activeTableId}/acknowledge-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      await new Promise((r) => setTimeout(r, 200));

      if (
        res.status === 200 &&
        res.data?.success === true &&
        ackEventPayload?.tableId === activeTableId.toString() &&
        ackSocketPayload?.tableId === activeTableId.toString()
      ) {
        pass('TC-10.1.11: Nhân viên xác nhận tiếp nhận hỗ trợ bàn (200 OK + Event & Guest Socket Emitted)');
        passed++;
      } else {
        fail('TC-10.1.11: Xác nhận gọi bàn thất bại', { res, ackEventPayload, ackSocketPayload });
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.11: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.12: Nhân viên chi nhánh con không được xác nhận bàn chi nhánh khác (403 Forbidden)
    // -------------------------------------------------------------------------
    try {
      const res = await request(`/tables/${activeTableId}/acknowledge-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${branch2StaffToken}` },
      });

      if (res.status === 403) {
        pass('TC-10.1.12: Nhân viên chi nhánh con không được xác nhận bàn chi nhánh khác (403 Forbidden)');
        passed++;
      } else {
        fail('TC-10.1.12: Không chặn nhân viên chi nhánh khác', res);
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.12: Exception', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.1.13: Thu hồi mã QR bàn phát sự kiện table.qr_updated thành công
    // -------------------------------------------------------------------------
    try {
      let qrEventPayload: any = null;
      let qrSocketPayload: any = null;

      eventEmitter.once('table.qr_updated', (data) => {
        qrEventPayload = data;
      });

      guestTableClient.once('table:qr_updated', (data) => {
        qrSocketPayload = data;
      });

      const res = await request(`/tables/${activeTableId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ qrStatus: 'revoked' }),
      });

      await new Promise((r) => setTimeout(r, 200));

      if (
        res.status === 200 &&
        qrEventPayload?.tableId === activeTableId.toString() &&
        qrEventPayload?.qrStatus === 'revoked' &&
        qrSocketPayload?.qrStatus === 'revoked'
      ) {
        pass('TC-10.1.13: Thu hồi mã QR bàn phát sự kiện table.qr_updated & guest socket thành công');
        passed++;
      } else {
        fail('TC-10.1.13: Thu hồi QR không phát sự kiện', { res, qrEventPayload, qrSocketPayload });
        failed++;
      }
    } catch (e) {
      fail('TC-10.1.13: Exception', e);
      failed++;
    }

    staffClient.disconnect();
    guestTableClient.disconnect();

  } catch (err: any) {
    console.error('Fatal Suite 1 Error:', err);
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n------------------------------------------------------------------------`);
  console.log(`Phase 10 Suite 1 Result: ${passed} Passed, ${failed} Failed`);
  console.log(`------------------------------------------------------------------------\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
