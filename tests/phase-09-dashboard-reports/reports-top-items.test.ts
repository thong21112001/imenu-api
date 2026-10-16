import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';

const TEST_PORT = 3122;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 9 Suite 3: Top Selling Items Analytics & Addon Logic (Port ${TEST_PORT}) ${colors.reset}`);
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
  let ownerToken = '';
  let branchId = '';
  let categoryMainId = new Types.ObjectId();
  let categoryDrinkId = new Types.ObjectId();
  let itemPhoId = new Types.ObjectId();
  let itemTraSuaId = new Types.ObjectId();
  let itemBiHuyId = new Types.ObjectId();

  try {
    console.log(`${colors.bold}--- BƯỚC 1: KHỞI TẠO TÀI NGUYÊN KIỂM THỬ ---${colors.reset}`);

    // Đăng ký nhà hàng
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P9 TopItems Test ${timestamp}`,
          phone: '0933345678',
          address: '100 Nguyen Thi Minh Khai, Q1',
        },
        owner: {
          fullName: 'P9 Top Items Owner',
          phone: '0933345678',
          email: `owner.top.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });

    if (regRes.status !== 201) {
      throw new Error(`Đăng ký thất bại: ${JSON.stringify(regRes.data)}`);
    }

    restaurantId = regRes.data.data.restaurant.id || regRes.data.data.restaurant._id;
    ownerToken = regRes.data.data.accessToken;

    const restDoc = await db.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branchId = restDoc!.branches[0]._id.toString();

    // 1. Tạo 2 Danh mục món ăn: "Món Nóng" và "Thức Uống"
    await db.collection('menu_categories').insertMany([
      {
        _id: categoryMainId,
        restaurantId: new Types.ObjectId(restaurantId),
        name: 'Món Nóng Đặc Biệt',
        slug: `mon-nong-${timestamp}`,
        order: 1,
        isActive: true,
        isDeleted: false,
      },
      {
        _id: categoryDrinkId,
        restaurantId: new Types.ObjectId(restaurantId),
        name: 'Đồ Uống & Trà Sữa',
        slug: `do-uong-${timestamp}`,
        order: 2,
        isActive: true,
        isDeleted: false,
      },
    ]);

    // 2. Tạo 3 Món ăn trong thực đơn
    await db.collection('menu_items').insertMany([
      {
        _id: itemPhoId,
        restaurantId: new Types.ObjectId(restaurantId),
        category: categoryMainId,
        name: 'Phở Bò Tái Nạm',
        slug: `pho-bo-${timestamp}`,
        price: 75000,
        isAvailable: true,
        isPopular: true,
      },
      {
        _id: itemTraSuaId,
        restaurantId: new Types.ObjectId(restaurantId),
        category: categoryDrinkId,
        name: 'Trà Sữa Trân Châu Hoàng Kim',
        slug: `tra-sua-${timestamp}`,
        price: 45000,
        isAvailable: true,
        isPopular: true,
      },
      {
        _id: itemBiHuyId,
        restaurantId: new Types.ObjectId(restaurantId),
        category: categoryMainId,
        name: 'Món Thử Nghiệm Bị Hủy',
        slug: `mon-huy-${timestamp}`,
        price: 100000,
        isAvailable: true,
      },
    ]);

    // 3. Tạo Đơn hàng có món thành công và món Cancelled
    // Đơn 1: 2 tô Phở Bò (75k/tô) + topping trứng trần 10k/tô -> itemTotal = (75k + 10k) * 2 = 170.000 VND (status: Served)
    // Đơn 1: 1 Món Thử Nghiệm Bị Hủy (itemTotal = 100k, status: Cancelled) -> BẮT BUỘC KHÔNG ĐƯỢC TÍNH VÀO TOP MON!
    // Đơn 2: 3 ly Trà Sữa (45k/ly) + topping trân châu 10k/ly -> itemTotal = (45k + 10k) * 3 = 165.000 VND (status: Served)
    const now = new Date();
    await db.collection('orders').insertMany([
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId,
        orderCode: `ORD-TOP-01-${timestamp}`,
        status: 'Paid',
        isPaid: true,
        totalAmount: 170000,
        items: [
          {
            menuItemId: itemPhoId,
            name: 'Phở Bò Tái Nạm',
            quantity: 2,
            price: 75000,
            itemTotal: 170000, // Đã bao gồm 20k phụ thu 2 trứng trần
            status: 'Served',
            options: [{ groupId: 'topping', groupName: 'Topping', valueId: 'trung', valueName: 'Trứng trần', priceDelta: 10000 }],
          },
          {
            menuItemId: itemBiHuyId,
            name: 'Món Thử Nghiệm Bị Hủy',
            quantity: 1,
            price: 100000,
            itemTotal: 100000,
            status: 'Cancelled', // ĐÃ HỦY - BẮT BUỘC LOẠI TRỪ
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId,
        orderCode: `ORD-TOP-02-${timestamp}`,
        status: 'Paid',
        isPaid: true,
        totalAmount: 165000,
        items: [
          {
            menuItemId: itemTraSuaId,
            name: 'Trà Sữa Trân Châu Hoàng Kim',
            quantity: 3,
            price: 45000,
            itemTotal: 165000, // Đã bao gồm 30k phụ thu 3 trân châu
            status: 'Served',
            options: [{ groupId: 'topping', groupName: 'Topping', valueId: 'tc', valueName: 'Trân châu', priceDelta: 10000 }],
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    pass('Tạo dữ liệu thực đơn, danh mục và đơn hàng kiểm thử thành công');
    passed++;

    // -------------------------------------------------------------------------
    // TEST SUITE: GET /api/reports/top-items ANALYTICS
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 2: KIỂM TRA PIPELINE TOP ITEMS VÀ LOẠI TRỪ MÓN HỦY ---${colors.reset}`);

    const res = await request('/reports/top-items?limit=5', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Gọi top-items thất bại: ${JSON.stringify(res.data)}`);
    }

    const data = res.data.data;
    const items = data.items || [];

    // TC-9.3-01: Kiểm tra loại bỏ món trạng thái Cancelled
    // Danh sách chỉ được có 2 món: Phở Bò và Trà Sữa (Món Bị Hủy không được xuất hiện)
    try {
      const cancelledItem = items.find((it: any) => it.name === 'Món Thử Nghiệm Bị Hủy');
      if (!cancelledItem && items.length === 2) {
        pass('TC-9.3-01: Lọc bỏ hoàn toàn món đã hủy (Cancelled) khỏi bảng xếp hạng top món');
        passed++;
      } else {
        throw new Error(`Món hủy vẫn xuất hiện trong kết quả: ${JSON.stringify(cancelledItem)}, items=${JSON.stringify(items)}`);
      }
    } catch (err: any) {
      fail('TC-9.3-01 thất bại', err);
      failed++;
    }

    // TC-9.3-02: Bảo toàn tiền phụ thu Topping trong doanh thu (itemTotal)
    // Phở Bò: số lượng = 2, doanh thu = 170.000 VND (hạng 1)
    // Trà Sữa: số lượng = 3, doanh thu = 165.000 VND (hạng 2)
    try {
      const top1 = items[0];
      const top2 = items[1];

      if (
        top1.name === 'Phở Bò Tái Nạm' &&
        top1.quantity === 2 &&
        top1.revenue === 170000 &&
        top2.name === 'Trà Sữa Trân Châu Hoàng Kim' &&
        top2.quantity === 3 &&
        top2.revenue === 165000
      ) {
        pass('TC-9.3-02: Doanh thu món tính theo itemTotal bảo toàn chính xác tiền phụ thu Topping');
        passed++;
      } else {
        throw new Error(`Xếp hạng hoặc doanh thu sai: top1=${JSON.stringify(top1)}, top2=${JSON.stringify(top2)}`);
      }
    } catch (err: any) {
      fail('TC-9.3-02 thất bại', err);
      failed++;
    }

    // TC-9.3-03: Lookup chính xác tên danh mục từ menu_categories
    try {
      const pho = items.find((it: any) => it.name === 'Phở Bò Tái Nạm');
      const traSua = items.find((it: any) => it.name === 'Trà Sữa Trân Châu Hoàng Kim');

      if (pho?.categoryName === 'Món Nóng Đặc Biệt' && traSua?.categoryName === 'Đồ Uống & Trà Sữa') {
        pass('TC-9.3-03: Lookup categoryName từ menu_categories hiển thị chính xác danh mục từng món');
        passed++;
      } else {
        throw new Error(`categoryName sai: phoCat=${pho?.categoryName}, traSuaCat=${traSua?.categoryName}`);
      }
    } catch (err: any) {
      fail('TC-9.3-03 thất bại', err);
      failed++;
    }

    // TC-9.3-04: Tỷ trọng doanh thu món (percentageOfRevenue)
    // Tổng doanh thu 2 món = 170k + 165k = 335.000 VND
    // Phở Bò: (170 / 335) * 100 = 50.7%
    // Trà Sữa: (165 / 335) * 100 = 49.3%
    try {
      const pho = items.find((it: any) => it.name === 'Phở Bò Tái Nạm');
      const traSua = items.find((it: any) => it.name === 'Trà Sữa Trân Châu Hoàng Kim');

      if (pho?.percentageOfRevenue === 50.7 && traSua?.percentageOfRevenue === 49.3) {
        pass('TC-9.3-04: percentageOfRevenue tính chính xác (50.7% vs 49.3%)');
        passed++;
      } else {
        throw new Error(`percentageOfRevenue sai: pho=${pho?.percentageOfRevenue}, traSua=${traSua?.percentageOfRevenue}`);
      }
    } catch (err: any) {
      fail('TC-9.3-04 thất bại', err);
      failed++;
    }

    // TC-9.3-05: Cơ cấu theo danh mục (categoryBreakdown)
    try {
      const cats = data.categoryBreakdown;
      const catNong = cats?.find((c: any) => c.categoryName === 'Món Nóng Đặc Biệt');
      const catNuoc = cats?.find((c: any) => c.categoryName === 'Đồ Uống & Trà Sữa');

      if (catNong?.revenue === 170000 && catNuoc?.revenue === 165000 && catNong?.quantity === 2) {
        pass('TC-9.3-05: categoryBreakdown phân rã doanh thu theo danh mục chuẩn xác');
        passed++;
      } else {
        throw new Error(`categoryBreakdown sai: ${JSON.stringify(cats)}`);
      }
    } catch (err: any) {
      fail('TC-9.3-05 thất bại', err);
      failed++;
    }

    // TC-9.3-AUD-01: Hardening AUD-9.4 & AUD-9.5: Kẹp limit <= 100 và phân định rõ totalItemRevenue vs totalRevenue
    try {
      const resLimit = await request('/reports/top-items?limit=100', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      if (resLimit.status === 200 && resLimit.data?.data) {
        const topData = resLimit.data.data;
        const isLimitCapped = Array.isArray(topData.items) && topData.items.length <= 100;
        const hasBothRevenueKeys =
          topData.totalRevenue === 335000 &&
          topData.totalItemRevenue === 335000;

        if (isLimitCapped && hasBothRevenueKeys) {
          pass('TC-9.3-AUD-01: [AUD-9.4 & AUD-9.5] Kẹp limit <= 100 và trả về đồng thời totalItemRevenue/totalRevenue chính xác');
          passed++;
        } else {
          throw new Error(`Kiểm tra AUD-9.4/AUD-9.5 thất bại: isLimitCapped=${isLimitCapped}, hasBothRevenueKeys=${hasBothRevenueKeys}`);
        }
      } else {
        throw new Error(`Kỳ vọng 200 OK nhưng nhận được ${resLimit.status}`);
      }
    } catch (err: any) {
      fail('TC-9.3-AUD-01 thất bại', err);
      failed++;
    }

  } catch (globalErr: any) {
    fail('Lỗi thực thi tổng thể Suite 3', globalErr);
    failed++;
  } finally {
    console.log(`\n[Teardown] Dọn dẹp tài nguyên Suite 3...`);
    try {
      if (restaurantId) {
        await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
        await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('menu_categories').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('menu_items').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      }
    } catch {}
    await app.close();
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử Top Items Analytics: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite Top Items Analytics:', err);
  process.exit(1);
});
