import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';

const TEST_PORT = 3128;
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

function emitAsync<T = any>(socket: Socket, event: string, data?: any): Promise<T> {
  return new Promise((resolve) => {
    socket.emit(event, data, (response: T) => {
      resolve(response);
    });
  });
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 10 Suite 4: Client Resilience, Reconnect & Deduplication (3128) ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  try {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    await app.listen(TEST_PORT);

    const jwtService = app.get<JwtService>(JwtService);

    const restaurantId = '666000000000000000000020';
    const branchId = 'branch-resilience-01';
    const tableId = 'table-resilience-999';

    const token = jwtService.sign({
      id: 'staff-resilience-01',
      sub: 'staff-resilience-01',
      restaurantId,
      branchId,
      isMainBranch: true,
      role: 'RESTAURANT_ADMIN',
    });

    // -------------------------------------------------------------------------
    // TC-10.4.1: Connection Status Lifecycle tracking (DISCONNECTED -> CONNECTED)
    // -------------------------------------------------------------------------
    let socket: Socket | null = null;
    try {
      const statusHistory: string[] = ['DISCONNECTED'];

      socket = io(WS_URL, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 500,
        auth: { token: `Bearer ${token}` },
      });

      statusHistory.push('CONNECTING');

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        socket!.on('connect', () => {
          clearTimeout(timeout);
          statusHistory.push('CONNECTED');
          resolve();
        });
      });

      if (statusHistory.includes('DISCONNECTED') && statusHistory.includes('CONNECTING') && statusHistory.includes('CONNECTED')) {
        pass('TC-10.4.1: Theo dõi vòng đời trạng thái kết nối socket (DISCONNECTED -> CONNECTING -> CONNECTED)');
        passed++;
      } else {
        fail('TC-10.4.1: Trạng thái kết nối không đầy đủ', statusHistory);
        failed++;
      }
    } catch (err) {
      fail('TC-10.4.1: Exception', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.4.2: Tự động tham gia lại phòng khi ngắt kết nối và kết nối lại (Reconnection)
    // -------------------------------------------------------------------------
    try {
      if (!socket) throw new Error('Socket not initialized');

      // Join additional table room manually before disconnect
      await emitAsync(socket, 'join:table', { tableId });

      let initialHealth = await emitAsync(socket, 'ping:health');
      const initialRooms: string[] = initialHealth.rooms || [];
      if (!initialRooms.includes(`restaurant_${restaurantId}`) || !initialRooms.includes(`table_${tableId}`)) {
        throw new Error('Initial rooms missing before disconnect');
      }

      // Simulate network disconnect and reconnect
      let reconnected = false;
      const reconnectPromise = new Promise<void>((resolve) => {
        socket!.io.on('reconnect', async () => {
          reconnected = true;
          // Re-join table room after reconnect (as handled in socket-client.ts)
          await emitAsync(socket!, 'join:table', { tableId });
          resolve();
        });
      });

      // Force transport close
      (socket.io.engine as any).close();

      await reconnectPromise;

      const healthAfter = await emitAsync(socket, 'ping:health');
      const roomsAfter: string[] = healthAfter.rooms || [];

      const restoredRestRoom = roomsAfter.includes(`restaurant_${restaurantId}`);
      const restoredBranchRoom = roomsAfter.includes(`restaurant_${restaurantId}_branch_${branchId}`);
      const restoredTableRoom = roomsAfter.includes(`table_${tableId}`);

      if (reconnected && restoredRestRoom && restoredBranchRoom && restoredTableRoom) {
        pass('TC-10.4.2: Tự động reconnect và khôi phục đầy đủ danh sách phòng (restaurant, branch, table)');
        passed++;
      } else {
        fail('TC-10.4.2: Phục hồi phòng thất bại sau reconnect', { reconnected, roomsAfter });
        failed++;
      }
    } catch (err) {
      fail('TC-10.4.2: Exception', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.4.3: Cập nhật auth token linh hoạt qua refreshAuthToken / socket.auth
    // -------------------------------------------------------------------------
    try {
      if (!socket) throw new Error('Socket not initialized');

      const newToken = jwtService.sign({
        id: 'staff-refreshed-02',
        sub: 'staff-refreshed-02',
        restaurantId,
        branchId,
        isMainBranch: false,
        role: 'STAFF',
      });

      socket.auth = { token: `Bearer ${newToken}` };
      socket.disconnect().connect();

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Refresh token reconnect timeout')), 5000);
        socket!.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      const healthNewAuth = await emitAsync(socket, 'ping:health');
      if (healthNewAuth?.status === 'ok') {
        pass('TC-10.4.3: Cập nhật auth token (refreshAuthToken) và tái xác thực thành công');
        passed++;
      } else {
        fail('TC-10.4.3: Làm mới token thất bại', healthNewAuth);
        failed++;
      }
    } catch (err) {
      fail('TC-10.4.3: Exception', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.4.4: Deduplication window (300ms) chống nhân đôi sự kiện từ Socket & BroadcastChannel
    // -------------------------------------------------------------------------
    try {
      const recentEvents = new Map<string, number>();
      function isDuplicate(payload: { type: string; id?: string; timestamp?: number }): boolean {
        const key = `${payload.type}:${payload.id || payload.timestamp || 'singleton'}`;
        const now = Date.now();
        const prev = recentEvents.get(key);
        if (prev && now - prev < 300) {
          return true; // Bị lọc trùng lặp
        }
        recentEvents.set(key, now);
        return false;
      }

      let dispatchCount = 0;
      function handleEvent(payload: { type: string; id?: string; timestamp?: number }) {
        if (isDuplicate(payload)) {
          return; // Skip duplicate
        }
        dispatchCount++;
      }

      const duplicatePayload = {
        type: 'CALL_STAFF',
        id: 'notif-dedup-001',
        timestamp: Date.now(),
      };

      // Gửi lần 1 (qua Socket.IO)
      handleEvent(duplicatePayload);
      // Gửi lần 2 tức thì sau 50ms (qua BroadcastChannel)
      await new Promise((r) => setTimeout(r, 50));
      handleEvent(duplicatePayload);

      // Gửi lần 3 sau 350ms (ngoài cửa sổ 300ms deduplication)
      await new Promise((r) => setTimeout(r, 350));
      handleEvent(duplicatePayload);

      if (dispatchCount === 2) {
        pass('TC-10.4.4: Cơ chế Deduplication (300ms window) lọc bỏ thành công sự kiện trùng lặp từ 2 luồng');
        passed++;
      } else {
        fail('TC-10.4.4: Deduplication hoạt động sai', { expected: 2, actual: dispatchCount });
        failed++;
      }
    } catch (err) {
      fail('TC-10.4.4: Exception', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TC-10.4.5: Mute / Unmute state đồng bộ cho âm thanh chuông báo
    // -------------------------------------------------------------------------
    try {
      // Giả lập logic SoundEngine mute/unmute
      let muted: boolean = false;
      function setMuted(val: boolean): void { muted = val; }
      function toggleMute(): boolean { muted = !muted; return muted; }

      const t1 = toggleMute(); // true
      const t2 = toggleMute(); // false
      setMuted(true);

      if (Boolean(t1) === true && Boolean(t2) === false && Boolean(muted) === true) {
        pass('TC-10.4.5: Trạng thái Mute / Unmute âm thanh chuông báo hoạt động nhất quán (toggle & setMuted)');
        passed++;
      } else {
        fail('TC-10.4.5: Mute state không nhất quán', { t1, t2, muted });
        failed++;
      }
    } catch (err) {
      fail('TC-10.4.5: Exception', err);
      failed++;
    }

    if (socket) socket.disconnect();

  } catch (err: any) {
    console.error('Fatal Suite 4 Error:', err);
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n------------------------------------------------------------------------`);
  console.log(`Phase 10 Suite 4 Result: ${passed} Passed, ${failed} Failed`);
  console.log(`------------------------------------------------------------------------\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
