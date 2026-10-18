import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { getTestFixtureSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3121;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 9 Suite 2: Revenue Reports & Multi-Branch Analytics (Port ${TEST_PORT}) ${colors.reset}`);
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
  let branch1Id = '';
  let branch2Id = '';
  let ownerToken = '';
  let branch2StaffToken = '';

  try {
    // -------------------------------------------------------------------------
    // SETUP: Tạo Nhà hàng đa chi nhánh và các đơn hàng tài chính mẫu
    // -------------------------------------------------------------------------
    console.log(`${colors.bold}--- BƯỚC 1: KHỞI TẠO TÀI NGUYÊN KIỂM THỬ ---${colors.reset}`);

    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P9 Reports Test ${timestamp}`,
          phone: '0922345678',
          address: '789 Vo Van Tan, Q3, TP.HCM',
        },
        owner: {
          fullName: 'P9 Reports Owner',
          phone: '0922345678',
          email: `owner.rep.${timestamp}@imenu.vn`,
          password: getTestFixtureSecret(),
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
        name: `Chi nhánh Phú Nhuận ${timestamp}`,
        address: 'Phú Nhuận, TP.HCM',
        phone: '0922345679',
      }),
    });
    branch2Id = (branch2Res.data?.data?._id || branch2Res.data?.data?.id || '').toString();

    // Lấy cashier role để tạo nhân viên chi nhánh 2
    const rolesColl = db.collection('roles');
    const cashierRole = await rolesColl.findOne({ slug: 'cashier' });

    await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        fullName: 'Branch 2 Reports Staff',
        username: `b2rep_${timestamp}`,
        email: `b2rep.${timestamp}@imenu.vn`,
        password: getTestFixtureSecret(),
        phone: '0922345682',
        roleId: cashierRole!._id.toString(),
        branchId: branch2Id,
      }),
    });
    const branch2Login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `b2rep.${timestamp}@imenu.vn`,
        password: getTestFixtureSecret(),
      }),
    });
    branch2StaffToken = branch2Login.data.data.accessToken;

    // Tạo dữ liệu tài chính đa phương thức:
    // Đơn 1: CN1 - VietQR: subTotal: 200k, discount: 20k, serviceFee: 10k, vat: 19k -> totalAmount: 209k, guests: 4, status: Paid
    // Đơn 2: CN1 - Cash: subTotal: 100k, discount: 0, serviceFee: 0, vat: 10k -> totalAmount: 110k, guests: 2, status: Paid
    // Đơn 3: CN2 - Card: subTotal: 300k, discount: 0, serviceFee: 15k, vat: 31.5k -> totalAmount: 346.5k, guests: 3, status: Paid
    // Đơn 4: CN1 - Cancelled: subTotal: 50k, totalAmount: 50k, status: Cancelled
    const now = new Date();
    await db.collection('orders').insertMany([
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        orderCode: `ORD-REP-01-${timestamp}`,
        status: 'Paid',
        isPaid: true,
        subTotal: 200000,
        discountAmount: 20000,
        serviceFee: 10000,
        vatAmount: 19000,
        totalAmount: 209000,
        guestCount: 4,
        paymentMethod: 'VietQR',
        tableName: 'Bàn 01',
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        orderCode: `ORD-REP-02-${timestamp}`,
        status: 'Paid',
        isPaid: true,
        subTotal: 100000,
        discountAmount: 0,
        serviceFee: 0,
        vatAmount: 10000,
        totalAmount: 110000,
        guestCount: 2,
        paymentMethod: 'Cash',
        tableName: 'Bàn 02',
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch2Id,
        orderCode: `ORD-REP-03-${timestamp}`,
        status: 'Paid',
        isPaid: true,
        subTotal: 300000,
        discountAmount: 0,
        serviceFee: 15000,
        vatAmount: 31500,
        totalAmount: 346500,
        guestCount: 3,
        paymentMethod: 'Card',
        tableName: 'Bàn 03',
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id,
        orderCode: `ORD-REP-04-${timestamp}`,
        status: 'Cancelled',
        isPaid: false,
        subTotal: 50000,
        discountAmount: 0,
        serviceFee: 0,
        vatAmount: 0,
        totalAmount: 50000,
        paymentMethod: 'Cash',
        tableName: 'Bàn 04',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    pass('Tạo dữ liệu đơn hàng tài chính mẫu thành công');
    passed++;

    // -------------------------------------------------------------------------
    // TEST SUITE: DATE RANGE & PARAMETER VALIDATION
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 2: KIỂM TRA RÀNG BUỘC KHOẢNG THỜI GIAN VÀ PARAMETER ---${colors.reset}`);

    // TC-9.2-01: startDate > endDate ném 400 Bad Request
    try {
      const res = await request('/reports/revenue?startDate=2026-10-20&endDate=2026-10-10', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      if (res.status === 400) {
        pass('TC-9.2-01: startDate > endDate bị ném 400 Bad Request chuẩn xác');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 400 Bad Request nhưng nhận ${res.status}`);
      }
    } catch (err: any) {
      fail('TC-9.2-01 thất bại', err);
      failed++;
    }

    // TC-9.2-02: Khoảng cách > 366 ngày ném 400 Bad Request
    try {
      const res = await request('/reports/revenue?startDate=2024-01-01&endDate=2026-10-16', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      if (res.status === 400) {
        pass('TC-9.2-02: Khoảng cách > 366 ngày bị ném 400 Bad Request chuẩn xác');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 400 Bad Request nhưng nhận ${res.status}`);
      }
    } catch (err: any) {
      fail('TC-9.2-02 thất bại', err);
      failed++;
    }

    // TC-9.2-03: Multi-Branch Isolation: Nhân viên CN2 xem CN1 bị chặn 403 Forbidden
    try {
      const res = await request(`/reports/revenue?branchId=${branch1Id}`, {
        headers: { Authorization: `Bearer ${branch2StaffToken}` },
      });
      if (res.status === 403) {
        pass('TC-9.2-03: Nhân viên CN con truy cập báo cáo CN khác bị chặn 403 Forbidden');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 403 Forbidden nhưng nhận ${res.status}`);
      }
    } catch (err: any) {
      fail('TC-9.2-03 thất bại', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST SUITE: TÍNH TOÁN CHỈ SỐ TÀI CHÍNH TOÀN CHUỖI
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 3: KIỂM TRA ĐỘ CHÍNH XÁC CHỈ SỐ TÀI CHÍNH BÁO CÁO ---${colors.reset}`);

    // Lấy báo cáo hôm nay của toàn hệ thống
    const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const todayStr = vnNow.toISOString().split('T')[0];

    const repRes = await request(`/reports/revenue?startDate=${todayStr}&endDate=${todayStr}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    if (repRes.status !== 200 || !repRes.data.success) {
      throw new Error(`Lấy báo cáo doanh thu thất bại: ${JSON.stringify(repRes.data)}`);
    }

    const report = repRes.data.data;

    // TC-9.2-04: Tổng doanh thu (totalRevenue) = 209k + 110k + 346.5k = 665.500 VND
    try {
      if (report.totalRevenue === 665500 && report.summary?.totalRevenue === 665500) {
        pass('TC-9.2-04: totalRevenue = 665.500 VND chuẩn xác trên cả root và summary');
        passed++;
      } else {
        throw new Error(`totalRevenue sai: root=${report.totalRevenue}, summary=${report.summary?.totalRevenue}`);
      }
    } catch (err: any) {
      fail('TC-9.2-04 thất bại', err);
      failed++;
    }

    // TC-9.2-05: Tổng phụ thu, giảm giá, VAT và subTotal
    // subTotal = 200k + 100k + 300k = 600.000 VND
    // totalDiscount = 20.000 VND
    // totalServiceFee = 10k + 15k = 25.000 VND
    // totalVat = 19k + 10k + 31.5k = 60.500 VND
    try {
      if (
        report.subTotal === 600000 &&
        report.totalDiscount === 20000 &&
        report.totalServiceFee === 25000 &&
        report.totalVat === 60500
      ) {
        pass('TC-9.2-05: subTotal (600k), discount (20k), serviceFee (25k), VAT (60.5k) khớp 100%');
        passed++;
      } else {
        throw new Error(
          `Chi tiết tài chính sai: subTotal=${report.subTotal}, discount=${report.totalDiscount}, fee=${report.totalServiceFee}, vat=${report.totalVat}`,
        );
      }
    } catch (err: any) {
      fail('TC-9.2-05 thất bại', err);
      failed++;
    }

    // TC-9.2-06: Đếm đơn hàng và số khách phục vụ (totalGuests)
    // completedOrders = 3, cancelledOrders = 1, orderCount = 4
    // totalGuests = 4 + 2 + 3 = 9 khách
    // averageOrderValue = Math.round(665500 / 3) = 221833 VND
    try {
      if (
        report.completedOrders === 3 &&
        report.cancelledOrders === 1 &&
        report.orderCount === 4 &&
        report.totalGuests === 9 &&
        report.averageOrderValue === 221833
      ) {
        pass('TC-9.2-06: Số đơn (3 hoàn thành, 1 hủy, tổng 4), tổng khách (9) và AOV (221.833đ) chuẩn xác');
        passed++;
      } else {
        throw new Error(
          `Đếm đơn/khách sai: completed=${report.completedOrders}, cancelled=${report.cancelledOrders}, totalOrders=${report.orderCount}, guests=${report.totalGuests}, AOV=${report.averageOrderValue}`,
        );
      }
    } catch (err: any) {
      fail('TC-9.2-06 thất bại', err);
      failed++;
    }

    // TC-9.2-07: Thống kê các phương thức thanh toán (paymentMethodStats)
    // VietQR: 1 đơn (209.000), Cash: 1 đơn (110.000), Card: 1 đơn (346.500)
    // vietQrPercentage = Math.round((209000 / 665500) * 1000) / 10 = 31.4%
    try {
      const stats = report.paymentMethodStats;
      const vqr = stats?.find((p: any) => p.method === 'VietQR');
      const cash = stats?.find((p: any) => p.method === 'Cash');
      const card = stats?.find((p: any) => p.method === 'Card');

      if (
        vqr?.revenue === 209000 &&
        cash?.revenue === 110000 &&
        card?.revenue === 346500 &&
        report.vietQrPercentage === 31.4
      ) {
        pass('TC-9.2-07: paymentMethodStats tính đúng từng phương thức và vietQrPercentage = 31.4%');
        passed++;
      } else {
        throw new Error(
          `paymentMethodStats sai: vqr=${JSON.stringify(vqr)}, cash=${JSON.stringify(cash)}, card=${JSON.stringify(card)}, pct=${report.vietQrPercentage}`,
        );
      }
    } catch (err: any) {
      fail('TC-9.2-07 thất bại', err);
      failed++;
    }

    // TC-9.2-08: Phân tích theo chi nhánh (branchBreakdown & byBranch)
    // CN1: 209k + 110k = 319.000 VND (2 đơn). pct = Math.round((319000 / 665500) * 1000) / 10 = 47.9%
    // CN2: 346.500 VND (1 đơn). pct = Math.round((346500 / 665500) * 1000) / 10 = 52.1%
    try {
      const b1 = report.branchBreakdown?.find((b: any) => b.branchId === branch1Id);
      const b2 = report.branchBreakdown?.find((b: any) => b.branchId === branch2Id);

      if (b1?.revenue === 319000 && b2?.revenue === 346500 && b1?.percentage === 47.9 && b2?.percentage === 52.1) {
        pass('TC-9.2-08: branchBreakdown phản ánh đúng doanh thu và tỷ trọng từng chi nhánh');
        passed++;
      } else {
        throw new Error(`branchBreakdown sai: b1=${JSON.stringify(b1)}, b2=${JSON.stringify(b2)}`);
      }
    } catch (err: any) {
      fail('TC-9.2-08 thất bại', err);
      failed++;
    }

    // TC-9.2-09: Lọc báo cáo theo branchId chi nhánh 1
    try {
      const b1OnlyRes = await request(`/reports/revenue?startDate=${todayStr}&endDate=${todayStr}&branchId=${branch1Id}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      if (b1OnlyRes.status === 200 && b1OnlyRes.data?.data?.totalRevenue === 319000) {
        pass('TC-9.2-09: Lọc theo branchId=branch1Id trả về chính xác doanh thu 319.000đ của CN1');
        passed++;
      } else {
        throw new Error(`Lọc branchId thất bại: ${JSON.stringify(b1OnlyRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-9.2-09 thất bại', err);
      failed++;
    }

    // TC-9.2-10: Chuỗi thời gian (timeline) và các chế độ gom nhóm (day, week, month)
    try {
      if (Array.isArray(report.timeline) && report.timeline.length > 0) {
        const todayEntry = report.timeline.find((t: any) => t.date === todayStr);
        if (todayEntry && todayEntry.revenue === 665500 && todayEntry.orderCount === 3) {
          pass('TC-9.2-10: timeline theo múi giờ +07:00 khớp chính xác ngày và doanh thu');
          passed++;
        } else {
          throw new Error(`timeline entry sai: ${JSON.stringify(todayEntry)}`);
        }
      } else {
        throw new Error(`timeline rỗng hoặc không đúng định dạng`);
      }
    } catch (err: any) {
      fail('TC-9.2-10 thất bại', err);
      failed++;
    }

    // TC-9.2-11: Kiểm tra tham số groupBy=week và groupBy=month
    try {
      const [resWeek, resMonth] = await Promise.all([
        request(`/reports/revenue?startDate=${todayStr}&endDate=${todayStr}&groupBy=week`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
        request(`/reports/revenue?startDate=${todayStr}&endDate=${todayStr}&groupBy=month`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
      ]);

      if (resWeek.status === 200 && resMonth.status === 200) {
        pass('TC-9.2-11: Hỗ trợ linh hoạt các chế độ groupBy=week và groupBy=month');
        passed++;
      } else {
        throw new Error(`groupBy thất bại: week=${resWeek.status}, month=${resMonth.status}`);
      }
    } catch (err: any) {
      fail('TC-9.2-11 thất bại', err);
      failed++;
    }

    // TC-9.2-AUD-01: Hardening AUD-9.1 & AUD-9.4: Cô lập chi nhánh con & Giới hạn khoảng cách ngày <= 366
    try {
      // 1. Child branch passes branchId=all -> 403 Forbidden
      const resB2All = await request(`/reports/revenue?startDate=${todayStr}&endDate=${todayStr}&branchId=all`, {
        headers: { Authorization: `Bearer ${branch2StaffToken}` },
      });
      // 2. Child branch passes no branchId -> branchBreakdown contains ONLY child branch
      const resB2Own = await request(`/reports/revenue?startDate=${todayStr}&endDate=${todayStr}`, {
        headers: { Authorization: `Bearer ${branch2StaffToken}` },
      });
      // 3. Exceeding 366 days -> 400 Bad Request
      const resLongRange = await request('/reports/revenue?startDate=2024-01-01&endDate=2026-01-01', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      const isB2Blocked = resB2All.status === 403;
      const isB2Isolated =
        resB2Own.status === 200 &&
        Array.isArray(resB2Own.data?.data?.branchBreakdown) &&
        resB2Own.data.data.branchBreakdown.length === 1 &&
        resB2Own.data.data.branchBreakdown[0].branchId === branch2Id;
      const isRangeLimited = resLongRange.status === 400;

      if (isB2Blocked && isB2Isolated && isRangeLimited) {
        pass('TC-9.2-AUD-01: [AUD-9.1 & AUD-9.4] Chặn branchId=all cho chi nhánh con, cô lập branchBreakdown, và chặn khoảng thời gian > 366 ngày');
        passed++;
      } else {
        throw new Error(`Kiểm tra hardening thất bại: isB2Blocked=${isB2Blocked}, isB2Isolated=${isB2Isolated}, isRangeLimited=${isRangeLimited}`);
      }
    } catch (err: any) {
      fail('TC-9.2-AUD-01 thất bại', err);
      failed++;
    }

  } catch (globalErr: any) {
    fail('Lỗi thực thi tổng thể Suite 2', globalErr);
    failed++;
  } finally {
    console.log(`\n[Teardown] Dọn dẹp tài nguyên Suite 2...`);
    try {
      if (restaurantId) {
        await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
        await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      }
    } catch {}
    await app.close();
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử Revenue Reports: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite Revenue Reports:', err);
  process.exit(1);
});
