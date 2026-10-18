import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { getTestFixtureSecret, getSampleWelcomePass } from '../shared/test-credentials.helper';

const TEST_PORT = 3124;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 9 Suite 5: Customer Public Demo Tables & QR Discovery (Port ${TEST_PORT}) ${colors.reset}`);
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
  let restaurantSlug = '';
  let branchId = '';
  let zoneTang1Id = new Types.ObjectId();
  let zoneSanThuongId = new Types.ObjectId();

  try {
    console.log(`${colors.bold}--- BƯỚC 1: KHỞI TẠO TÀI NGUYÊN KIỂM THỬ ---${colors.reset}`);

    // Đăng ký nhà hàng
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Bếp Nhà Thử Nghiệm ${timestamp}`,
          phone: '0955545678',
          address: '88 Dong Khoi, Q1, TP.HCM',
        },
        owner: {
          fullName: 'Owner Bep Nha',
          phone: '0955545678',
          email: `bepnha.${timestamp}@imenu.vn`,
          password: getTestFixtureSecret(),
        },
      }),
    });

    if (regRes.status !== 201) {
      throw new Error(`Đăng ký thất bại: ${JSON.stringify(regRes.data)}`);
    }

    restaurantId = regRes.data.data.restaurant.id || regRes.data.data.restaurant._id;
    const restDoc = await db.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    restaurantSlug = restDoc!.slug;
    branchId = restDoc!.branches[0]._id.toString();

    // Cập nhật thông tin Wifi nhà hàng
    await db.collection('restaurants').updateOne(
      { _id: new Types.ObjectId(restaurantId) },
      {
        $set: {
          wifiSsid: 'BepNha_5G_VIP',
          wifiPassword: getSampleWelcomePass(),
        },
      },
    );

    // Tạo 2 khu vực: "Tầng 1" và "Sân Thượng"
    await db.collection('table_zones').insertMany([
      {
        _id: zoneTang1Id,
        restaurantId: new Types.ObjectId(restaurantId),
        name: 'Tầng 1 Phòng Lạnh',
        isActive: true,
      },
      {
        _id: zoneSanThuongId,
        restaurantId: new Types.ObjectId(restaurantId),
        name: 'Sân Thượng View Phố',
        isActive: true,
      },
    ]);

    // Tạo 4 bàn:
    // Bàn 1: Tầng 1, code: ban-01, qrToken: token-ban-01, qrStatus: 'active', isDeleted: false
    // Bàn 2: Sân Thượng, code: ban-08, qrToken: token-ban-08, qrStatus: 'active', isDeleted: false
    // Bàn 3: Tầng 1, code: ban-revoked, qrToken: token-revoked, qrStatus: 'revoked' (BỊ THU HỒI - KHÔNG ĐƯỢC TRẢ VỀ)
    // Bàn 4: Sân Thượng, code: ban-deleted, isDeleted: true (XÓA MỀM - KHÔNG ĐƯỢC TRẢ VỀ)
    await db.collection('tables').insertMany([
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId,
        zone: zoneTang1Id,
        code: `ban-01-${timestamp}`,
        name: 'Bàn 01',
        capacity: 4,
        status: 'Available',
        qrToken: `TOKEN_B01_${timestamp}`,
        qrStatus: 'active',
        isDeleted: false,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId,
        zone: zoneSanThuongId,
        code: `ban-08-${timestamp}`,
        name: 'Bàn 08 (VIP)',
        capacity: 8,
        status: 'Occupied',
        qrToken: `TOKEN_B08_${timestamp}`,
        qrStatus: 'active',
        isDeleted: false,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId,
        zone: zoneTang1Id,
        code: `ban-revoked-${timestamp}`,
        name: 'Bàn Mã Cũ',
        capacity: 2,
        status: 'Available',
        qrToken: `TOKEN_REV_${timestamp}`,
        qrStatus: 'revoked', // BỊ THU HỒI
        isDeleted: false,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId,
        zone: zoneSanThuongId,
        code: `ban-deleted-${timestamp}`,
        name: 'Bàn Hỏng',
        capacity: 4,
        status: 'Available',
        qrToken: `TOKEN_DEL_${timestamp}`,
        qrStatus: 'active',
        isDeleted: true, // ĐÃ XÓA MỀM
      },
    ]);

    pass('Tạo dữ liệu bàn, khu vực và mã QR thử nghiệm thành công');
    passed++;

    // -------------------------------------------------------------------------
    // TEST SUITE: GET /api/tables/public/by-restaurant/:restaurantSlug
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 2: KIỂM TRA TRUY CẬP CÔNG KHAI VÀ KHÁM PHÁ BÀN ĂN ---${colors.reset}`);

    // TC-9.5-01: Truy cập công khai (@Public) hoàn toàn KHÔNG cần header Authorization -> 200 OK
    const res = await request(`/tables/public/by-restaurant/${restaurantSlug}`);

    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Truy cập công khai thất bại: ${res.status}: ${JSON.stringify(res.data)}`);
    }
    pass('TC-9.5-01: Truy cập công khai không cần Bearer token thành công 100% (HTTP 200)');
    passed++;

    const payload = res.data.data;
    const { restaurant, zones, tables } = payload;

    // TC-9.5-02: Trả về đầy đủ thông tin nhà hàng kèm Wifi tiện ích
    try {
      if (
        restaurant &&
        restaurant.slug === restaurantSlug &&
        restaurant.wifiSsid === 'BepNha_5G_VIP' &&
        restaurant.wifiPassword === getSampleWelcomePass()
      ) {
        pass('TC-9.5-02: Thông tin nhà hàng chứa đầy đủ slug và Wifi credentials (wifiSsid, wifiPassword)');
        passed++;
      } else {
        throw new Error(`Thông tin nhà hàng sai: ${JSON.stringify(restaurant)}`);
      }
    } catch (err: any) {
      fail('TC-9.5-02 thất bại', err);
      failed++;
    }

    // TC-9.5-03: Trả về danh sách khu vực (zones)
    try {
      if (Array.isArray(zones) && zones.length === 2) {
        const z1 = zones.find((z: any) => z.id === zoneTang1Id.toString());
        const z2 = zones.find((z: any) => z.id === zoneSanThuongId.toString());
        if (z1?.name === 'Tầng 1 Phòng Lạnh' && z2?.name === 'Sân Thượng View Phố') {
          pass('TC-9.5-03: Danh sách khu vực trả về đúng 2 zones với tên chuẩn xác');
          passed++;
        } else {
          throw new Error(`Zones không khớp: ${JSON.stringify(zones)}`);
        }
      } else {
        throw new Error(`Zones rỗng hoặc không đúng 2 phần tử`);
      }
    } catch (err: any) {
      fail('TC-9.5-03 thất bại', err);
      failed++;
    }

    // TC-9.5-04: Lọc bỏ bàn xóa mềm và bàn có qrStatus !== 'active'
    // Trong 4 bàn, chỉ bàn 1 và bàn 2 thỏa mãn (isDeleted: false, qrStatus: 'active')
    try {
      if (Array.isArray(tables) && tables.length === 2) {
        const b1 = tables.find((t: any) => t.code === `ban-01-${timestamp}`);
        const b8 = tables.find((t: any) => t.code === `ban-08-${timestamp}`);
        const bRev = tables.find((t: any) => t.code === `ban-revoked-${timestamp}`);
        const bDel = tables.find((t: any) => t.code === `ban-deleted-${timestamp}`);

        if (b1 && b8 && !bRev && !bDel) {
          pass('TC-9.5-04: Lọc bỏ chuẩn xác bàn xóa mềm và bàn bị thu hồi mã QR');
          passed++;
        } else {
          throw new Error(`Danh sách bàn không đúng: ${JSON.stringify(tables)}`);
        }
      } else {
        throw new Error(`Số lượng bàn không phải 2: length=${tables?.length}`);
      }
    } catch (err: any) {
      fail('TC-9.5-04 thất bại', err);
      failed++;
    }

    // TC-9.5-05: Cấu trúc chi tiết của từng bàn phục vụ điều hướng Customer Menu
    // Phải có: id, code, name, zoneId, zoneName, capacity, status, qrToken, qrStatus
    try {
      const b8 = tables.find((t: any) => t.code === `ban-08-${timestamp}`);
      if (
        b8 &&
        b8.name === 'Bàn 08 (VIP)' &&
        b8.qrToken === `TOKEN_B08_${timestamp}` &&
        b8.zoneName === 'Sân Thượng View Phố' &&
        b8.capacity === 8 &&
        b8.status === 'Occupied'
      ) {
        pass('TC-9.5-05: Bàn ăn chứa đầy đủ qrToken, zoneName, status phục vụ tạo URL trải nghiệm QR');
        passed++;
      } else {
        throw new Error(`Cấu trúc bàn 08 sai: ${JSON.stringify(b8)}`);
      }
    } catch (err: any) {
      fail('TC-9.5-05 thất bại', err);
      failed++;
    }

    // TC-9.5-06: Nhà hàng không tồn tại ném 404 Not Found
    try {
      const resNotFound = await request('/tables/public/by-restaurant/slug-khong-ton-tai-123456');
      if (resNotFound.status === 404) {
        pass('TC-9.5-06: Truy vấn slug nhà hàng không tồn tại trả về 404 Not Found chuẩn xác');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 404 Not Found nhưng nhận ${resNotFound.status}`);
      }
    } catch (err: any) {
      fail('TC-9.5-06 thất bại', err);
      failed++;
    }

  } catch (globalErr: any) {
    fail('Lỗi thực thi tổng thể Suite 5', globalErr);
    failed++;
  } finally {
    console.log(`\n[Teardown] Dọn dẹp tài nguyên Suite 5...`);
    try {
      if (restaurantId) {
        await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
        await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('table_zones').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      }
    } catch {}
    await app.close();
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử Customer Demo Tables: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite Customer Demo Tables:', err);
  process.exit(1);
});
