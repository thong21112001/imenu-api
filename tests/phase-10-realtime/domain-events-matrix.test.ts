import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { io, Socket } from 'socket.io-client';

const TEST_PORT = 3127;
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

function waitForEvent<T = any>(socket: Socket | null, eventName: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error(`Cannot wait for event "${eventName}" on null socket`));
    const timer = setTimeout(() => {
      socket.off(eventName, listener);
      reject(new Error(`Timeout waiting for event "${eventName}" on socket ${socket.id}`));
    }, timeoutMs);

    const listener = (data: T) => {
      clearTimeout(timer);
      socket.off(eventName, listener);
      resolve(data);
    };

    socket.on(eventName, listener);
  });
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 10 Suite 3: Domain Events Realtime Matrix (Port ${TEST_PORT})   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;
  let staffSocket: Socket | null = null;
  let guestTableSocket: Socket | null = null;

  try {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    await app.listen(TEST_PORT);

    const jwtService = app.get<JwtService>(JwtService);
    const eventEmitter = app.get<EventEmitter2>(EventEmitter2);

    const restaurantId = '666000000000000000000010';
    const branchId = 'branch-matrix-01';
    const tableId = 'table-matrix-777';
    const orderId = 'order-matrix-888';
    const orderCode = 'ORD-P10-888';

    const staffToken = jwtService.sign({
      id: 'staff-matrix-01',
      sub: 'staff-matrix-01',
      restaurantId,
      branchId,
      isMainBranch: true,
      role: 'RESTAURANT_ADMIN',
    });

    // 1. Connect staff and table sockets
    staffSocket = await createClient({ token: staffToken });
    guestTableSocket = await createClient({
      query: { tableId, restaurantId },
    });

    // -------------------------------------------------------------------------
    // GROUP 1: NEW_ORDER (order:created & NEW_ORDER)
    // -------------------------------------------------------------------------
    try {
      const waitStaffOrderCreated = waitForEvent(staffSocket, 'order:created');

      const payload = {
        orderId,
        orderCode,
        tableId,
        tableName: 'Bàn 77',
        restaurantId,
        branchId,
        totalAmount: 185000,
        createdAt: new Date().toISOString(),
      };

      eventEmitter.emit('order.created', payload);
      const received = await waitStaffOrderCreated;

      if (received?.orderCode === orderCode && received?.restaurantId === restaurantId) {
        pass('TC-10.3.1: Nhóm 1: NEW_ORDER (order:created) phát tới phòng nhân viên thành công');
        passed++;
      } else {
        fail('TC-10.3.1: NEW_ORDER payload không khớp', received);
        failed++;
      }
    } catch (err) {
      fail('TC-10.3.1: NEW_ORDER', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // GROUP 2: ORDER_STATUS_UPDATED (order:confirmed, order:round_added, order:round_confirmed, order:item_status_updated)
    // -------------------------------------------------------------------------
    try {
      // 2A: order:confirmed
      const waitStaffConfirmed = waitForEvent(staffSocket, 'order:confirmed');
      const waitGuestConfirmed = waitForEvent(guestTableSocket, 'order:confirmed');

      const confirmedPayload = {
        order: { id: orderId, orderCode, status: 'Preparing', tableId },
        restaurantId,
        branchId,
        tableId,
      };

      eventEmitter.emit('order.confirmed', confirmedPayload);
      const [staffConf, guestConf] = await Promise.all([waitStaffConfirmed, waitGuestConfirmed]);

      if (staffConf?.order?.status === 'Preparing' && guestConf?.order?.status === 'Preparing') {
        pass('TC-10.3.2A: Nhóm 2: ORDER_STATUS_UPDATED (order:confirmed) phát đồng bộ tới Staff và Khách tại bàn');
        passed++;
      } else {
        fail('TC-10.3.2A: order:confirmed payload mismatch', { staffConf, guestConf });
        failed++;
      }
    } catch (err) {
      fail('TC-10.3.2A: order:confirmed', err);
      failed++;
    }

    try {
      // 2B: order:round_added & order:round_confirmed
      const waitStaffRoundAdd = waitForEvent(staffSocket, 'order:round_added');
      const waitGuestRoundAdd = waitForEvent(guestTableSocket, 'order:round_added');

      const roundPayload = {
        order: { id: orderId, orderCode, tableId },
        restaurantId,
        branchId,
        roundNumber: 2,
        isCustomer: true,
      };

      eventEmitter.emit('order.round_added', roundPayload);
      const [staffRound, guestRound] = await Promise.all([waitStaffRoundAdd, waitGuestRoundAdd]);

      if (staffRound?.roundNumber === 2 && guestRound?.roundNumber === 2) {
        pass('TC-10.3.2B: Nhóm 2: ORDER_STATUS_UPDATED (order:round_added) phát đồng bộ tới Staff và Khách tại bàn');
        passed++;
      } else {
        fail('TC-10.3.2B: order:round_added mismatch', { staffRound, guestRound });
        failed++;
      }
    } catch (err) {
      fail('TC-10.3.2B: order:round_added', err);
      failed++;
    }

    try {
      // 2C: order:item_status_updated
      const waitStaffItemStatus = waitForEvent(staffSocket, 'order:item_status_updated');
      const waitGuestItemStatus = waitForEvent(guestTableSocket, 'order:item_status_updated');

      const itemStatusPayload = {
        orderId,
        orderCode,
        tableId,
        itemId: 'item-pho-bo-01',
        status: 'Ready',
        restaurantId,
        branchId,
      };

      eventEmitter.emit('order.item_status_updated', itemStatusPayload);
      const [staffItem, guestItem] = await Promise.all([waitStaffItemStatus, waitGuestItemStatus]);

      if (staffItem?.status === 'Ready' && guestItem?.status === 'Ready') {
        pass('TC-10.3.2C: Nhóm 2: ORDER_STATUS_UPDATED (order:item_status_updated) phát khi KDS hoàn tất món');
        passed++;
      } else {
        fail('TC-10.3.2C: order:item_status_updated mismatch', { staffItem, guestItem });
        failed++;
      }
    } catch (err) {
      fail('TC-10.3.2C: order:item_status_updated', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // GROUP 3: TABLE_STATUS_UPDATED (table:status_updated & table:qr_updated)
    // -------------------------------------------------------------------------
    try {
      const waitStaffTableStatus = waitForEvent(staffSocket, 'table:status_updated');

      const tableStatusPayload = {
        tableId,
        status: 'Occupied',
        restaurantId,
        branchId,
      };

      eventEmitter.emit('table.status_updated', tableStatusPayload);
      const received = await waitStaffTableStatus;

      if (received?.status === 'Occupied' && received?.tableId === tableId) {
        pass('TC-10.3.3A: Nhóm 3: TABLE_STATUS_UPDATED (table:status_updated) phát cập nhật trạng thái bàn');
        passed++;
      } else {
        fail('TC-10.3.3A: table:status_updated mismatch', received);
        failed++;
      }
    } catch (err) {
      fail('TC-10.3.3A: table:status_updated', err);
      failed++;
    }

    try {
      const waitStaffQr = waitForEvent(staffSocket, 'table:qr_updated');
      const waitGuestQr = waitForEvent(guestTableSocket, 'table:qr_updated');

      const qrPayload = {
        tableId,
        qrStatus: 'revoked',
        qrToken: 'new-token-revoked',
        restaurantId,
        branchId,
      };

      eventEmitter.emit('table.qr_updated', qrPayload);
      const [staffQr, guestQr] = await Promise.all([waitStaffQr, waitGuestQr]);

      if (staffQr?.qrStatus === 'revoked' && guestQr?.qrStatus === 'revoked') {
        pass('TC-10.3.3B: Nhóm 3: TABLE_STATUS_UPDATED (table:qr_updated) phát thu hồi/đổi QR tới Staff & Khách');
        passed++;
      } else {
        fail('TC-10.3.3B: table:qr_updated mismatch', { staffQr, guestQr });
        failed++;
      }
    } catch (err) {
      fail('TC-10.3.3B: table:qr_updated', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // GROUP 4: CALL_STAFF (table:call_staff & table:call_acknowledged)
    // -------------------------------------------------------------------------
    try {
      const waitStaffCall = waitForEvent(staffSocket, 'table:call_staff');
      const waitGuestCall = waitForEvent(guestTableSocket, 'table:call_staff');

      const callPayload = {
        tableId,
        tableName: 'Bàn 77',
        reason: 'Xin thêm đá lạnh',
        note: 'Đá to',
        restaurantId,
        branchId,
      };

      eventEmitter.emit('table.call_staff', callPayload);
      const [staffCall, guestCall] = await Promise.all([waitStaffCall, waitGuestCall]);

      if (staffCall?.reason === 'Xin thêm đá lạnh' && guestCall?.reason === 'Xin thêm đá lạnh') {
        pass('TC-10.3.4A: Nhóm 4: CALL_STAFF (table:call_staff) phát tới phòng nhân viên và khách tại bàn');
        passed++;
      } else {
        fail('TC-10.3.4A: table:call_staff mismatch', { staffCall, guestCall });
        failed++;
      }
    } catch (err) {
      fail('TC-10.3.4A: table:call_staff', err);
      failed++;
    }

    try {
      const waitStaffAck = waitForEvent(staffSocket, 'table:call_acknowledged');
      const waitGuestAck = waitForEvent(guestTableSocket, 'table:call_acknowledged');

      const ackPayload = {
        tableId,
        tableName: 'Bàn 77',
        acknowledgedBy: 'Trần Văn Phục Vụ',
        acknowledgedAt: new Date().toISOString(),
        restaurantId,
        branchId,
      };

      eventEmitter.emit('table.call_acknowledged', ackPayload);
      const [staffAck, guestAck] = await Promise.all([waitStaffAck, waitGuestAck]);

      if (staffAck?.acknowledgedBy === 'Trần Văn Phục Vụ' && guestAck?.acknowledgedBy === 'Trần Văn Phục Vụ') {
        pass('TC-10.3.4B: Nhóm 4: CALL_STAFF (table:call_acknowledged) phản hồi xác nhận tiếp nhận tới khách');
        passed++;
      } else {
        fail('TC-10.3.4B: table:call_acknowledged mismatch', { staffAck, guestAck });
        failed++;
      }
    } catch (err) {
      fail('TC-10.3.4B: table:call_acknowledged', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // GROUP 5: PAYMENT_REQUESTED (order:payment_requested)
    // -------------------------------------------------------------------------
    try {
      const waitStaffPayReq = waitForEvent(staffSocket, 'order:payment_requested');
      const waitGuestPayReq = waitForEvent(guestTableSocket, 'order:payment_requested');

      const payReqPayload = {
        order: { id: orderId, orderCode, totalAmount: 250000, tableId },
        restaurantId,
        branchId,
      };

      eventEmitter.emit('order.payment_requested', payReqPayload);
      const [staffPayReq, guestPayReq] = await Promise.all([waitStaffPayReq, waitGuestPayReq]);

      if (staffPayReq?.order?.orderCode === orderCode && guestPayReq?.order?.orderCode === orderCode) {
        pass('TC-10.3.5: Nhóm 5: PAYMENT_REQUESTED (order:payment_requested) phát chuông tới thu ngân & khách');
        passed++;
      } else {
        fail('TC-10.3.5: order:payment_requested mismatch', { staffPayReq, guestPayReq });
        failed++;
      }
    } catch (e) {
      fail('TC-10.3.5: order:payment_requested', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // GROUP 6: PAYMENT_COMPLETED (order:payment_completed)
    // -------------------------------------------------------------------------
    try {
      const waitStaffPayDone = waitForEvent(staffSocket, 'order:payment_completed');
      const waitGuestPayDone = waitForEvent(guestTableSocket, 'order:payment_completed');

      const payDonePayload = {
        order: { id: orderId, orderCode, status: 'Paid', tableId },
        tableId,
        restaurantId,
        branchId,
      };

      eventEmitter.emit('order.payment_completed', payDonePayload);
      const [staffPayDone, guestPayDone] = await Promise.all([waitStaffPayDone, waitGuestPayDone]);

      if (staffPayDone?.order?.status === 'Paid' && guestPayDone?.order?.status === 'Paid') {
        pass('TC-10.3.6: Nhóm 6: PAYMENT_COMPLETED (order:payment_completed) phát hoàn tất đơn thanh toán');
        passed++;
      } else {
        fail('TC-10.3.6: order:payment_completed mismatch', { staffPayDone, guestPayDone });
        failed++;
      }
    } catch (e) {
      fail('TC-10.3.6: order:payment_completed', e);
      failed++;
    }

    // -------------------------------------------------------------------------
    // GROUP 7: MENU_AVAILABILITY_CHANGED (menu:availability_changed)
    // -------------------------------------------------------------------------
    try {
      const waitStaffMenu = waitForEvent(staffSocket, 'menu:availability_changed');
      const waitGuestMenu = waitForEvent(guestTableSocket, 'menu:availability_changed');

      const menuPayload = {
        menuItemId: 'menu-lau-thai-01',
        item: { id: 'menu-lau-thai-01', name: 'Lẩu Thái Hải Sản' },
        isAvailable: false,
        effectiveIsAvailable: false,
        restaurantId,
        branchId,
      };

      eventEmitter.emit('menu.availability_changed', menuPayload);
      const [staffMenu, guestMenu] = await Promise.all([waitStaffMenu, waitGuestMenu]);

      if (staffMenu?.effectiveIsAvailable === false && guestMenu?.effectiveIsAvailable === false) {
        pass('TC-10.3.7: Nhóm 7: MENU_AVAILABILITY_CHANGED phát tới Staff VÀ Guest (public_menu) khi hết món');
        passed++;
      } else {
        fail('TC-10.3.7: menu:availability_changed mismatch', { staffMenu, guestMenu });
        failed++;
      }
    } catch (e) {
      fail('TC-10.3.7: menu:availability_changed', e);
      failed++;
    }

  } catch (err: any) {
    console.error('Fatal Suite 3 Error:', err);
  } finally {
    if (staffSocket) {
      staffSocket.removeAllListeners();
      staffSocket.disconnect();
    }
    if (guestTableSocket) {
      guestTableSocket.removeAllListeners();
      guestTableSocket.disconnect();
    }
    if (app) {
      await app.close();
    }
  }

  console.log(`\n------------------------------------------------------------------------`);
  console.log(`Phase 10 Suite 3 Result: ${passed} Passed, ${failed} Failed`);
  console.log(`------------------------------------------------------------------------\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
