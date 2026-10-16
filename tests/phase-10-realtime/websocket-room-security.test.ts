import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';

const TEST_PORT = 3126;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 10 Suite 2: WebSocket Room Security & Isolation (Port ${TEST_PORT}) ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  try {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    await app.listen(TEST_PORT);

    const jwtService = app.get<JwtService>(JwtService);

    const restaurantAId = '666000000000000000000001';
    const restaurantBId = '666000000000000000000002';
    const branchA1Id = 'branch-hcm-01';
    const branchA2Id = 'branch-danang-02';
    const branchB1Id = 'branch-b-hanoi-01';
    const tableAId = 'table-vip-001';
    const tableBId = 'table-b-001';

    // 1. JWT Tokens
    const hqOwnerTokenA = jwtService.sign({
      id: 'user-hq-a',
      sub: 'user-hq-a',
      restaurantId: restaurantAId,
      branchId: branchA1Id,
      isMainBranch: true,
      role: 'RESTAURANT_ADMIN',
    });

    const branchA2StaffToken = jwtService.sign({
      id: 'user-branch-a2',
      sub: 'user-branch-a2',
      restaurantId: restaurantAId,
      branchId: branchA2Id,
      isMainBranch: false,
      role: 'WAITER',
    });

    // TEST 1: TC-10.2.1 - Staff with valid JWT auto joins restaurant and branch room on connect
    let staffSocketA: Socket | null = null;
    try {
      staffSocketA = await createClient({ token: hqOwnerTokenA });
      const health = await emitAsync(staffSocketA, 'ping:health');

      if (!health || health.status !== 'ok') throw new Error('Expected health status ok');
      const rooms: string[] = health.rooms || [];
      const hasRestRoom = rooms.includes(`restaurant_${restaurantAId}`);
      const hasBranchRoom = rooms.includes(`restaurant_${restaurantAId}_branch_${branchA1Id}`);

      if (!hasRestRoom || !hasBranchRoom) {
        throw new Error(`Expected rooms restaurant_${restaurantAId} and branch_${branchA1Id}, got: ${JSON.stringify(rooms)}`);
      }

      pass('TC-10.2.1: Nhân viên có JWT tự động join phòng nhà hàng & chi nhánh');
      passed++;
    } catch (err) {
      fail('TC-10.2.1: Nhân viên join phòng', err);
      failed++;
    }

    // TEST 2: TC-10.2.2 - Staff of restaurant A tries to join restaurant B room -> Rejected
    try {
      if (!staffSocketA) throw new Error('Staff socket not connected');
      const joinRestBRes = await emitAsync(staffSocketA, 'join:restaurant', { restaurantId: restaurantBId });

      if (joinRestBRes?.success !== false || (!joinRestBRes?.message?.includes('Unauthorized') && !joinRestBRes?.message?.includes('Forbidden'))) {
        throw new Error(`Expected Unauthorized / Forbidden cross-tenant rejection, got: ${JSON.stringify(joinRestBRes)}`);
      }

      pass('TC-10.2.2: Staff nhà hàng A cố tình join phòng nhà hàng B -> Bị từ chối { success: false }');
      passed++;
    } catch (err) {
      fail('TC-10.2.2: Chặn staff join phòng nhà hàng khác', err);
      failed++;
    }

    // TEST 3: TC-10.2.3 - Staff of restaurant A tries to join table of restaurant B -> Rejected
    try {
      if (!staffSocketA) throw new Error('Staff socket not connected');
      const joinTableBRes = await emitAsync(staffSocketA, 'join:table', {
        tableId: tableBId,
        restaurantId: restaurantBId,
      });

      if (joinTableBRes?.success !== false || (!joinTableBRes?.message?.includes('Unauthorized') && !joinTableBRes?.message?.includes('Forbidden'))) {
        throw new Error(`Expected Unauthorized / Forbidden cross-tenant table rejection, got: ${JSON.stringify(joinTableBRes)}`);
      }

      pass('TC-10.2.3: Staff nhà hàng A cố tình join phòng bàn nhà hàng B -> Bị từ chối { success: false }');
      passed++;
    } catch (err) {
      fail('TC-10.2.3: Chặn staff join bàn nhà hàng khác', err);
      failed++;
    }

    // TEST 4: TC-10.2.4 - Guest client without JWT cannot join staff restaurant room directly
    let guestSocket: Socket | null = null;
    try {
      guestSocket = await createClient(); // Unauthenticated guest
      const joinRes = await emitAsync(guestSocket, 'join:restaurant', { restaurantId: restaurantAId });

      if (joinRes?.success !== false || !joinRes?.message?.includes('Unauthorized')) {
        throw new Error(`Expected Unauthorized rejection, got: ${JSON.stringify(joinRes)}`);
      }

      pass('TC-10.2.4: Khách vãng lai không có JWT bị chặn khi cố join phòng nhà hàng nhân viên');
      passed++;
    } catch (err) {
      fail('TC-10.2.4: Chặn khách join phòng nhà hàng', err);
      failed++;
    }

    // TEST 5: TC-10.2.5 - Guest connects with tableId & restaurantId query params -> Isolated to table & public_menu only
    let tableGuestSocket: Socket | null = null;
    try {
      tableGuestSocket = await createClient({
        query: { tableId: tableAId, restaurantId: restaurantAId },
      });
      const health = await emitAsync(tableGuestSocket, 'ping:health');
      const rooms: string[] = health.rooms || [];

      const hasTableRoom = rooms.includes(`table_${tableAId}`);
      const hasPublicMenuRoom = rooms.includes(`public_menu_${restaurantAId}`);
      const hasStaffRestRoom = rooms.includes(`restaurant_${restaurantAId}`);

      if (!hasTableRoom || !hasPublicMenuRoom) {
        throw new Error(`Expected table_${tableAId} and public_menu_${restaurantAId}, got: ${JSON.stringify(rooms)}`);
      }
      if (hasStaffRestRoom) {
        throw new Error(`Security breach: Guest should NOT be in restaurant_${restaurantAId}`);
      }

      pass('TC-10.2.5: Khách quét QR chỉ tham gia room bàn và public_menu, không thể join room nhân viên');
      passed++;
    } catch (err) {
      fail('TC-10.2.5: Phân lập phòng khách quét QR', err);
      failed++;
    }

    // TEST 6: TC-10.2.6 - HQ owner sends switch:branch dynamically between branches -> Success
    try {
      if (!staffSocketA) throw new Error('Staff socket not connected');

      const switchRes = await emitAsync(staffSocketA, 'switch:branch', {
        restaurantId: restaurantAId,
        fromBranchId: branchA1Id,
        toBranchId: branchA2Id,
      });

      if (!switchRes || switchRes.success !== true) {
        throw new Error(`Expected switch:branch success, got: ${JSON.stringify(switchRes)}`);
      }

      const healthAfter = await emitAsync(staffSocketA, 'ping:health');
      const rooms: string[] = healthAfter.rooms || [];

      const inBranchA2 = rooms.includes(`restaurant_${restaurantAId}_branch_${branchA2Id}`);
      const inBranchA1 = rooms.includes(`restaurant_${restaurantAId}_branch_${branchA1Id}`);

      if (!inBranchA2) throw new Error('Expected socket to be in new branch A2 room');
      if (inBranchA1) throw new Error('Expected socket to have LEFT old branch A1 room');

      pass('TC-10.2.6: Chủ nhà hàng (HQ) switch:branch chuyển đổi linh hoạt giữa các chi nhánh thành công');
      passed++;
    } catch (err) {
      fail('TC-10.2.6: switch:branch cho HQ', err);
      failed++;
    }

    // TEST 7: TC-10.2.7 - Branch staff tries to switch:branch to another branch -> Rejected
    let branchA2StaffSocket: Socket | null = null;
    try {
      branchA2StaffSocket = await createClient({ token: branchA2StaffToken });

      const illegalSwitchRes = await emitAsync(branchA2StaffSocket, 'switch:branch', {
        restaurantId: restaurantAId,
        toBranchId: branchA1Id,
      });

      if (illegalSwitchRes?.success !== false || !illegalSwitchRes?.message?.includes('Forbidden')) {
        throw new Error(`Expected Forbidden: Branch isolation, got: ${JSON.stringify(illegalSwitchRes)}`);
      }

      pass('TC-10.2.7: Cưỡng chế phân lập chi nhánh: Nhân viên chi nhánh con cố tình switch sang chi nhánh khác bị từ chối');
      passed++;
    } catch (err) {
      fail('TC-10.2.7: Phân lập chi nhánh socket', err);
      failed++;
    }

    // TEST 8: TC-10.2.8 - Client leaves table room (leave:table)
    try {
      if (!tableGuestSocket) throw new Error('Table guest socket not connected');

      const leaveTableRes = await emitAsync(tableGuestSocket, 'leave:table', { tableId: tableAId });
      if (leaveTableRes?.success !== true) throw new Error('Expected leave:table success');

      const healthGuest = await emitAsync(tableGuestSocket, 'ping:health');
      if ((healthGuest.rooms || []).includes(`table_${tableAId}`)) {
        throw new Error('Expected table room to be removed from socket');
      }

      pass('TC-10.2.8: Client rời phòng bàn (leave:table) thành công');
      passed++;
    } catch (err) {
      fail('TC-10.2.8: leave:table', err);
      failed++;
    }

    // TEST 9: TC-10.2.9 - Client leaves restaurant room (leave:restaurant)
    try {
      if (!staffSocketA) throw new Error('Staff socket not connected');

      const leaveRestRes = await emitAsync(staffSocketA, 'leave:restaurant', { restaurantId: restaurantAId });
      if (leaveRestRes?.success !== true) throw new Error('Expected leave:restaurant success');

      const healthStaff = await emitAsync(staffSocketA, 'ping:health');
      if ((healthStaff.rooms || []).includes(`restaurant_${restaurantAId}`)) {
        throw new Error('Expected restaurant room to be removed from socket');
      }

      pass('TC-10.2.9: Client rời phòng nhà hàng (leave:restaurant) thành công');
      passed++;
    } catch (err) {
      fail('TC-10.2.9: leave:restaurant', err);
      failed++;
    }

    // TEST 10: TC-10.2.10 - Health check ping:health returns pong with timestamp
    try {
      if (!guestSocket) throw new Error('Guest socket not connected');
      const healthRes = await emitAsync(guestSocket, 'ping:health');

      if (healthRes?.status !== 'ok' || typeof healthRes?.timestamp !== 'number') {
        throw new Error(`Expected health ok with timestamp, got: ${JSON.stringify(healthRes)}`);
      }

      pass('TC-10.2.10: Health ping ping:health phản hồi pong kèm timestamp');
      passed++;
    } catch (err) {
      fail('TC-10.2.10: ping:health', err);
      failed++;
    }

    if (staffSocketA) staffSocketA.disconnect();
    if (guestSocket) guestSocket.disconnect();
    if (tableGuestSocket) tableGuestSocket.disconnect();
    if (branchA2StaffSocket) branchA2StaffSocket.disconnect();

  } catch (err: any) {
    console.error('Fatal Suite 2 Error:', err);
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n------------------------------------------------------------------------`);
  console.log(`Phase 10 Suite 2 Result: ${passed} Passed, ${failed} Failed`);
  console.log(`------------------------------------------------------------------------\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
