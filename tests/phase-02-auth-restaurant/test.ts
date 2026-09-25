import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';

const TEST_PORT = 3099;
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
  console.error(`    ${colors.red}${error}${colors.reset}`);
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
  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Phase 2: Auth + Restaurant Test Suite  ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  console.log('Khởi động test server trên port', TEST_PORT, '...');
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const connection: Connection = app.get(getConnectionToken());

  // Seed default roles
  const rolesService = app.get(RolesService);
  await rolesService.seedDefaultRoles();

  await app.listen(TEST_PORT);
  console.log(`Test server đã sẵn sàng! (DB: ${colors.cyan}imenu-db-test${colors.reset})\n`);

  let passed = 0;
  let failed = 0;

  const testEmail = `test.owner.${Date.now()}@sample.vn`;
  const testPassword = 'TestPassword@123';
  let accessToken = '';
  let refreshToken = '';
  let createdRestaurantId = '';
  let createdBranchId = '';

  try {
    // 1. Register Happy Path
    try {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: 'Bếp Nhà Sài Gòn',
          phone: '0908 123 456',
          address: '123 Đồng Khởi, Q.1, TP.HCM',
        },
        owner: {
          fullName: 'Nguyễn Văn Kiểm Thử',
          phone: '0909 999 888',
          email: testEmail,
          password: testPassword,
        },
      }),
    });

    if (res.status === 201 && res.data.success && res.data.data?.accessToken && res.data.data?.restaurant?.slug) {
      accessToken = res.data.data.accessToken;
      refreshToken = res.data.data.refreshToken;
      createdRestaurantId = res.data.data.restaurant.id;
      pass('1. Đăng ký nhà hàng mới kèm chủ quán (POST /auth/register)', `Slug: ${res.data.data.restaurant.slug}`);
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, Response: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    fail('1. Đăng ký nhà hàng mới kèm chủ quán', err.message);
    failed++;
  }

  // 2. Register duplicate email
  try {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: 'Bếp Nhà Chi Nhánh 2',
          phone: '0908 123 456',
          address: '456 Lê Lợi, Q.1, TP.HCM',
        },
        owner: {
          fullName: 'Nguyễn Văn Kiểm Thử',
          phone: '0909 999 888',
          email: testEmail, // Trùng email
          password: testPassword,
        },
      }),
    });

    if (res.status === 409) {
      pass('2. Chặn đăng ký trùng email (409 Conflict)');
      passed++;
    } else {
      throw new Error(`Mong đợi 409, nhận được: ${res.status}`);
    }
  } catch (err: any) {
    fail('2. Chặn đăng ký trùng email', err.message);
    failed++;
  }

  // 3. Register validation error (password < 8 chars)
  try {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: 'Bếp Test',
          phone: '0908 123 456',
          address: '123 Test',
        },
        owner: {
          fullName: 'User Test',
          phone: '0909 999 888',
          email: 'invalid@sample.vn',
          password: '123', // Ngắn < 8 ký tự
        },
      }),
    });

    if (res.status === 400) {
      pass('3. Kiểm tra tính hợp lệ dữ liệu đăng ký (400 Bad Request cho password < 8 ký tự)');
      passed++;
    } else {
      throw new Error(`Mong đợi 400, nhận được: ${res.status}`);
    }
  } catch (err: any) {
    fail('3. Kiểm tra tính hợp lệ dữ liệu đăng ký', err.message);
    failed++;
  }

  // 4. Login Happy Path
  try {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        rememberMe: true,
      }),
    });

    if (
      res.status === 200 &&
      res.data.success &&
      res.data.data?.accessToken &&
      Array.isArray(res.data.data?.permissions) &&
      res.data.data.permissions.includes('perm-menu-view')
    ) {
      accessToken = res.data.data.accessToken;
      refreshToken = res.data.data.refreshToken;
      pass('4. Đăng nhập thành công (POST /auth/login)', `${res.data.data.permissions.length} quyền hạn`);
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, Response: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    fail('4. Đăng nhập thành công', err.message);
    failed++;
  }

  // 5. Login wrong password
  try {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'SaiMatKhau123',
      }),
    });

    if (res.status === 401) {
      pass('5. Chặn đăng nhập sai mật khẩu (401 Unauthorized)');
      passed++;
    } else {
      throw new Error(`Mong đợi 401, nhận được: ${res.status}`);
    }
  } catch (err: any) {
    fail('5. Chặn đăng nhập sai mật khẩu', err.message);
    failed++;
  }

  // 6. Login non-existent email
  try {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'khongton_tai_12345@gmail.com',
        password: testPassword,
      }),
    });

    if (res.status === 401) {
      pass('6. Chặn đăng nhập email không tồn tại (401 Unauthorized)');
      passed++;
    } else {
      throw new Error(`Mong đợi 401, nhận được: ${res.status}`);
    }
  } catch (err: any) {
    fail('6. Chặn đăng nhập email không tồn tại', err.message);
    failed++;
  }

  // 7. Get Profile (GET /auth/me) with token
  try {
    const res = await request('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 200 && res.data.data?.user?.email === testEmail) {
      pass('7. Lấy thông tin tài khoản hiện tại (GET /auth/me)', `User: ${res.data.data.user.fullName}`);
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, Response: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    fail('7. Lấy thông tin tài khoản hiện tại', err.message);
    failed++;
  }

  // 8. Refresh Token (POST /auth/refresh)
  try {
    const res = await request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (res.status === 200) {
      if (res.data.data?.accessToken) {
        pass('8. Làm mới Access Token (POST /auth/refresh)');
        passed++;
      } else {
        throw new Error('Không nhận được accessToken mới');
      }
    } else {
      throw new Error(`Status: ${res.status}`);
    }
  } catch (err: any) {
    fail('8. Làm mới Access Token', err.message);
    failed++;
  }

  // 9. Get Current Restaurant (GET /restaurants/current)
  try {
    const res = await request('/restaurants/current', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 200 && res.data.data?.name === 'Bếp Nhà Sài Gòn') {
      pass('9. Lấy thông tin nhà hàng hiện tại (GET /restaurants/current)', `Tên quán: ${res.data.data.name}`);
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, Response: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    fail('9. Lấy thông tin nhà hàng hiện tại', err.message);
    failed++;
  }

  // 10. Update Current Restaurant & VietQR (PUT /restaurants/current)
  try {
    const res = await request('/restaurants/current', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: 'Bếp Nhà Sài Gòn - Ẩm Thực Tinh Hoa',
        phone: '0908 888 999',
        bankAccount: {
          bankId: 'MB',
          bankName: 'MBBank',
          accountNo: '0908888999',
          accountName: 'BEP NHA SAI GON',
        },
      }),
    });

    if (
      res.status === 200 &&
      res.data.data?.name === 'Bếp Nhà Sài Gòn - Ẩm Thực Tinh Hoa' &&
      res.data.data?.bankAccount?.accountNo === '0908888999'
    ) {
      pass('10. Cập nhật thông tin nhà hàng & tài khoản VietQR (PUT /restaurants/current)', 'Đã lưu cấu hình ngân hàng');
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, Response: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    fail('10. Cập nhật thông tin nhà hàng & VietQR', err.message);
    failed++;
  }

  // 11. Branch CRUD (/branches)
  try {
    // 11.1 List branches
    const listRes = await request('/branches', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (listRes.status !== 200 || !Array.isArray(listRes.data.data)) {
      throw new Error('Lỗi lấy danh sách chi nhánh');
    }

    // 11.2 Create second branch
    const createRes = await request('/branches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: 'Chi nhánh Quận 3',
        address: '124 Nam Kỳ Khởi Nghĩa, Q.3, TP.HCM',
        phone: '0908 654 321',
        isMainBranch: false,
      }),
    });

    if (createRes.status !== 201 && createRes.status !== 200) {
      throw new Error('Lỗi tạo chi nhánh mới');
    }
    createdBranchId = createRes.data.data._id || createRes.data.data.id;

    // 11.3 Update branch
    const updateRes = await request(`/branches/${createdBranchId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: 'Chi nhánh Quận 3 (VIP)',
      }),
    });
    if (updateRes.status !== 200 || updateRes.data.data?.name !== 'Chi nhánh Quận 3 (VIP)') {
      throw new Error('Lỗi cập nhật chi nhánh');
    }

    // 11.4 Delete branch
    const deleteRes = await request(`/branches/${createdBranchId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (deleteRes.status !== 200) {
      throw new Error('Lỗi xóa chi nhánh phụ');
    }

    pass('11. Quản lý chi nhánh CRUD (/branches)', 'Tạo, sửa, xóa chi nhánh phụ thành công');
    passed++;
  } catch (err: any) {
    fail('11. Quản lý chi nhánh CRUD', err.message);
    failed++;
  }

  // 12. Logout (POST /auth/logout)
  try {
    const res = await request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 200 || res.status === 201) {
      pass('12. Đăng xuất khỏi hệ thống (POST /auth/logout)');
      passed++;
    } else {
      throw new Error(`Status: ${res.status}`);
    }
  } catch (err: any) {
    fail('12. Đăng xuất khỏi hệ thống', err.message);
    failed++;
  }

    console.log(`\n----------------------------------------------------`);
    console.log(`Kết quả kiểm thử: ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} failed${colors.reset}`);
    console.log(`----------------------------------------------------\n`);
  } finally {
    console.log(`${colors.cyan}[Teardown] Tự động dọn dẹp tài nguyên kiểm thử...${colors.reset}`);
    try {
      if (createdRestaurantId) {
        await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(createdRestaurantId) });
      }
      if (testEmail) {
        await connection.collection('users').deleteOne({ email: testEmail });
      }
      // Dọn dẹp quét sạch bất kỳ bản ghi thử nghiệm nào
      await connection.collection('users').deleteMany({ email: /^test\.owner\./i });
      await connection.collection('restaurants').deleteMany({ slug: /^bep-nha-sai-gon-/i });
      console.log(`  ${colors.green}✔ Đã dọn dẹp sạch sẽ toàn bộ dữ liệu test (Zero Garbage)${colors.reset}\n`);
    } catch (cleanErr: any) {
      console.warn('Cảnh báo khi dọn dẹp dữ liệu test:', cleanErr.message);
    }

    await app.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Lỗi khi chạy kiểm thử:', err);
  if (app) app.close();
  process.exit(1);
});
