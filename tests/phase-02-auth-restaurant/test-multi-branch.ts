import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { AuthService } from '../../src/modules/auth/auth.service';

const TEST_PORT = 3098;
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
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Phase 2: Multi-Branch & Isolation Test Suite      ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  console.log('Khởi động test server trên port', TEST_PORT, '...');
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const connection: Connection = app.get(getConnectionToken());

  // Seed default roles & demo owner
  const rolesService = app.get(RolesService);
  await rolesService.seedDefaultRoles();

  await connection.collection('users').deleteMany({ email: 'owner@sample.vn' });
  await connection.collection('restaurants').deleteMany({ slug: 'bep-nha' });

  const authService = app.get(AuthService);
  await authService.seedDemoOwner();

  await app.listen(TEST_PORT);
  console.log(`Test server đã sẵn sàng! (DB: ${colors.cyan}imenu-db-test${colors.reset})\n`);

  let passed = 0;
  let failed = 0;

  const timestamp = Date.now();
  const ownerEmail = `mb.owner.${timestamp}@sample.vn`;
  const branchManagerEmail = `mb.manager.a.${timestamp}@sample.vn`;
  const cashierEmail = `mb.cashier.a.${timestamp}@sample.vn`;
  const testPassword = 'Password@123';

  let ownerToken = '';
  let managerToken = '';
  let restaurantId = '';
  let mainBranchId = '';
  let childBranchAId = '';
  let childBranchBId = '';
  let managerAId = '';
  let cashierAId = '';

  try {
    // 1. Setup: Register restaurant with Main Branch
    try {
      const res = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          restaurant: {
            name: `Chuỗi Nhà Hàng Đa Chi Nhánh ${timestamp}`,
            phone: '0901234567',
            address: 'Trụ sở chính, Q.1, TP.HCM',
          },
          owner: {
            fullName: 'Chủ Chuỗi Nhà Hàng',
            phone: '0901111222',
            email: ownerEmail,
            password: testPassword,
          },
        }),
      });

      if (res.status === 201 && res.data.success && res.data.data?.accessToken) {
        ownerToken = res.data.data.accessToken;
        restaurantId = res.data.data.restaurant.id;

        // Fetch current restaurant to get main branch id
        const restRes = await request('/restaurants/current', {
          headers: { Authorization: `Bearer ${ownerToken}` },
        });
        const branches = restRes.data.data.branches;
        const mainBranch = branches.find((b: any) => b.isMainBranch);
        mainBranchId = mainBranch._id || mainBranch.id;

        pass('1. Đăng ký chuỗi nhà hàng và xác định chi nhánh chính', `MainBranchId: ${mainBranchId}`);
        passed++;
      } else {
        throw new Error(`Status: ${res.status}, Body: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      fail('1. Đăng ký chuỗi nhà hàng', err.message);
      failed++;
    }

    // 2. Main Branch Admin creates Child Branch A & Child Branch B
    try {
      const resA = await request('/branches', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          name: 'Chi nhánh Quận 3',
          address: '124 Nam Kỳ Khởi Nghĩa, Q.3, TP.HCM',
          phone: '0908 654 321',
          isMainBranch: false,
        }),
      });

      const resB = await request('/branches', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          name: 'Chi nhánh Bình Thạnh',
          address: '45 Điện Biên Phủ, Bình Thạnh, TP.HCM',
          phone: '0907 111 222',
          isMainBranch: false,
        }),
      });

      if (resA.status === 201 && resB.status === 201) {
        childBranchAId = resA.data.data._id || resA.data.data.id;
        childBranchBId = resB.data.data._id || resB.data.data.id;
        pass('2. Tạo 2 chi nhánh con (Quận 3 & Bình Thạnh)', `Branch A: ${childBranchAId}, Branch B: ${childBranchBId}`);
        passed++;
      } else {
        throw new Error(`Tạo chi nhánh thất bại: A=${resA.status}, B=${resB.status}`);
      }
    } catch (err: any) {
      fail('2. Tạo 2 chi nhánh con', err.message);
      failed++;
    }

    // 3. Test Invariants: Main Branch cannot be deleted, but CAN be temporarily closed/reopened
    try {
      // 3.1 Chặn xóa chi nhánh chính
      const delRes = await request(`/branches/${mainBranchId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      // 3.2 Chặn ngừng hoạt động vĩnh viễn chi nhánh chính
      const deactRes = await request(`/branches/${mainBranchId}/deactivate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ reason: 'Thử ngừng vĩnh viễn' }),
      });

      // 3.3 Cho phép tạm đóng chi nhánh chính (hết giờ làm việc) và mở lại
      const closeRes = await request(`/branches/${mainBranchId}/close`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ reason: 'Hết giờ làm việc trong ngày' }),
      });

      const reopenRes = await request(`/branches/${mainBranchId}/reopen`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      if (delRes.status === 400 && deactRes.status === 400 && closeRes.status === 200 && reopenRes.status === 200) {
        pass('3. Chi nhánh chính: Chặn xóa vĩnh viễn (400) & Cho phép đóng/mở giờ hoạt động (200 OK)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng del=400, deact=400, close=200, reopen=200; Thực tế: del=${delRes.status}, deact=${deactRes.status}, close=${closeRes.status}, reopen=${reopenRes.status}`);
      }
    } catch (err: any) {
      fail('3. Bảo vệ và đóng/mở chi nhánh chính', err.message);
      failed++;
    }

    // 4. Branch Lifecycle: Temporarily close and reopen Child Branch A
    try {
      // 4.1 Close
      const closeRes = await request(`/branches/${childBranchAId}/close`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ reason: 'Sửa chữa bảo dưỡng mặt bằng' }),
      });

      if (closeRes.status !== 200 || closeRes.data.data?.status !== 'TEMPORARILY_CLOSED') {
        throw new Error(`Đóng chi nhánh thất bại: ${closeRes.status}`);
      }

      // 4.2 Reopen
      const reopenRes = await request(`/branches/${childBranchAId}/reopen`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      if (reopenRes.status !== 200 || reopenRes.data.data?.status !== 'ACTIVE') {
        throw new Error(`Mở lại chi nhánh thất bại: ${reopenRes.status}`);
      }

      pass('4. Vòng đời chi nhánh: Tạm đóng và mở lại chi nhánh con thành công (ACTIVE -> TEMPORARILY_CLOSED -> ACTIVE)');
      passed++;
    } catch (err: any) {
      fail('4. Vòng đời chi nhánh', err.message);
      failed++;
    }

    // 5. Create Child Branch A Manager and Staff
    try {
      const managerRole = await rolesService.findBySlug('restaurant_manager');
      const cashierRole = await rolesService.findBySlug('cashier');

      // Create Manager for Branch A
      const createMgrRes = await request('/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          username: `manager_a_${timestamp}`,
          email: branchManagerEmail,
          password: testPassword,
          fullName: 'Quản Lý Chi Nhánh Quận 3',
          phone: '0903333444',
          roleId: (managerRole as any)._id.toString(),
          branchId: childBranchAId,
        }),
      });

      if (createMgrRes.status !== 201) {
        throw new Error(`Tạo quản lý chi nhánh A thất bại: ${createMgrRes.status} ${JSON.stringify(createMgrRes.data)}`);
      }
      managerAId = createMgrRes.data.data._id || createMgrRes.data.data.id;

      // Login as Branch A Manager
      const loginRes = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: branchManagerEmail,
          password: testPassword,
        }),
      });

      if (loginRes.status !== 200 || !loginRes.data.data?.accessToken) {
        throw new Error(`Đăng nhập quản lý chi nhánh A thất bại: ${loginRes.status}`);
      }
      managerToken = loginRes.data.data.accessToken;

      pass('5. Tạo và đăng nhập tài khoản Quản lý Chi nhánh Quận 3', `ManagerId: ${managerAId}`);
      passed++;
    } catch (err: any) {
      fail('5. Tạo tài khoản quản lý chi nhánh', err.message);
      failed++;
    }

    // 6. Child Branch Isolation: Manager A cannot view or access Branch B
    try {
      // 6.1 List branches: should return ONLY Branch A
      const branchListRes = await request('/branches', {
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      if (branchListRes.status !== 200 || branchListRes.data.data.length !== 1) {
        throw new Error(`Kỳ vọng chỉ thấy 1 chi nhánh của mình, nhưng nhận được: ${branchListRes.data.data?.length}`);
      }
      if (branchListRes.data.data[0]._id !== childBranchAId && branchListRes.data.data[0].id !== childBranchAId) {
        throw new Error('Chi nhánh trả về không khớp với chi nhánh của Manager A');
      }

      // 6.2 Get Branch B by ID: should be 403 Forbidden
      const branchBRes = await request(`/branches/${childBranchBId}`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      if (branchBRes.status !== 403) {
        throw new Error(`Kỳ vọng 403 Forbidden khi truy cập chi nhánh B, nhận được: ${branchBRes.status}`);
      }

      pass('6. Cô lập chi nhánh con: Quản lý chi nhánh A chỉ thấy chi nhánh của mình, bị chặn 403 khi xem chi nhánh B');
      passed++;
    } catch (err: any) {
      fail('6. Cô lập chi nhánh con', err.message);
      failed++;
    }

    // 7. Staff Management & Isolation: Manager A can create staff for Branch A, but blocked from Branch B
    try {
      const cashierRole = await rolesService.findBySlug('cashier');

      // 7.1 Manager A creates staff for Branch B -> Must be blocked (403)
      const invalidCreateRes = await request('/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${managerToken}` },
        body: JSON.stringify({
          username: `illegal_staff_${timestamp}`,
          email: `illegal.${timestamp}@sample.vn`,
          password: testPassword,
          fullName: 'Nhân Viên Trái Phép',
          phone: '0905555666',
          roleId: (cashierRole as any)._id.toString(),
          branchId: childBranchBId, // Thử gán sang chi nhánh B
        }),
      });

      if (invalidCreateRes.status !== 403) {
        throw new Error(`Kỳ vọng 403 Forbidden khi tạo nhân viên ngoài phạm vi chi nhánh, nhận: ${invalidCreateRes.status}`);
      }

      // 7.2 Manager A creates staff for own Branch A -> 201 Created
      const validCreateRes = await request('/users', {
        method: 'POST',
        headers: { Authorization: `Bearer ${managerToken}` },
        body: JSON.stringify({
          username: `cashier_a_${timestamp}`,
          email: cashierEmail,
          password: testPassword,
          fullName: 'Thu Ngân Chi Nhánh Quận 3',
          phone: '0906666777',
          roleId: (cashierRole as any)._id.toString(),
          branchId: childBranchAId,
        }),
      });

      if (validCreateRes.status !== 201) {
        throw new Error(`Tạo nhân viên chi nhánh A thất bại: ${validCreateRes.status}`);
      }
      cashierAId = validCreateRes.data.data._id || validCreateRes.data.data.id;

      // 7.3 Manager A views user list -> Only sees Branch A staff
      const userListRes = await request('/users', {
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      const returnedUsers = userListRes.data.data?.items || [];
      const hasOtherBranchUser = returnedUsers.some((u: any) => u.branchId && u.branchId !== childBranchAId);
      if (hasOtherBranchUser) {
        throw new Error('Manager A thấy nhân viên của chi nhánh khác trong danh sách');
      }

      pass('7. Phân quyền nhân sự chi nhánh: Chặn tạo nhân sự cho chi nhánh khác (403), cho phép tạo trong chi nhánh của mình');
      passed++;
    } catch (err: any) {
      fail('7. Phân quyền nhân sự chi nhánh', err.message);
      failed++;
    }

    // 8. Staff Branch Transfer: Main Branch Admin transfers cashier from Branch A to Branch B
    try {
      // 8.1 Manager A tries to transfer staff -> 403 Forbidden
      const illegalTransferRes = await request(`/users/${cashierAId}/transfer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${managerToken}` },
        body: JSON.stringify({
          targetBranchId: childBranchBId,
          reason: 'Quản lý con tự ý chuyển người',
        }),
      });

      if (illegalTransferRes.status !== 403) {
        throw new Error(`Kỳ vọng 403 khi quản lý chi nhánh con chuyển nhân sự, nhận: ${illegalTransferRes.status}`);
      }

      // 8.2 Main Branch Admin transfers staff -> 200 OK
      const validTransferRes = await request(`/users/${cashierAId}/transfer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          targetBranchId: childBranchBId,
          reason: 'Điều động nhân sự hỗ trợ chi nhánh Bình Thạnh',
        }),
      });

      if (validTransferRes.status !== 200 || validTransferRes.data.data?.branchId !== childBranchBId) {
        throw new Error(`Điều chuyển nhân sự thất bại: ${validTransferRes.status} ${JSON.stringify(validTransferRes.data)}`);
      }

      pass('8. Điều chuyển nhân sự giữa các chi nhánh: Chặn chi nhánh con (403), chi nhánh chính điều chuyển thành công');
      passed++;
    } catch (err: any) {
      fail('8. Điều chuyển nhân sự giữa các chi nhánh', err.message);
      failed++;
    }

    // 9. Revenue & Dashboard Reporting Scoping
    try {
      // Seed orders: Main Branch ($500,000) and Branch A ($300,000)
      const orderCol = connection.collection('orders');
      await orderCol.insertOne({
        orderCode: `IM-TEST-MAIN-${timestamp}`,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: mainBranchId,
        tableName: 'Bàn Main 01',
        tableId: new Types.ObjectId(),
        totalAmount: 500000,
        subTotal: 500000,
        status: 'Paid',
        isPaid: true,
        orderSource: 'STAFF_POS',
        items: [{ name: 'Bò Bít Tết Thượng Hạng', quantity: 2, price: 250000 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await orderCol.insertOne({
        orderCode: `IM-TEST-A-${timestamp}`,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: childBranchAId,
        tableName: 'Bàn Q3 01',
        tableId: new Types.ObjectId(),
        totalAmount: 300000,
        subTotal: 300000,
        status: 'Paid',
        isPaid: true,
        orderSource: 'STAFF_POS',
        items: [{ name: 'Cơm Tấm Sườn Nướng', quantity: 3, price: 100000 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 9.1 Manager A calls /reports/revenue -> only sees Branch A revenue (300,000)
      const mgrRevRes = await request('/reports/revenue', {
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      if (mgrRevRes.status !== 200 || mgrRevRes.data.data.summary.totalRevenue !== 300000) {
        throw new Error(`Doanh thu chi nhánh A không đúng: Kỳ vọng 300000, nhận: ${mgrRevRes.data.data?.summary?.totalRevenue}`);
      }

      // 9.2 Manager A attempts to pass branchId=all or main branch ID -> 403 Forbidden
      const illegalRevRes = await request(`/reports/revenue?branchId=${mainBranchId}`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      if (illegalRevRes.status !== 403) {
        throw new Error(`Kỳ vọng 403 khi xem doanh thu chi nhánh khác, nhận: ${illegalRevRes.status}`);
      }

      // 9.3 Main Branch Admin calls /reports/revenue?branchId=all -> sees consolidated (800,000)
      const adminRevRes = await request('/reports/revenue?branchId=all', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      if (adminRevRes.status !== 200 || adminRevRes.data.data.summary.totalRevenue !== 800000) {
        throw new Error(`Doanh thu hợp nhất không đúng: Kỳ vọng 800000, nhận: ${adminRevRes.data.data?.summary?.totalRevenue}`);
      }

      // 9.4 Dashboard Overview check
      const adminDashRes = await request('/dashboard/overview', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      if (adminDashRes.status !== 200 || adminDashRes.data.data.todayRevenue !== 800000) {
        throw new Error(`Dashboard tổng quan không đúng: ${JSON.stringify(adminDashRes.data)}`);
      }

      pass('9. Báo cáo doanh thu & Dashboard: Cách ly theo chi nhánh con (300k), báo cáo hợp nhất cho chi nhánh chính (800k)');
      passed++;
    } catch (err: any) {
      fail('9. Báo cáo doanh thu & Dashboard', err.message);
      failed++;
    }

    // 10. Protection on physical deletion of branch with historical orders
    try {
      const delBranchARes = await request(`/branches/${childBranchAId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      if (delBranchARes.status === 400) {
        pass('10. Bảo toàn kế toán: Chặn xóa vật lý chi nhánh đã có đơn hàng lịch sử (400 Bad Request)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 400 Bad Request khi xóa chi nhánh có đơn hàng, nhận: ${delBranchARes.status}`);
      }
    } catch (err: any) {
      fail('10. Bảo toàn kế toán khi xóa chi nhánh', err.message);
      failed++;
    }

    // 11. Demo Account Protection: Demo user is blocked from mutating restaurant/branches
    try {
      const demoLogin = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'owner@sample.vn', password: 'Demo@123' }),
      });

      if (demoLogin.status === 200 && demoLogin.data.data?.accessToken) {
        const demoToken = demoLogin.data.data.accessToken;

        const mutateRest = await request('/restaurants/current', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${demoToken}` },
          body: JSON.stringify({ name: 'Illegal Restaurant Name' }),
        });

        const mutateBranch = await request('/branches', {
          method: 'POST',
          headers: { Authorization: `Bearer ${demoToken}` },
          body: JSON.stringify({ name: 'Illegal Branch', phone: '0909090909', address: '123 Test' }),
        });

        if (mutateRest.status === 403 && mutateBranch.status === 403) {
          pass('11. Bảo vệ tài khoản Demo: Chặn mọi thao tác sửa cài đặt & tạo chi nhánh (403 Forbidden)');
          passed++;
        } else {
          throw new Error(`Kỳ vọng 403 Forbidden cho Demo: rest=${mutateRest.status}, branch=${mutateBranch.status}`);
        }
      } else {
        pass('11. Bảo vệ tài khoản Demo: Bỏ qua (Chưa có seed owner@sample.vn)');
        passed++;
      }
    } catch (err: any) {
      fail('11. Bảo vệ tài khoản Demo', err.message);
      failed++;
    }

    console.log(`\n----------------------------------------------------------------`);
    console.log(`Kết quả kiểm thử: ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} failed${colors.reset}`);
    console.log(`----------------------------------------------------------------\n`);
  } finally {
    console.log(`${colors.cyan}[Teardown] Dọn dẹp tài nguyên kiểm thử...${colors.reset}`);
    try {
      if (restaurantId) {
        await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantId) });
      }
      await connection.collection('restaurants').deleteMany({ slug: 'bep-nha' });
      await connection.collection('users').deleteMany({ email: 'owner@sample.vn' });
      await connection.collection('users').deleteMany({ email: new RegExp(`\\.${timestamp}@sample\\.vn`, 'i') });
      await connection.collection('orders').deleteMany({ orderCode: new RegExp(`^IM-TEST-.*-${timestamp}$`) });
      console.log(`  ${colors.green}✔ Đã dọn dẹp sạch sẽ dữ liệu thử nghiệm${colors.reset}\n`);
    } catch (cleanErr: any) {
      console.warn('Lỗi dọn dẹp:', cleanErr.message);
    }
    await app.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Lỗi khi chạy bộ kiểm thử:', err);
  if (app) app.close();
  process.exit(1);
});
