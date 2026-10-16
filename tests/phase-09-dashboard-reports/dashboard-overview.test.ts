import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';

const TEST_PORT = 3120;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 9 Suite 1: Dashboard Overview & Dual-Key Analytics (Port ${TEST_PORT}) ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // 1. BOOTSTRAP NESTJS APP
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

  const connection: Connection = app.get(getConnectionToken());
  const db = connection.db!;
  const timestamp = Date.now();

  let restaurantId = '';
  let branch1Id = `branch-1-${timestamp}`;
  let branch2Id = `branch-2-${timestamp}`;
  let ownerToken = '';
  let cashierToken = '';
  let waiterToken = '';
  let chefNoPermToken = '';
  let branch2StaffToken = '';

  try {
    // -------------------------------------------------------------------------
    // SETUP: Tạo Nhà hàng đa chi nhánh và các nhân viên phân quyền
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}--- BƯỚC 1: KHỞI TẠO TÀI NGUYÊN KIỂM THỬ ---${colors.reset}`);

    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P9 Dashboard Test ${timestamp}`,
          phone: '0912345678',
          address: '456 Hai Ba Trung, Q1, TP.HCM',
        },
        owner: {
          fullName: 'P9 Owner',
          phone: '0912345678',
          email: `owner.p9.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });

    if (regRes.status !== 201) {
      throw new Error(`Đăng ký nhà hàng thất bại: ${JSON.stringify(regRes.data)}`);
    }

    restaurantId = regRes.data.data.restaurant.id || regRes.data.data.restaurant._id;
    ownerToken = regRes.data.data.accessToken;

    const restDoc = await db.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branch1Id = restDoc!.branches[0]._id.toString();

    // Tạo chi nhánh 2 qua API
    const branch2Res = await request('/branches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: `Chi nhánh Quận 3 ${timestamp}`,
        address: 'Chi nhánh 2, Q3',
        phone: '0912345672',
      }),
    });
    branch2Id = (branch2Res.data?.data?._id || branch2Res.data?.data?.id || '').toString();

    // Lấy danh sách Roles hệ thống
    const rolesColl = db.collection('roles');
    const cashierRole = await rolesColl.findOne({ slug: 'cashier' });
    const waiterRole = await rolesColl.findOne({ slug: 'waiter' });
    const kitchenRole = await rolesColl.findOne({ slug: 'kitchen' });

    // Tạo nhân viên thu ngân (cashier) có perm-rep-view
    const cashierRegRes = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Cashier User',
        username: `cashier_${timestamp}`,
        email: `cashier.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0912345679',
        roleId: cashierRole!._id.toString(),
        branchId: branch1Id,
      }),
    });
    const cashierLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `cashier.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    cashierToken = cashierLogin.data.data.accessToken;

    // Tạo nhân viên phục vụ (waiter) có perm-pos-view
    const waiterRegRes = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Waiter User',
        username: `waiter_${timestamp}`,
        email: `waiter.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0912345680',
        roleId: waiterRole!._id.toString(),
        branchId: branch1Id,
      }),
    });
    const waiterLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `waiter.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    waiterToken = waiterLogin.data.data.accessToken;

    // Tạo nhân viên bếp (kitchen) KHÔNG có quyền xem báo cáo (chỉ có perm-kds-*)
    const chefRegRes = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Chef User',
        username: `chef_${timestamp}`,
        email: `chef.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0912345681',
        roleId: kitchenRole!._id.toString(),
        branchId: branch1Id,
      }),
    });
    const chefLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `chef.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    chefNoPermToken = chefLogin.data.data.accessToken;

    // Tạo nhân viên chi nhánh 2 (branch2) có quyền thu ngân (perm-rep-view)
    const branch2StaffRes = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Branch 2 Cashier',
        username: `b2cashier_${timestamp}`,
        email: `b2cashier.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0912345682',
        roleId: cashierRole!._id.toString(),
        branchId: branch2Id,
      }),
    });
    const branch2Login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `b2cashier.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    branch2StaffToken = branch2Login.data.data.accessToken;

    // Tạo 4 bàn: 2 bàn chi nhánh 1 (1 occupied, 1 available), 1 bàn chi nhánh 2 (available), 1 bàn đã xóa mềm isDeleted: true
    const zoneId = new Types.ObjectId();
    await db.collection('tablezones').insertOne({
      _id: zoneId,
      name: 'Tầng 1',
      restaurantId: new Types.ObjectId(restaurantId),
      isActive: true,
    });

    await db.collection('tables').insertMany([
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        zone: zoneId,
        code: `B01_${timestamp}`,
        name: 'Bàn 01',
        status: 'Occupied',
        capacity: 4,
        isDeleted: false,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        zone: zoneId,
        code: `B02_${timestamp}`,
        name: 'Bàn 02',
        status: 'Available',
        capacity: 4,
        isDeleted: false,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch2Id,
        zone: zoneId,
        code: `B03_${timestamp}`,
        name: 'Bàn 03',
        status: 'Available',
        capacity: 2,
        isDeleted: false,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        zone: zoneId,
        code: `B_DEL_${timestamp}`,
        name: 'Bàn Đã Xóa',
        status: 'Available',
        capacity: 4,
        isDeleted: true, // XÓA MỀM - Bắt buộc KHÔNG được đếm
      },
    ]);

    // Tạo đơn hàng mẫu:
    // Đơn 1: Hôm nay, chi nhánh 1, Paid, 150.000 VND (VietQR)
    // Đơn 2: Hôm nay, chi nhánh 1, Đang chuẩn bị (Preparing - Pending kitchen), 100.000 VND (Cash)
    // Đơn 3: Hôm qua, chi nhánh 1, Paid, 120.000 VND (Cash)
    // Đơn 4: Hôm nay, chi nhánh 2, Paid, 200.000 VND (Card)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    await db.collection('orders').insertMany([
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        orderCode: `ORD-TODAY-01-${timestamp}`,
        status: 'Paid',
        isPaid: true,
        totalAmount: 150000,
        paymentMethod: 'VietQR',
        tableName: 'Bàn 01',
        items: [
          { menuItemId: new Types.ObjectId(), name: 'Phở bò', quantity: 2, price: 65000, itemTotal: 130000, status: 'Served' },
          { menuItemId: new Types.ObjectId(), name: 'Trà đá', quantity: 2, price: 10000, itemTotal: 20000, status: 'Served' },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        orderCode: `ORD-TODAY-02-${timestamp}`,
        status: 'Preparing', // Kitchen Pending status!
        isPaid: false,
        totalAmount: 100000,
        paymentMethod: 'Cash',
        tableName: 'Bàn 01',
        items: [
          { menuItemId: new Types.ObjectId(), name: 'Cơm tấm', quantity: 1, price: 100000, itemTotal: 100000, status: 'Cooking' },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        orderCode: `ORD-YEST-03-${timestamp}`,
        status: 'Paid',
        isPaid: true,
        totalAmount: 120000,
        paymentMethod: 'Cash',
        tableName: 'Bàn 02',
        items: [
          { menuItemId: new Types.ObjectId(), name: 'Bún bò', quantity: 2, price: 60000, itemTotal: 120000, status: 'Served' },
        ],
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch2Id,
        orderCode: `ORD-TODAY-04-${timestamp}`,
        status: 'Paid',
        isPaid: true,
        totalAmount: 200000,
        paymentMethod: 'Card',
        tableName: 'Bàn 03',
        items: [
          { menuItemId: new Types.ObjectId(), name: 'Lẩu mini', quantity: 1, price: 200000, itemTotal: 200000, status: 'Served' },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    pass('Tạo dữ liệu thử nghiệm (Nhà hàng, Chi nhánh, Nhân viên, Bàn, Đơn hàng) thành công');
    passed++;

    // -------------------------------------------------------------------------
    // TEST SUITE: PHÂN QUYỀN RBAC CHO GET /api/dashboard/overview
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 2: KIỂM TRA PHÂN QUYỀN RBAC DASHBOARD ---${colors.reset}`);

    // TC-9.1-01: Cashier có perm-rep-view truy cập thành công
    try {
      const res = await request('/dashboard/overview', {
        headers: { Authorization: `Bearer ${cashierToken}` },
      });
      if (res.status === 200 && res.data.success) {
        pass('TC-9.1-01: Cashier có perm-rep-view truy cập Dashboard thành công (HTTP 200)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200 OK nhưng nhận được ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      fail('TC-9.1-01 thất bại', err);
      failed++;
    }

    // TC-9.1-02: Waiter có perm-pos-view truy cập thành công (theo yêu cầu mở rộng)
    try {
      const res = await request('/dashboard/overview', {
        headers: { Authorization: `Bearer ${waiterToken}` },
      });
      if (res.status === 200 && res.data.success) {
        pass('TC-9.1-02: Waiter có perm-pos-view truy cập Dashboard thành công (HTTP 200)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200 OK nhưng nhận được ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      fail('TC-9.1-02 thất bại', err);
      failed++;
    }

    // TC-9.1-03: Chef bếp chỉ có perm-kds-* bị chặn 403 Forbidden
    try {
      const res = await request('/dashboard/overview', {
        headers: { Authorization: `Bearer ${chefNoPermToken}` },
      });
      if (res.status === 403) {
        pass('TC-9.1-03: Chef bếp không có quyền xem báo cáo bị chặn 403 Forbidden chuẩn xác');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 403 Forbidden nhưng nhận được ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      fail('TC-9.1-03 thất bại', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST SUITE: MULTI-BRANCH ISOLATION
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 3: KIỂM TRA MULTI-BRANCH ISOLATION ---${colors.reset}`);

    // TC-9.1-04: Nhân viên chi nhánh 2 cố xem chi nhánh 1 bị ném 403 Forbidden
    try {
      const res = await request(`/dashboard/overview?branchId=${branch1Id}`, {
        headers: { Authorization: `Bearer ${branch2StaffToken}` },
      });
      if (res.status === 403) {
        pass('TC-9.1-04: Nhân viên chi nhánh con xem chi nhánh khác bị ném 403 Forbidden');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 403 Forbidden nhưng nhận được ${res.status}`);
      }
    } catch (err: any) {
      fail('TC-9.1-04 thất bại', err);
      failed++;
    }

    // TC-9.1-05: Chủ nhà hàng (Owner) xem tổng hợp toàn hệ thống (không truyền branchId)
    let consolidatedData: any;
    try {
      const res = await request('/dashboard/overview', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      if (res.status === 200 && res.data.success) {
        consolidatedData = res.data.data;
        pass('TC-9.1-05: Owner truy cập báo cáo tổng hợp toàn chuỗi thành công (HTTP 200)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200 OK nhưng nhận được ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      fail('TC-9.1-05 thất bại', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST SUITE: DUAL-KEY DATA CONTRACT & ANALYTICS COMPUTATION
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 4: KIỂM TRA DUAL-KEY VÀ ĐỘ CHÍNH XÁC CHỈ SỐ ANALYTICS ---${colors.reset}`);

    // TC-9.1-06: Doanh thu hôm nay (revenueToday & todayRevenue)
    // Chi nhánh 1 (150.000) + Chi nhánh 2 (200.000) = 350.000
    try {
      const { revenueToday, todayRevenue } = consolidatedData;
      if (revenueToday === 350000 && todayRevenue === 350000) {
        pass('TC-9.1-06: Doanh thu hôm nay tính đúng 350.000 VND trên cả 2 keys (revenueToday/todayRevenue)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 350000 nhưng nhận được revenueToday=${revenueToday}, todayRevenue=${todayRevenue}`);
      }
    } catch (err: any) {
      fail('TC-9.1-06 thất bại', err);
      failed++;
    }

    // TC-9.1-07: Doanh thu hôm qua và % tăng trưởng
    // Hôm qua: 120.000. Tăng trưởng = ((350000 - 120000) / 120000) * 100 = 191.7%
    try {
      const { yesterdayRevenue, revenueGrowthRate, revenueChangePercent } = consolidatedData;
      if (yesterdayRevenue === 120000 && revenueGrowthRate === 191.7 && revenueChangePercent === 191.7) {
        pass('TC-9.1-07: Doanh thu hôm qua 120.000 VND và tăng trưởng +191.7% chuẩn xác');
        passed++;
      } else {
        throw new Error(`Kỳ vọng yesterday=120000, rate=191.7 nhưng nhận được: yesterday=${yesterdayRevenue}, rate=${revenueGrowthRate}`);
      }
    } catch (err: any) {
      fail('TC-9.1-07 thất bại', err);
      failed++;
    }

    // TC-9.1-08: Kiểm tra đếm bàn và loại trừ bàn đã xóa mềm (isDeleted: true)
    // Tổng số bàn: 3 (2 của CN1 + 1 của CN2, B_DEL không được tính!)
    // Bàn có khách: 1 (Bàn 01 Occupied) -> occupancyRate = 1/3 * 100 = 33.3%
    try {
      const { totalTables, totalTablesCount, occupiedTables, occupiedTablesCount, occupancyRate } = consolidatedData;
      if (
        totalTables === 3 &&
        totalTablesCount === 3 &&
        occupiedTables === 1 &&
        occupiedTablesCount === 1 &&
        occupancyRate === 33.3
      ) {
        pass('TC-9.1-08: Lọc bỏ bàn xóa mềm chuẩn xác (total=3, occupied=1, rate=33.3%) trên cả dual-keys');
        passed++;
      } else {
        throw new Error(
          `Đếm bàn sai: totalTables=${totalTables}, totalTablesCount=${totalTablesCount}, occupied=${occupiedTables}, rate=${occupancyRate}`,
        );
      }
    } catch (err: any) {
      fail('TC-9.1-08 thất bại', err);
      failed++;
    }

    // TC-9.1-09: Đơn bếp đang chờ (kitchenPendingOrders / kitchenPendingCount)
    // Đơn 2 ở trạng thái Preparing -> kitchenPending = 1
    try {
      const { kitchenPendingOrders, kitchenPendingCount } = consolidatedData;
      if (kitchenPendingOrders === 1 && kitchenPendingCount === 1) {
        pass('TC-9.1-09: Đơn bếp đang chờ tính đúng 1 đơn (Preparing) trên cả 2 keys');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 1 đơn bếp nhưng nhận được: ${kitchenPendingOrders}, ${kitchenPendingCount}`);
      }
    } catch (err: any) {
      fail('TC-9.1-09 thất bại', err);
      failed++;
    }

    // TC-9.1-10: Đơn hoàn thành hôm nay & Giá trị trung bình đơn (AOV)
    // Đơn hoàn thành: 2 đơn hôm nay (150k + 200k = 350k) -> AOV = 350000 / 2 = 175000
    try {
      const { completedOrdersToday, completedOrdersCount, averageOrderValue } = consolidatedData;
      if (completedOrdersToday === 2 && completedOrdersCount === 2 && averageOrderValue === 175000) {
        pass('TC-9.1-10: Đơn hoàn thành = 2, AOV = 175.000 VND chuẩn xác');
        passed++;
      } else {
        throw new Error(
          `Kỳ vọng completed=2, AOV=175000 nhưng nhận: completed=${completedOrdersToday}, aov=${averageOrderValue}`,
        );
      }
    } catch (err: any) {
      fail('TC-9.1-10 thất bại', err);
      failed++;
    }

    // TC-9.1-11: Khung giờ doanh thu (hourlyRevenue) từ 09:00 đến 20:00
    try {
      const { hourlyRevenue } = consolidatedData;
      if (Array.isArray(hourlyRevenue) && hourlyRevenue.length === 12) {
        const first = hourlyRevenue[0];
        const last = hourlyRevenue[11];
        if (first.hour === 9 && first.hourLabel === '09:00' && last.hour === 20 && last.hourLabel === '20:00') {
          pass('TC-9.1-11: hourlyRevenue trả về đúng 12 khung giờ (09:00 - 20:00) theo múi giờ +07:00');
          passed++;
        } else {
          throw new Error(`Khung giờ không đúng: first=${JSON.stringify(first)}, last=${JSON.stringify(last)}`);
        }
      } else {
        throw new Error(`hourlyRevenue không phải mảng 12 phần tử: length=${hourlyRevenue?.length}`);
      }
    } catch (err: any) {
      fail('TC-9.1-11 thất bại', err);
      failed++;
    }

    // TC-9.1-12: Danh sách đơn gần đây (activeOrders / recentOrders)
    try {
      const { activeOrders, recentOrders } = consolidatedData;
      if (Array.isArray(activeOrders) && Array.isArray(recentOrders) && activeOrders.length >= 3) {
        const sample = activeOrders[0];
        if (sample.id && sample.orderCode && sample.tableName && sample.status && typeof sample.itemCount === 'number') {
          pass('TC-9.1-12: activeOrders & recentOrders trả về đầy đủ các trường chi tiết đơn hàng');
          passed++;
        } else {
          throw new Error(`Cấu trúc recentOrder thiếu trường: ${JSON.stringify(sample)}`);
        }
      } else {
        throw new Error(`activeOrders rỗng hoặc không đúng định dạng: ${JSON.stringify(activeOrders)}`);
      }
    } catch (err: any) {
      fail('TC-9.1-12 thất bại', err);
      failed++;
    }

    // TC-9.1-13: Thống kê phương thức thanh toán (paymentMethodSummary)
    try {
      const { paymentMethodSummary } = consolidatedData;
      if (paymentMethodSummary?.VietQR === 150000 && paymentMethodSummary?.Card === 200000) {
        pass('TC-9.1-13: paymentMethodSummary phản ánh đúng doanh thu theo kênh (VietQR: 150k, Card: 200k)');
        passed++;
      } else {
        throw new Error(`paymentMethodSummary không đúng: ${JSON.stringify(paymentMethodSummary)}`);
      }
    } catch (err: any) {
      fail('TC-9.1-13 thất bại', err);
      failed++;
    }

    // TC-9.1-14: Phân bổ theo chi nhánh (branchBreakdown)
    try {
      const { branchBreakdown, isConsolidated } = consolidatedData;
      if (isConsolidated && Array.isArray(branchBreakdown) && branchBreakdown.length === 2) {
        const b1 = branchBreakdown.find((b: any) => b.branchId === branch1Id);
        const b2 = branchBreakdown.find((b: any) => b.branchId === branch2Id);
        if (b1?.todayRevenue === 150000 && b2?.todayRevenue === 200000) {
          pass('TC-9.1-14: branchBreakdown tính đúng doanh thu từng chi nhánh (CN1: 150k, CN2: 200k)');
          passed++;
        } else {
          throw new Error(`Doanh thu chi nhánh không khớp: b1=${JSON.stringify(b1)}, b2=${JSON.stringify(b2)}`);
        }
      } else {
        throw new Error(`branchBreakdown không hợp lệ: isConsolidated=${isConsolidated}, length=${branchBreakdown?.length}`);
      }
    } catch (err: any) {
      fail('TC-9.1-14 thất bại', err);
      failed++;
    }

  } catch (globalErr: any) {
    fail('Lỗi thực thi tổng thể Suite 1', globalErr);
    failed++;
  } finally {
    console.log(`\n[Teardown] Dọn dẹp tài nguyên Suite 1...`);
    try {
      if (restaurantId) {
        await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
        await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('tablezones').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      }
    } catch {}
    await app.close();
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử Dashboard Overview: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite Dashboard Overview:', err);
  process.exit(1);
});
