import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { io, Socket } from 'socket.io-client';

const TEST_PORT = 3132;
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

function emitAsync<T = any>(socket: Socket, event: string, data?: any): Promise<T> {
  return new Promise((resolve) => {
    socket.emit(event, data, (response: T) => {
      resolve(response);
    });
  });
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 10 Suite 2: Realtime Gateway Room Management & Isolation (Port ${TEST_PORT}) ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  try {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    await app.listen(TEST_PORT);

    const jwtService = app.get<JwtService>(JwtService);
    const eventEmitter = app.get<EventEmitter2>(EventEmitter2);

    const restaurantId = '666000000000000000000001';
    const branchAId = 'branch-hcm-01';
    const branchBId = 'branch-danang-02';
    const tableId = 'table-vip-001';

    // 1. JWT Tokens
    const hqOwnerToken = jwtService.sign({
      id: 'user-hq',
      sub: 'user-hq',
      restaurantId,
      branchId: branchAId,
      isMainBranch: true,
      role: 'RESTAURANT_ADMIN',
    });

    const branchBStaffToken = jwtService.sign({
      id: 'user-branch-b',
      sub: 'user-branch-b',
      restaurantId,
      branchId: branchBId,
      isMainBranch: false,
      role: 'WAITER',
    });

    // TEST 1: TC-10.2.1 - Authenticated staff joins restaurant and branch room on connection
    let staffSocket: Socket | null = null;
    try {
      staffSocket = await createClient({ token: hqOwnerToken });
      const health = await emitAsync(staffSocket, 'ping:health');

      if (!health || health.status !== 'ok') throw new Error('Expected health status ok');
      const rooms: string[] = health.rooms || [];
      const hasRestRoom = rooms.includes(`restaurant_${restaurantId}`);
      const hasBranchRoom = rooms.includes(`restaurant_${restaurantId}_branch_${branchAId}`);

      if (!hasRestRoom || !hasBranchRoom) {
        throw new Error(`Expected rooms restaurant_${restaurantId} and branch_${branchAId}, got: ${JSON.stringify(rooms)}`);
      }

      pass('TC-10.2.1: Nhân viên có JWT tự động join phòng nhà hàng & chi nhánh');
      passed++;
    } catch (err) {
      fail('TC-10.2.1: Nhân viên join phòng', err);
      failed++;
    }

    // TEST 2: TC-10.2.2 - Guest cannot join staff restaurant room directly
    let guestSocket: Socket | null = null;
    try {
      guestSocket = await createClient(); // Unauthenticated guest
      const joinRes = await emitAsync(guestSocket, 'join:restaurant', { restaurantId });

      if (joinRes?.success !== false || !joinRes?.message?.includes('Unauthorized')) {
        throw new Error(`Expected Unauthorized rejection, got: ${JSON.stringify(joinRes)}`);
      }

      pass('TC-10.2.2: Khách vãng lai không có JWT bị chặn khi join phòng nhà hàng');
      passed++;
    } catch (err) {
      fail('TC-10.2.2: Chặn khách join phòng nhà hàng', err);
      failed++;
    }

    // TEST 3: TC-10.2.3 - Guest connects with tableId & restaurantId query params
    let tableGuestSocket: Socket | null = null;
    try {
      tableGuestSocket = await createClient({
        query: { tableId, restaurantId },
      });
      const health = await emitAsync(tableGuestSocket, 'ping:health');
      const rooms: string[] = health.rooms || [];

      const hasTableRoom = rooms.includes(`table_${tableId}`);
      const hasPublicMenuRoom = rooms.includes(`public_menu_${restaurantId}`);
      const hasStaffRestRoom = rooms.includes(`restaurant_${restaurantId}`);

      if (!hasTableRoom || !hasPublicMenuRoom) {
        throw new Error(`Expected table_${tableId} and public_menu_${restaurantId}, got: ${JSON.stringify(rooms)}`);
      }
      if (hasStaffRestRoom) {
        throw new Error(`Security breach: Guest should NOT be in restaurant_${restaurantId}`);
      }

      pass('TC-10.2.3: Khách quét QR chỉ tham gia room bàn và public_menu, không vào room nhân viên');
      passed++;
    } catch (err) {
      fail('TC-10.2.3: Phân lập phòng khách quét QR', err);
      failed++;
    }

    // TEST 4: TC-10.2.4 - HQ staff switches branch (switch:branch)
    try {
      if (!staffSocket) throw new Error('Staff socket not connected');

      const switchRes = await emitAsync(staffSocket, 'switch:branch', {
        restaurantId,
        fromBranchId: branchAId,
        toBranchId: branchBId,
      });

      if (!switchRes || switchRes.success !== true) {
        throw new Error(`Expected switch:branch success, got: ${JSON.stringify(switchRes)}`);
      }

      const healthAfter = await emitAsync(staffSocket, 'ping:health');
      const rooms: string[] = healthAfter.rooms || [];

      const inBranchB = rooms.includes(`restaurant_${restaurantId}_branch_${branchBId}`);
      const inBranchA = rooms.includes(`restaurant_${restaurantId}_branch_${branchAId}`);

      if (!inBranchB) throw new Error('Expected socket to be in new branch B room');
      if (inBranchA) throw new Error('Expected socket to have LEFT old branch A room');

      pass('TC-10.2.4: Quản lý HQ switch:branch thành công (rời phòng chi nhánh cũ, vào phòng mới)');
      passed++;
    } catch (err) {
      fail('TC-10.2.4: switch:branch cho HQ', err);
      failed++;
    }

    // TEST 5: TC-10.2.5 - Branch isolation for branch staff
    let branchBStaffSocket: Socket | null = null;
    try {
      branchBStaffSocket = await createClient({ token: branchBStaffToken });

      // Nhân viên chi nhánh B cố chuyển sang chi nhánh A
      const illegalSwitchRes = await emitAsync(branchBStaffSocket, 'switch:branch', {
        restaurantId,
        toBranchId: branchAId,
      });

      if (illegalSwitchRes?.success !== false || !illegalSwitchRes?.message?.includes('Forbidden')) {
        throw new Error(`Expected Forbidden: Branch isolation, got: ${JSON.stringify(illegalSwitchRes)}`);
      }

      pass('TC-10.2.5: Cưỡng chế phân lập chi nhánh: Nhân viên con bị từ chối switch sang chi nhánh khác');
      passed++;
    } catch (err) {
      fail('TC-10.2.5: Phân lập chi nhánh socket', err);
      failed++;
    }

    // TEST 6: TC-10.2.6 - leave:table and leave:restaurant
    try {
      if (!tableGuestSocket) throw new Error('Table guest socket not connected');

      const leaveTableRes = await emitAsync(tableGuestSocket, 'leave:table', { tableId });
      if (leaveTableRes?.success !== true) throw new Error('Expected leave:table success');

      const healthGuest = await emitAsync(tableGuestSocket, 'ping:health');
      if ((healthGuest.rooms || []).includes(`table_${tableId}`)) {
        throw new Error('Expected table room to be removed from socket');
      }

      pass('TC-10.2.6: Rời phòng bàn (leave:table) thành công');
      passed++;
    } catch (err) {
      fail('TC-10.2.6: leave:table', err);
      failed++;
    }

    // TEST 7: TC-10.2.7 - Event broadcast: table.call_staff
    try {
      if (!staffSocket || !tableGuestSocket) throw new Error('Sockets not connected');

      // Re-join table for guest
      await emitAsync(tableGuestSocket, 'join:table', { tableId });

      let receivedOnStaff: any = null;
      let receivedOnGuestTable: any = null;

      staffSocket.on('table:call_staff', (data) => {
        receivedOnStaff = data;
      });

      tableGuestSocket.on('table:call_staff', (data) => {
        receivedOnGuestTable = data;
      });

      const callPayload = {
        notificationId: 'notif-test-01',
        tableId,
        tableName: 'Bàn VIP 001',
        tableCode: 'TB-01',
        branchId: branchBId, // Staff socket is currently in branchB room
        restaurantId,
        reason: 'Xin thêm khăn lạnh',
        note: '',
        createdAt: new Date().toISOString(),
      };

      eventEmitter.emit('table.call_staff', callPayload);

      // Wait for socket broadcast
      await new Promise((r) => setTimeout(r, 200));

      if (!receivedOnStaff || receivedOnStaff.reason !== 'Xin thêm khăn lạnh') {
        throw new Error(`Staff socket did not receive table:call_staff event: ${JSON.stringify(receivedOnStaff)}`);
      }
      if (!receivedOnGuestTable || receivedOnGuestTable.tableId !== tableId) {
        throw new Error(`Table guest socket did not receive table:call_staff event: ${JSON.stringify(receivedOnGuestTable)}`);
      }

      pass('TC-10.2.7: Phát sự kiện table.call_staff tới cả phòng nhân viên và phòng bàn của khách');
      passed++;
    } catch (err) {
      fail('TC-10.2.7: table.call_staff broadcast', err);
      failed++;
    }

    // TEST 8: TC-10.2.8 - Event broadcast: table.call_acknowledged
    try {
      if (!staffSocket || !tableGuestSocket) throw new Error('Sockets not connected');

      let ackOnStaff: any = null;
      let ackOnGuest: any = null;

      staffSocket.on('table:call_acknowledged', (data) => {
        ackOnStaff = data;
      });

      tableGuestSocket.on('table:call_acknowledged', (data) => {
        ackOnGuest = data;
      });

      const ackPayload = {
        tableId,
        tableName: 'Bàn VIP 001',
        branchId: branchBId,
        restaurantId,
        acknowledgedBy: 'Quản Lý Thu Ngân',
        acknowledgedAt: new Date().toISOString(),
      };

      eventEmitter.emit('table.call_acknowledged', ackPayload);

      await new Promise((r) => setTimeout(r, 200));

      if (!ackOnStaff || ackOnStaff.acknowledgedBy !== 'Quản Lý Thu Ngân') {
        throw new Error('Staff did not receive table:call_acknowledged');
      }
      if (!ackOnGuest || ackOnGuest.tableId !== tableId) {
        throw new Error('Guest at table did not receive table:call_acknowledged');
      }

      pass('TC-10.2.8: Phát sự kiện table.call_acknowledged đồng bộ tức thì cho nhân viên & khách tại bàn');
      passed++;
    } catch (err) {
      fail('TC-10.2.8: table.call_acknowledged broadcast', err);
      failed++;
    }

    // TEST 9: TC-10.2.9 - Event broadcast: table.qr_updated
    try {
      if (!staffSocket || !tableGuestSocket) throw new Error('Sockets not connected');

      let qrUpdatedOnStaff: any = null;
      let qrUpdatedOnGuest: any = null;

      staffSocket.on('table:qr_updated', (data) => {
        qrUpdatedOnStaff = data;
      });

      tableGuestSocket.on('table:qr_updated', (data) => {
        qrUpdatedOnGuest = data;
      });

      eventEmitter.emit('table.qr_updated', {
        tableId,
        qrStatus: 'revoked',
        restaurantId,
        branchId: branchBId,
      });

      await new Promise((r) => setTimeout(r, 200));

      if (!qrUpdatedOnStaff || qrUpdatedOnStaff.qrStatus !== 'revoked') {
        throw new Error('Staff did not receive table:qr_updated');
      }
      if (!qrUpdatedOnGuest || qrUpdatedOnGuest.qrStatus !== 'revoked') {
        throw new Error('Table guest did not receive table:qr_updated');
      }

      pass('TC-10.2.9: Phát sự kiện table.qr_updated khi thu hồi/đổi QR');
      passed++;
    } catch (err) {
      fail('TC-10.2.9: table.qr_updated broadcast', err);
      failed++;
    }

    // Clean up sockets
    staffSocket?.disconnect();
    guestSocket?.disconnect();
    tableGuestSocket?.disconnect();
    branchBStaffSocket?.disconnect();

  } catch (globalErr) {
    console.error('Fatal test error:', globalErr);
    failed++;
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n------------------------------------------------------------------------`);
  console.log(`Phase 10 Suite 2 Result: ${colors.green}${passed} Passed${colors.reset}, ${failed > 0 ? colors.red : colors.reset}${failed} Failed`);
  console.log(`------------------------------------------------------------------------\n`);

  if (failed > 0) process.exit(1);
}

main();
