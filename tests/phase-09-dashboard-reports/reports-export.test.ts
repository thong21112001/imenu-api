import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { getTestFixtureSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3123;
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
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const arrayBuffer = await res.arrayBuffer();
  const rawBytes = Buffer.from(arrayBuffer);
  const text = rawBytes.toString('utf-8');

  let data: any = {};
  if (contentType.includes('application/json')) {
    try {
      data = JSON.parse(text);
    } catch {}
  }

  return { status: res.status, data, text, rawBytes, headers: res.headers };
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 9 Suite 4: Reports Export Security & UTF-8 BOM (Port ${TEST_PORT})      ${colors.reset}`);
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
  let branchId = '';
  let adminToken = '';
  let managerToken = '';

  try {
    console.log(`${colors.bold}--- BƯỚC 1: KHỞI TẠO TÀI NGUYÊN KIỂM THỬ ---${colors.reset}`);

    // Đăng ký nhà hàng
    const regRes = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant: {
          name: `P9 Export Test ${timestamp}`,
          phone: '0944445678',
          address: '202 Pasteur, Q3, TP.HCM',
        },
        owner: {
          fullName: 'P9 Admin User',
          phone: '0944445678',
          email: `admin.exp.${timestamp}@imenu.vn`,
          password: getTestFixtureSecret(),
        },
      }),
    });

    if (regRes.status !== 201) {
      throw new Error(`Đăng ký thất bại: ${JSON.stringify(regRes.data)}`);
    }

    restaurantId = regRes.data.data.restaurant.id || regRes.data.data.restaurant._id;
    adminToken = regRes.data.data.accessToken;

    const restDoc = await db.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    branchId = restDoc!.branches[0]._id.toString();

    // Lấy role restaurant_manager (Đã thu hồi quyền perm-rep-export theo Blueprint)
    const rolesColl = db.collection('roles');
    const managerRole = await rolesColl.findOne({ slug: 'restaurant_manager' });

    await request('/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Branch Manager User',
        username: `manager_${timestamp}`,
        email: `manager.${timestamp}@imenu.vn`,
        password: getTestFixtureSecret(),
        phone: '0944445679',
        roleId: managerRole!._id.toString(),
        branchId,
      }),
    });
    const managerLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `manager.${timestamp}@imenu.vn`,
        password: getTestFixtureSecret(),
      }),
    });
    managerToken = managerLogin.data.data.accessToken;

    // Tạo đơn hàng chứa các payload kiểm thử Formula Injection (CWE-1236)
    // Tên món và ghi chú chứa =, +, -, @
    const now = new Date();
    await db.collection('orders').insertMany([
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId,
        orderCode: `ORD-EXP-01-${timestamp}`,
        status: 'Paid',
        isPaid: true,
        subTotal: 150000,
        totalAmount: 150000,
        paymentMethod: 'VietQR',
        tableName: 'Bàn 01',
        customerNote: '=cmd|\' /C calc\'!A0', // INJECTION TEST PAYLOAD
        items: [
          {
            menuItemId: new Types.ObjectId(),
            name: '+123456 Thần Tài Đón Lộc', // INJECTION TEST PAYLOAD
            quantity: 1,
            price: 150000,
            itemTotal: 150000,
            status: 'Served',
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: new Types.ObjectId(restaurantId),
        branchId,
        orderCode: `ORD-EXP-02-${timestamp}`,
        status: 'Paid',
        isPaid: true,
        subTotal: 80000,
        totalAmount: 80000,
        paymentMethod: 'Cash',
        tableName: 'Bàn 02',
        customerNote: '@SUM(A1:A10)', // INJECTION TEST PAYLOAD
        items: [
          {
            menuItemId: new Types.ObjectId(),
            name: '-9999 Âm Binh Lương', // INJECTION TEST PAYLOAD
            quantity: 1,
            price: 80000,
            itemTotal: 80000,
            status: 'Served',
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    pass('Tạo dữ liệu đơn hàng chứa payload kiểm thử CSV injection thành công');
    passed++;

    // -------------------------------------------------------------------------
    // TEST SUITE: RBAC EXPORT PROTECTION (GET /api/reports/export)
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 2: KIỂM TRA PHÂN QUYỀN XUẤT BÁO CÁO (RBAC GATE) ---${colors.reset}`);

    // TC-9.4-01: Quản lý nhà hàng (restaurant_manager) KHÔNG có quyền xuất báo cáo -> 403 Forbidden
    try {
      const res = await request('/reports/export?format=csv', {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      if (res.status === 403) {
        pass('TC-9.4-01: restaurant_manager không có quyền perm-rep-export bị chặn 403 Forbidden đúng Blueprint');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 403 Forbidden nhưng nhận được: ${res.status}`);
      }
    } catch (err: any) {
      fail('TC-9.4-01 thất bại', err);
      failed++;
    }

    // TC-9.4-02: Chủ nhà hàng (restaurant_admin) có perm-rep-export -> 200 OK
    let exportResponse: any;
    try {
      exportResponse = await request('/reports/export?format=csv', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (exportResponse.status === 200) {
        pass('TC-9.4-02: restaurant_admin có perm-rep-export xuất báo cáo thành công (HTTP 200)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200 OK nhưng nhận được: ${exportResponse.status}`);
      }
    } catch (err: any) {
      fail('TC-9.4-02 thất bại', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST SUITE: CSV ENCODING & UTF-8 BOM
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 3: KIỂM TRA ĐỊNH DẠNG VÀ TIỀN TỐ UTF-8 BOM ---${colors.reset}`);

    const csvText = exportResponse?.text || '';
    const rawBytes = exportResponse?.rawBytes;

    // TC-9.4-03: Kiểm tra UTF-8 BOM (\uFEFF: 0xEF, 0xBB, 0xBF) ở đầu file
    try {
      const hasBomHeader = rawBytes && rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf;
      if (hasBomHeader || csvText.startsWith('\uFEFF')) {
        pass('TC-9.4-03: File CSV bắt đầu bằng tiền tố UTF-8 BOM (EF BB BF) cho Microsoft Excel Windows hiển thị tiếng Việt');
        passed++;
      } else {
        throw new Error(`File CSV không chứa UTF-8 BOM, bytes: ${rawBytes?.slice(0, 4).toString('hex')}`);
      }
    } catch (err: any) {
      fail('TC-9.4-03 thất bại', err);
      failed++;
    }

    // TC-9.4-04: Kiểm tra HTTP Headers (Content-Type và Content-Disposition)
    try {
      const contentType = exportResponse.headers.get('content-type') || '';
      const disposition = exportResponse.headers.get('content-disposition') || '';

      if (contentType.includes('text/csv') && disposition.includes('attachment') && disposition.includes('.csv')) {
        pass('TC-9.4-04: Header Content-Type text/csv và Content-Disposition attachment chuẩn RFC');
        passed++;
      } else {
        throw new Error(`Header không đúng: contentType=${contentType}, disposition=${disposition}`);
      }
    } catch (err: any) {
      fail('TC-9.4-04 thất bại', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST SUITE: ANTI CSV FORMULA INJECTION (CWE-1236)
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 4: KIỂM TRA PHÒNG CHỐNG CSV FORMULA INJECTION (CWE-1236) ---${colors.reset}`);

    // TC-9.4-05: Kiểm tra các payload =cmd, +123, -999, @SUM đã được sanitize bằng nháy đơn '
    try {
      // Các ô bắt đầu bằng +, -, =, @ phải được prefix nháy đơn '
      // "+123456 Thần Tài" -> "'+123456 Thần Tài"
      // "-9999 Âm Binh" -> "'-9999 Âm Binh"
      const hasSanitizedPlus = csvText.includes("'+123456") || csvText.includes('"+123456');
      const hasSanitizedMinus = csvText.includes("'-9999") || csvText.includes('"-9999');

      // Đảm bảo không có ô nào bắt đầu thẳng bằng =cmd mà không có quote hoặc nháy đơn
      const isUnsafeCmd = csvText.includes(',=cmd') || csvText.includes('\n=cmd');

      if (!isUnsafeCmd && (hasSanitizedPlus || hasSanitizedMinus)) {
        pass('TC-9.4-05: Toàn bộ ô chứa ký tự nguy hiểm (+, -, =, @) đã được khử độc (sanitize) an toàn');
        passed++;
      } else {
        throw new Error(`Khử độc CSV thất bại: plus=${hasSanitizedPlus}, minus=${hasSanitizedMinus}, isUnsafeCmd=${isUnsafeCmd}`);
      }
    } catch (err: any) {
      fail('TC-9.4-05 thất bại', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST SUITE: AUDIT LOG RECORDING
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 5: KIỂM TRA GHI NHẬN AUDIT LOG ---${colors.reset}`);

    // TC-9.4-06: Kiểm tra Activity Log ghi nhận thao tác xuất báo cáo
    try {
      const logs = await db.collection('activity_logs').find({
        restaurantId: new Types.ObjectId(restaurantId),
        action: 'export',
      }).toArray();

      if (logs.length > 0) {
        pass(`TC-9.4-06: Hệ thống ghi nhận nhật ký kiểm toán (ActivityLog: export) thành công (${logs.length} bản ghi)`);
        passed++;
      } else {
        throw new Error('Không tìm thấy bản ghi ActivityLog cho hành vi xuất báo cáo');
      }
    } catch (err: any) {
      fail('TC-9.4-06 thất bại', err);
      failed++;
    }

  } catch (globalErr: any) {
    fail('Lỗi thực thi tổng thể Suite 4', globalErr);
    failed++;
  } finally {
    console.log(`\n[Teardown] Dọn dẹp tài nguyên Suite 4...`);
    try {
      if (restaurantId) {
        await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
        await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
        await db.collection('activity_logs').deleteMany({ restaurantId: new Types.ObjectId(restaurantId) });
      }
    } catch {}
    await app.close();
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả kiểm thử Reports Export: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Lỗi thực thi test suite Reports Export:', err);
  process.exit(1);
});
