import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';

const TEST_PORT = 3130;
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
  console.log(`${colors.bold}${colors.cyan}  Phase 11 Suite 2: Branch Review Isolation & Moderation RBAC (Port ${TEST_PORT}) ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  try {
    app = await NestFactory.create(AppModule, { logger: false });
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
    const timestamp = Date.now();

    // 1. Setup Test Restaurant with 2 branches
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P11 Multi-Branch Rest ${timestamp}`,
          phone: '0909998877',
          address: '222 Lê Duẩn, Q1, TP.HCM',
        },
        owner: {
          fullName: 'P11 Master Owner',
          phone: '0909998877',
          email: `p11owner.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });

    const restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    const ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    const branch1Id = restDoc!.branches[0]._id.toString();

    // Create Branch 2
    const b2Res = await request('/branches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: `Chi Nhánh 2 Bình Thạnh ${timestamp}`,
        address: '88 Xô Viết Nghệ Tĩnh, Bình Thạnh',
        phone: '0908889900',
      }),
    });
    const branch2Id = b2Res.data?.data?._id || b2Res.data?.data?.id;

    // 2. Fetch seeded roles to get restaurant_manager and waiter role IDs
    const rolesRes = await request('/roles', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const rolesList = rolesRes.data?.data || [];
    const managerRole = rolesList.find((r: any) => r.slug === 'restaurant_manager');
    const waiterRole = rolesList.find((r: any) => r.slug === 'waiter');
    const managerRoleId = managerRole?._id || managerRole?.id;
    const waiterRoleId = waiterRole?._id || waiterRole?.id;

    // 3. Create Staff for Branch 1 via POST /users
    const staff1Res = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        branchId: branch1Id,
        roleId: managerRoleId,
        fullName: 'Quản Lý Chi Nhánh 1',
        email: `manager1.${timestamp}@imenu.vn`,
        phone: '0901000001',
        password: 'Password@123',
      }),
    });
    const staff1Login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `manager1.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    const staff1Token = staff1Login.data?.data?.accessToken;

    // 4. Create Staff for Branch 2 via POST /users
    const staff2Res = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        branchId: branch2Id,
        roleId: managerRoleId,
        fullName: 'Quản Lý Chi Nhánh 2',
        email: `manager2.${timestamp}@imenu.vn`,
        phone: '0901000002',
        password: 'Password@123',
      }),
    });
    const staff2Login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `manager2.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    const staff2Token = staff2Login.data?.data?.accessToken;

    // 5. Create Waiter Staff (without perm-review-view permission) via POST /users
    const waiterRes = await request('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        branchId: branch1Id,
        roleId: waiterRoleId,
        fullName: 'Phục Vụ Bàn 1',
        email: `waiter.${timestamp}@imenu.vn`,
        phone: '0901000003',
        password: 'Password@123',
      }),
    });
    const waiterLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: `waiter.${timestamp}@imenu.vn`,
        password: 'Password@123',
      }),
    });
    const waiterToken = waiterLogin.data?.data?.accessToken;

    // 6. Direct Seed Reviews in DB for Branch 1 & Branch 2
    const reviewsColl = connection.collection('reviews');
    const b1Rev1Id = new Types.ObjectId();
    const b1Rev2Id = new Types.ObjectId();
    const b2Rev1Id = new Types.ObjectId();

    await reviewsColl.insertMany([
      {
        _id: b1Rev1Id,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id.toString(),
        branchName: 'Chi Nhánh Chính',
        orderId: new Types.ObjectId(),
        orderCode: `ORD-B1-01-${timestamp}`,
        tableId: new Types.ObjectId(),
        tableName: 'Bàn B1-01',
        overallRating: 5,
        foodRating: 5,
        serviceRating: 5,
        quickTags: ['Món ăn ngon', 'Ra món nhanh'],
        comment: 'Chi nhánh 1 phục vụ tuyệt vời!',
        isHidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: b1Rev2Id,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch1Id.toString(),
        branchName: 'Chi Nhánh Chính',
        orderId: new Types.ObjectId(),
        orderCode: `ORD-B1-02-${timestamp}`,
        tableId: new Types.ObjectId(),
        tableName: 'Bàn B1-02',
        overallRating: 2,
        quickTags: ['Đợi món hơi lâu'],
        comment: 'Đợi món 30 phút hơi đói bụng',
        isHidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: b2Rev1Id,
        restaurantId: new Types.ObjectId(restaurantId),
        branchId: branch2Id.toString(),
        branchName: 'Chi Nhánh 2 Bình Thạnh',
        orderId: new Types.ObjectId(),
        orderCode: `ORD-B2-01-${timestamp}`,
        tableId: new Types.ObjectId(),
        tableName: 'Bàn B2-01',
        overallRating: 4,
        quickTags: ['Không gian sạch sẽ'],
        comment: 'Chi nhánh 2 view bờ sông rất đẹp',
        isHidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // ========================================================================
    // TEST CASES: MULTI-BRANCH ISOLATION & RBAC MODERATION
    // ========================================================================

    // TC-11.2-01: Multi-branch isolation for Branch 2 Manager
    try {
      const listRes = await request('/reviews', {
        headers: { Authorization: `Bearer ${staff2Token}` },
      });

      const items = listRes.data?.data?.items || [];
      const hasBranch1 = items.some((item: any) => item.branchId === branch1Id);
      const allBranch2 = items.every((item: any) => item.branchId === branch2Id);

      if (items.length === 1 && allBranch2 && !hasBranch1) {
        pass('TC-11.2-01: Chi nhánh 2 chỉ thấy đúng đánh giá của chi nhánh mình, không lộ dữ liệu chi nhánh 1 (AUD-11.5)');
        passed++;
      } else {
        throw new Error(`Cách ly chi nhánh thất bại: length=${items.length}, hasBranch1=${hasBranch1}`);
      }
    } catch (err: any) {
      fail('TC-11.2-01: Branch isolation thất bại', err);
      failed++;
    }

    // TC-11.2-02: Branch 2 manager attempting to bypass branch filter
    try {
      const listRes = await request(`/reviews?branchId=${branch1Id}`, {
        headers: { Authorization: `Bearer ${staff2Token}` },
      });

      const items = listRes.data?.data?.items || [];
      const hasBranch1 = items.some((item: any) => item.branchId === branch1Id);

      if (!hasBranch1) {
        pass('TC-11.2-02: Chặn quản lý chi nhánh 2 tự ý truy vấn branchId của chi nhánh 1 (AUD-11.5)');
        passed++;
      } else {
        throw new Error(`Đã để lộ đánh giá chi nhánh 1 cho nhân viên chi nhánh 2!`);
      }
    } catch (err: any) {
      fail('TC-11.2-02: Prevent branch filter bypass thất bại', err);
      failed++;
    }

    // TC-11.2-03: HQ Owner cross-branch visibility & filtering
    try {
      // Unfiltered list for owner -> sees both
      const allRes = await request('/reviews', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const allItems = allRes.data?.data?.items || [];

      // Filtered to Branch 1 specifically
      const b1OnlyRes = await request(`/reviews?branchId=${branch1Id}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const b1Items = b1OnlyRes.data?.data?.items || [];

      if (allItems.length >= 3 && b1Items.length === 2 && b1Items.every((i: any) => i.branchId === branch1Id)) {
        pass('TC-11.2-03: Chủ nhà hàng (HQ) có quyền xem toàn bộ chi nhánh và lọc linh hoạt theo từng chi nhánh');
        passed++;
      } else {
        throw new Error(`HQ query không chính xác: all=${allItems.length}, b1=${b1Items.length}`);
      }
    } catch (err: any) {
      fail('TC-11.2-03: HQ review access thất bại', err);
      failed++;
    }

    // TC-11.2-04: Review Summary Aggregation
    try {
      const summaryRes = await request('/reviews/summary', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      const summary = summaryRes.data?.data;
      if (
        summary &&
        summary.totalReviews >= 3 &&
        typeof summary.averageOverall === 'number' &&
        Array.isArray(summary.branchBreakdown) &&
        summary.branchBreakdown.length >= 2
      ) {
        pass('TC-11.2-04: API /reviews/summary tổng hợp chính xác CSAT toàn hệ thống và breakdown chi nhánh');
        passed++;
      } else {
        throw new Error(`Summary dữ liệu không đầy đủ: ${JSON.stringify(summary)}`);
      }
    } catch (err: any) {
      fail('TC-11.2-04: Review summary aggregation thất bại', err);
      failed++;
    }

    // TC-11.2-05: Merchant Reply to Review
    try {
      const replyRes = await request(`/reviews/${b2Rev1Id.toString()}/reply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staff2Token}` },
        body: JSON.stringify({
          content: 'Cảm ơn quý khách đã khen ngợi không gian chi nhánh 2 ạ!',
        }),
      });

      if (
        (replyRes.status === 200 || replyRes.status === 201) &&
        replyRes.data?.data?.merchantReply?.content === 'Cảm ơn quý khách đã khen ngợi không gian chi nhánh 2 ạ!'
      ) {
        pass('TC-11.2-05: Quản lý chi nhánh gửi phản hồi đánh giá thành công kèm ghi nhận người trả lời');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200/201 OK nhưng nhận ${replyRes.status}: ${JSON.stringify(replyRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.2-05: Merchant reply thất bại', err);
      failed++;
    }

    // TC-11.2-06: Cross-branch reply prevention
    try {
      // Staff 2 attempts to reply to Branch 1's review
      const crossReplyRes = await request(`/reviews/${b1Rev1Id.toString()}/reply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staff2Token}` },
        body: JSON.stringify({
          content: 'Phản hồi trái phép chi nhánh khác',
        }),
      });

      if (crossReplyRes.status === 403) {
        pass('TC-11.2-06: Chặn nhân viên chi nhánh 2 phản hồi đánh giá của chi nhánh 1 trả về 403 Forbidden');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 403 Forbidden nhưng nhận ${crossReplyRes.status}`);
      }
    } catch (err: any) {
      fail('TC-11.2-06: Cross-branch reply guard thất bại', err);
      failed++;
    }

    // TC-11.2-07: Moderation toggle hidden by Restaurant Admin (AUD-11.7)
    try {
      const toggleRes = await request(`/reviews/${b1Rev2Id.toString()}/toggle-hidden`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ isHidden: true }),
      });

      if (toggleRes.status === 200 && toggleRes.data?.data?.isHidden === true) {
        pass('TC-11.2-07: Quản trị viên nhà hàng (restaurant_admin) ẩn đánh giá thành công (AUD-11.7)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200 OK nhưng nhận ${toggleRes.status}: ${JSON.stringify(toggleRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.2-07: Toggle hidden by admin thất bại', err);
      failed++;
    }

    // TC-11.2-08: Non-admin staff blocked from toggle-hidden (AUD-11.7)
    try {
      const unauthorizedToggleRes = await request(`/reviews/${b1Rev2Id.toString()}/toggle-hidden`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${staff1Token}` }, // Manager, not restaurant_admin
        body: JSON.stringify({ isHidden: false }),
      });

      if (unauthorizedToggleRes.status === 403) {
        pass('TC-11.2-08: Chặn nhân viên quản lý thông thường tự ý ẩn/bỏ ẩn đánh giá trả về 403 Forbidden (AUD-11.7)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 403 Forbidden nhưng nhận ${unauthorizedToggleRes.status}`);
      }
    } catch (err: any) {
      fail('TC-11.2-08: Block non-admin toggle hidden thất bại', err);
      failed++;
    }

    // TC-11.2-09: Waiter without perm-review-view blocked from GET /reviews
    try {
      const noPermRes = await request('/reviews', {
        headers: { Authorization: `Bearer ${waiterToken}` },
      });

      if (noPermRes.status === 403) {
        pass('TC-11.2-09: Nhân viên phục vụ không có perm-review-view bị chặn truy cập danh sách đánh giá (403)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 403 Forbidden nhưng nhận ${noPermRes.status}`);
      }
    } catch (err: any) {
      fail('TC-11.2-09: Block unauthorized role from reviews list thất bại', err);
      failed++;
    }

  } catch (globalErr: any) {
    console.error('Lỗi khởi tạo test suite:', globalErr);
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả Phase 11 Suite 2: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
