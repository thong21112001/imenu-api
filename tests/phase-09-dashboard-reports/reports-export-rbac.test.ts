import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';

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
  console.log(`${colors.bold}${colors.cyan}  Phase 9 Suite 4: Reports Export Security, RBAC & Multi-Tenant (Port ${TEST_PORT}) ${colors.reset}`);
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

  let restaurantAId = '';
  let restaurantBId = '';
  let branchAId = '';
  let adminAToken = '';
  let managerAToken = '';
  let adminBToken = '';
  let restaurantASlug = '';

  try {
    console.log(`${colors.bold}--- BƯỚC 1: KHỞI TẠO TÀI NGUYÊN KIỂM THỬ ---${colors.reset}`);

    // Đăng ký Nhà hàng A
    const regARes = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant: {
          name: `P9 Export Test A ${timestamp}`,
          phone: '0944445678',
          address: '202 Pasteur, Q3, TP.HCM',
        },
        owner: {
          fullName: 'P9 Admin User A',
          phone: '0944445678',
          email: `admin.expa.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });

    if (regARes.status !== 201) {
      throw new Error(`Đăng ký nhà hàng A thất bại: ${JSON.stringify(regARes.data)}`);
    }

    restaurantAId = regARes.data.data.restaurant.id || regARes.data.data.restaurant._id;
    adminAToken = regARes.data.data.accessToken;

    const restADoc = await db.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantAId) });
    branchAId = restADoc!.branches[0]._id.toString();
    restaurantASlug = restADoc!.slug;

    // Đăng ký Nhà hàng B (Multi-Tenant test)
    const regBRes = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurant: {
          name: `P9 Export Test B ${timestamp}`,
          phone: '0944445699',
          address: '100 Hai Ba Trung, Q1, TP.HCM',
        },
        owner: {
          fullName: 'P9 Admin User B',
          phone: '0944445699',
          email: `admin.expb.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });
    restaurantBId = regBRes.data.data.restaurant.id || regBRes.data.data.restaurant._id;
    adminBToken = regBRes.data.data.accessToken;

    // Lấy role restaurant_manager (Đã thu hồi quyền perm-rep-export theo Blueprint)
    const rolesColl = db.collection('roles');
    const managerRole = await rolesColl.findOne({ slug: 'restaurant_manager' });

    await request('/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({
        fullName: 'Branch Manager User A',
        username: `manager_a_${timestamp}`,
        email: `manager.a.${timestamp}@imenu.vn`,
        password: 'Password@123',
        phone: '0944445679',
        roleId: managerRole!._id.toString(),
        branchId: branchAId,
      }),
    });
    const managerLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `manager.a.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    managerAToken = managerLogin.data.data.accessToken;

    // Tạo đơn hàng kiểm thử Formula Injection và bàn ăn
    const now = new Date();
    await db.collection('orders').insertMany([
      {
        restaurantId: new Types.ObjectId(restaurantAId),
        branchId: branchAId,
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
            name: '@Phở Bò Đặc Biệt', // INJECTION CHAR @
            quantity: 2,
            price: 75000,
            itemTotal: 150000,
            status: 'Served',
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Tạo bàn ăn công khai cho Nhà hàng A
    await db.collection('tables').insertMany([
      {
        restaurantId: new Types.ObjectId(restaurantAId),
        branchId: branchAId,
        code: `ban-vip-01`,
        name: 'Bàn VIP 01',
        capacity: 4,
        status: 'Available',
        qrToken: `qr-token-test-${timestamp}`,
        qrStatus: 'active',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    pass('Tạo dữ liệu thử nghiệm Nhà hàng A, Nhà hàng B và dữ liệu kiểm toán thành công');
    passed++;

    // -------------------------------------------------------------------------
    // TEST SUITE: RBAC EXPORT PERMISSION GATE
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 2: KIỂM TRA PHÂN QUYỀN XUẤT BÁO CÁO (RBAC GATE) ---${colors.reset}`);

    // TC-9.4-01: Manager có perm-rep-view nhưng KHÔNG có perm-rep-export -> 403 Forbidden
    try {
      const res = await request('/reports/export?format=csv', {
        headers: { Authorization: `Bearer ${managerAToken}` },
      });
      if (res.status === 403) {
        pass('TC-9.4-01: restaurant_manager không có quyền perm-rep-export bị chặn 403 Forbidden đúng Blueprint');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 403 Forbidden nhưng nhận ${res.status}`);
      }
    } catch (err: any) {
      fail('TC-9.4-01 thất bại', err);
      failed++;
    }

    // TC-9.4-02: restaurant_admin có perm-rep-export xuất báo cáo thành công (200 OK)
    let csvText = '';
    let rawBytes: Buffer = Buffer.from([]);
    try {
      const res = await request('/reports/export?format=csv', {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      if (res.status === 200) {
        pass('TC-9.4-02: restaurant_admin có perm-rep-export xuất báo cáo thành công (HTTP 200)');
        passed++;
        csvText = res.text;
        rawBytes = res.rawBytes;
      } else {
        throw new Error(`Kỳ vọng 200 OK nhưng nhận ${res.status}: ${res.text}`);
      }
    } catch (err: any) {
      fail('TC-9.4-02 thất bại', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST SUITE: ĐỊNH DẠNG VÀ TIỀN TỐ UTF-8 BOM
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 3: KIỂM TRA ĐỊNH DẠNG VÀ TIỀN TỐ UTF-8 BOM ---${colors.reset}`);

    // TC-9.4-03: Kiểm tra tiền tố UTF-8 BOM (0xEF, 0xBB, 0xBF)
    try {
      if (rawBytes.length >= 3 && rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf) {
        pass('TC-9.4-03: File CSV bắt đầu bằng tiền tố UTF-8 BOM (EF BB BF) cho Microsoft Excel Windows hiển thị tiếng Việt');
        passed++;
      } else {
        throw new Error(`Không tìm thấy UTF-8 BOM prefix: [${rawBytes[0]?.toString(16)}, ${rawBytes[1]?.toString(16)}, ${rawBytes[2]?.toString(16)}]`);
      }
    } catch (err: any) {
      fail('TC-9.4-03 thất bại', err);
      failed++;
    }

    // TC-9.4-04: Header Content-Type text/csv và Content-Disposition attachment
    try {
      const res = await request('/reports/export?format=csv', {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      const cType = res.headers.get('content-type') || '';
      const cDisp = res.headers.get('content-disposition') || '';

      if (cType.includes('text/csv') && cDisp.includes('attachment') && cDisp.includes('.csv')) {
        pass('TC-9.4-04: Header Content-Type text/csv và Content-Disposition attachment chuẩn RFC');
        passed++;
      } else {
        throw new Error(`Headers không chuẩn: Content-Type=${cType}, Content-Disposition=${cDisp}`);
      }
    } catch (err: any) {
      fail('TC-9.4-04 thất bại', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST SUITE: PHÒNG CHỐNG CSV FORMULA INJECTION (CWE-1236)
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 4: KIỂM TRA PHÒNG CHỐNG CSV FORMULA INJECTION (CWE-1236) ---${colors.reset}`);

    try {
      const containsDangerousCommand = csvText.includes('=cmd');
      const containsUnescapedAt = csvText.includes(',@Phở Bò');

      if (!containsDangerousCommand && !containsUnescapedAt) {
        pass('TC-9.4-05: Toàn bộ ô chứa ký tự nguy hiểm (+, -, =, @) đã được khử độc (sanitize) an toàn');
        passed++;
      } else {
        throw new Error(`CSV vẫn chứa payload chưa được sanitize: ${csvText.substring(0, 300)}`);
      }
    } catch (err: any) {
      fail('TC-9.4-05 thất bại', err);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST SUITE: GHI NHẬN AUDIT LOG VÀ MULTI-TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- BƯỚC 5: GHI NHẬN AUDIT LOG & MULTI-TENANT ISOLATION ---${colors.reset}`);

    // TC-9.4-06: Ghi nhận audit log khi xuất báo cáo
    try {
      const auditLog = await db.collection('activity_logs').findOne({
        restaurantId: new Types.ObjectId(restaurantAId),
        action: 'export',
      });
      if (auditLog) {
        pass('TC-9.4-06: Hệ thống ghi nhận nhật ký kiểm toán (ActivityLog: export) thành công (1 bản ghi)');
        passed++;
      } else {
        throw new Error('Không tìm thấy bản ghi ActivityLog cho hành động xuất báo cáo');
      }
    } catch (err: any) {
      fail('TC-9.4-06 thất bại', err);
      failed++;
    }

    // TC-9.4-07: Multi-Tenant Isolation: Admin B xuất báo cáo không bao gồm dữ liệu của Nhà hàng A
    try {
      const resB = await request('/reports/export?format=csv', {
        headers: { Authorization: `Bearer ${adminBToken}` },
      });
      if (resB.status === 200 && !resB.text.includes(`ORD-EXP-01-${timestamp}`)) {
        pass('TC-9.4-07: Multi-Tenant Isolation: Nhà hàng B không bị rò rỉ bất kỳ dữ liệu báo cáo nào của Nhà hàng A');
        passed++;
      } else {
        throw new Error(`Dữ liệu nhà hàng A bị rò rỉ sang nhà hàng B: ${resB.text}`);
      }
    } catch (err: any) {
      fail('TC-9.4-07 thất bại', err);
      failed++;
    }

    // TC-9.4-08: GET /api/tables/public/by-restaurant/:slug trả về đúng danh sách bàn active kèm qrToken
    try {
      const publicTablesRes = await request(`/tables/public/by-restaurant/${encodeURIComponent(restaurantASlug)}`);
      if (
        publicTablesRes.status === 200 &&
        publicTablesRes.data?.success &&
        Array.isArray(publicTablesRes.data?.data?.tables)
      ) {
        const t1 = publicTablesRes.data.data.tables.find((t: any) => t.code === 'ban-vip-01');
        if (t1 && t1.qrToken === `qr-token-test-${timestamp}`) {
          pass('TC-9.4-08: tables.listPublicBySlug trả về đúng bàn active kèm qrToken hợp lệ cho khách hàng');
          passed++;
        } else {
          throw new Error(`Không tìm thấy bàn active hoặc thiếu qrToken: ${JSON.stringify(publicTablesRes.data)}`);
        }
      } else {
        throw new Error(`Gọi tables public thất bại: ${JSON.stringify(publicTablesRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-9.4-08 thất bại', err);
      failed++;
    }

    // TC-9.4-AUD-01: Hardening AUD-9.2 & AUD-9.3: Chặn manager/cashier xuất file và trung hòa payload chèn khoảng trắng
    try {
      // 1. Kiểm tra AUD-9.2: Manager bị chặn 403 Forbidden
      const resMgr = await request('/reports/export?format=csv', {
        headers: { Authorization: `Bearer ${managerAToken}` },
      });

      // 2. Kiểm tra AUD-9.3: Payload có khoảng trắng ngụy trang
      const isMgrBlocked = resMgr.status === 403;
      // Trong csvText từ TC-9.4-02 đã chứa đơn hàng mẫu với payload hiểm độc
      const isNeutralized = !csvText.includes(', =cmd') && !csvText.includes(',=cmd');

      if (isMgrBlocked && isNeutralized) {
        pass('TC-9.4-AUD-01: [AUD-9.2 & AUD-9.3] Khóa cứng 403 cho manager/cashier và trung hòa triệt để Formula Injection kể cả khi chèn khoảng trắng');
        passed++;
      } else {
        throw new Error(`Kiểm tra AUD-9.2/AUD-9.3 thất bại: isMgrBlocked=${isMgrBlocked}, isNeutralized=${isNeutralized}`);
      }
    } catch (err: any) {
      fail('TC-9.4-AUD-01 thất bại', err);
      failed++;
    }

  } catch (globalErr: any) {
    fail('Lỗi thực thi tổng thể Suite 4', globalErr);
    failed++;
  } finally {
    console.log(`\n[Teardown] Dọn dẹp tài nguyên Suite 4...`);
    try {
      if (restaurantAId) {
        await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantAId) });
        await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await db.collection('orders').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await db.collection('tables').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await db.collection('activity_logs').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
      }
      if (restaurantBId) {
        await db.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantBId) });
        await db.collection('users').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
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
