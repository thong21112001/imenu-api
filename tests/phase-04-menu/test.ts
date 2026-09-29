import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { RolesService } from '../../src/modules/roles/roles.service';
import { UsersService } from '../../src/modules/users/users.service';
import { CategoriesService } from '../../src/modules/menu/categories.service';
import { hashPassword } from '../../src/shared/common/utils/password.util';

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
  console.log(`${colors.bold}${colors.cyan}  iMenu API - Phase 4: Menu Management & Toppings Test Suite  ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  console.log('Khởi động test server trên port', TEST_PORT, '...');
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const connection: Connection = app.get(getConnectionToken());

  // Seed default roles and admin
  const rolesService = app.get(RolesService);
  await rolesService.seedDefaultRoles();

  const usersService = app.get(UsersService);
  await usersService.initAdmin();

  const categoriesService = app.get(CategoriesService);

  await app.listen(TEST_PORT);
  console.log('Test server đã sẵn sàng!\n');

  let passed = 0;
  let failed = 0;

  // Variables for test lifecycle
  let restaurantAId = '';
  let restaurantBId = '';
  let ownerAToken = '';
  let ownerBToken = '';
  let cashierToken = '';
  let category1Id = '';
  let category2Id = '';
  let menuItem1Id = '';

  const timestamp = Date.now();
  const emailOwnerA = `owner.p4.a.${timestamp}@imenu.vn`;
  const emailOwnerB = `owner.p4.b.${timestamp}@imenu.vn`;
  const emailCashier = `cashier.p4.${timestamp}@imenu.vn`;

  try {
    // ----------------------------------------------------
    // PREPARATION: Setup sample restaurants A & B + Cashier
    // ----------------------------------------------------
    console.log(`${colors.bold}--- Chuẩn Bị Dữ Liệu Kiểm Thử (Pre-test Setup) ---${colors.reset}`);

    // 1. Register Restaurant A
    const regResA = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng Phase 4A ${timestamp}`,
          phone: '0981111111',
          address: '100 Lê Lợi, Quận 1, TP.HCM',
        },
        owner: {
          fullName: 'Chủ Quán 4A',
          phone: '0981111111',
          email: emailOwnerA,
          password: 'Password@123',
        },
      }),
    });
    ownerAToken = regResA.data?.data?.accessToken;
    restaurantAId = regResA.data?.data?.restaurant?._id || regResA.data?.data?.restaurant?.id;

    // 2. Register Restaurant B
    const regResB = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `Nhà Hàng Phase 4B ${timestamp}`,
          phone: '0982222222',
          address: '200 Hai Bà Trưng, Quận 3, TP.HCM',
        },
        owner: {
          fullName: 'Chủ Quán 4B',
          phone: '0982222222',
          email: emailOwnerB,
          password: 'Password@123',
        },
      }),
    });
    ownerBToken = regResB.data?.data?.accessToken;
    restaurantBId = regResB.data?.data?.restaurant?._id || regResB.data?.data?.restaurant?.id;

    // 3. Find Cashier role & create Cashier user for Restaurant A
    const cashierRole = await rolesService.findBySlug('cashier');
    const branchA = regResA.data?.data?.restaurant?.branches?.[0];
    const branchAId = branchA?._id?.toString() || branchA?.id?.toString() || '';

    await usersService.createDemoUser({
      username: `cashier_p4_${timestamp}`,
      email: emailCashier,
      passwordHash: await hashPassword('Password@123'),
      fullName: 'Thu Ngân 4A',
      phone: '0983333333',
      roleId: (cashierRole as any)._id.toString(),
      restaurantId: restaurantAId,
      branchId: branchAId,
      branchName: branchA?.name || 'Chi nhánh chính',
    });

    // Login Cashier
    const cashierLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: emailCashier,
        password: 'Password@123',
      }),
    });
    cashierToken = cashierLoginRes.data?.data?.accessToken;

    if (ownerAToken && ownerBToken && cashierToken && restaurantAId && restaurantBId) {
      pass('Thiết lập dữ liệu ban đầu', 'Đã khởi tạo Nhà hàng A, Nhà hàng B và tài khoản Thu ngân');
    } else {
      throw new Error('Không thể khởi tạo môi trường test cho Phase 4');
    }

    console.log(`\n${colors.bold}--- Thực Hiện Các Ca Kiểm Thử Thực Đơn (Phase 4 Cases) ---${colors.reset}`);

    // ----------------------------------------------------
    // CA 1: Tạo danh mục món ăn mới (Create Category)
    // ----------------------------------------------------
    try {
      const res = await request('/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerAToken}` },
        body: JSON.stringify({
          name: 'Món Nướng BBQ Đặc Sắc',
          icon: '🥩',
          order: 1,
        }),
      });

      if (res.status === 201 && res.data?.data?.slug === 'mon-nuong-bbq-dac-sac' && res.data?.data?.name === 'Món Nướng BBQ Đặc Sắc') {
        category1Id = res.data.data.id || res.data.data._id;
        pass('Ca 1: Tạo danh mục món ăn mới', `Slug tự sinh: ${res.data.data.slug}, ID: ${category1Id}`);
        passed++;
      } else {
        fail('Ca 1: Tạo danh mục món ăn mới', `Status ${res.status}, data: ${JSON.stringify(res.data)}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 1: Tạo danh mục món ăn mới', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 2: Xử lý trùng lặp slug danh mục cùng nhà hàng (Auto-slug Deduplication)
    // ----------------------------------------------------
    try {
      const res = await request('/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerAToken}` },
        body: JSON.stringify({
          name: 'Món Nướng BBQ Đặc Sắc', // Cùng tên
          icon: '🔥',
          order: 2,
        }),
      });

      if (res.status === 201 && res.data?.data?.slug?.startsWith('mon-nuong-bbq-dac-sac-')) {
        category2Id = res.data.data.id || res.data.data._id;
        pass('Ca 2: Tự động tránh trùng lặp slug cùng nhà hàng', `Slug mới: ${res.data.data.slug}`);
        passed++;
      } else {
        fail('Ca 2: Tự động tránh trùng lặp slug cùng nhà hàng', `Status ${res.status}, data: ${JSON.stringify(res.data)}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 2: Tự động tránh trùng lặp slug cùng nhà hàng', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 3: Chỉnh sửa thông tin danh mục (Update Category)
    // ----------------------------------------------------
    try {
      const res = await request(`/categories/${category1Id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerAToken}` },
        body: JSON.stringify({
          name: 'Món Nướng BBQ Thượng Hạng',
          icon: '🍖',
          order: 10,
        }),
      });

      if (res.status === 200 && res.data?.data?.name === 'Món Nướng BBQ Thượng Hạng' && res.data?.data?.order === 10) {
        pass('Ca 3: Cập nhật thông tin danh mục', `Tên mới: ${res.data.data.name}, icon: ${res.data.data.icon}`);
        passed++;
      } else {
        fail('Ca 3: Cập nhật thông tin danh mục', `Status ${res.status}, data: ${JSON.stringify(res.data)}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 3: Cập nhật thông tin danh mục', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 4: Tạo món ăn mới đầy đủ options / topping (Create Menu Item with Options)
    // ----------------------------------------------------
    try {
      const res = await request('/menu-items', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerAToken}` },
        body: JSON.stringify({
          categoryId: category1Id,
          name: 'Sườn Bò Mỹ Nướng Sốt Cay Hàn Quốc',
          price: 185000,
          originalPrice: 210000,
          description: 'Sườn bò hảo hạng ướp sốt cay ngọt chuẩn vị Seoul nướng thơm phức',
          imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947',
          isPopular: true,
          options: [
            {
              id: 'opt-doneness',
              name: 'Độ chín thịt bò',
              required: true,
              multiple: false,
              values: [
                { id: 'opt-med', name: 'Vừa chín tới (Medium)', priceDelta: 0 },
                { id: 'opt-well', name: 'Chín kỹ (Well-done)', priceDelta: 0 },
              ],
            },
            {
              id: 'opt-toppings',
              name: 'Topping thêm',
              required: false,
              multiple: true,
              values: [
                { id: 'top-cheese', name: 'Phô mai kéo sợi', priceDelta: 25000 },
                { id: 'top-kimchi', name: 'Thêm đĩa kim chi', priceDelta: 15000 },
              ],
            },
          ],
        }),
      });

      if (
        res.status === 201 &&
        res.data?.data?.name === 'Sườn Bò Mỹ Nướng Sốt Cay Hàn Quốc' &&
        res.data?.data?.options?.length === 2 &&
        res.data?.data?.options[1]?.values?.length === 2
      ) {
        menuItem1Id = res.data.data.id || res.data.data._id;
        pass('Ca 4: Tạo món ăn mới kèm nhóm tùy chọn (Toppings)', `Món ID: ${menuItem1Id}, ${res.data.data.options.length} nhóm options`);
        passed++;
      } else {
        fail('Ca 4: Tạo món ăn mới kèm nhóm tùy chọn (Toppings)', `Status ${res.status}, data: ${JSON.stringify(res.data)}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 4: Tạo món ăn mới kèm nhóm tùy chọn (Toppings)', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 5: Lấy danh sách món ăn có phân trang và bộ lọc (Find All Items with Filter & Pagination)
    // ----------------------------------------------------
    try {
      const res = await request(`/menu-items?categoryId=${category1Id}&isPopular=true&limit=10`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });

      const list = res.data?.data?.items || res.data?.data || [];
      const total = res.data?.data?.total !== undefined ? res.data?.data?.total : list.length;

      if (res.status === 200 && list.length >= 1 && list[0].name.includes('Sườn Bò Mỹ')) {
        pass('Ca 5: Lấy danh sách món ăn có bộ lọc & phân trang', `Tìm thấy ${list.length} món khớp bộ lọc (Tổng: ${total})`);
        passed++;
      } else {
        fail('Ca 5: Lấy danh sách món ăn có bộ lọc & phân trang', `Status ${res.status}, list length: ${list.length}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 5: Lấy danh sách món ăn có bộ lọc & phân trang', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 6: Chỉnh sửa món ăn (Update Menu Item)
    // ----------------------------------------------------
    try {
      const res = await request(`/menu-items/${menuItem1Id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerAToken}` },
        body: JSON.stringify({
          name: 'Sườn Bò Mỹ Nướng Sốt Cay (Đặc Biệt)',
          price: 195000,
          originalPrice: 220000,
        }),
      });

      if (res.status === 200 && res.data?.data?.price === 195000 && res.data?.data?.name.includes('Đặc Biệt')) {
        pass('Ca 6: Chỉnh sửa thông tin món ăn', `Giá mới: ${res.data.data.price} VNĐ`);
        passed++;
      } else {
        fail('Ca 6: Chỉnh sửa thông tin món ăn', `Status ${res.status}, data: ${JSON.stringify(res.data)}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 6: Chỉnh sửa thông tin món ăn', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 7: Thu ngân cập nhật trạng thái Còn món / Hết món (Fast Toggle by Cashier)
    // ----------------------------------------------------
    try {
      // Toggle to Unavailable
      const toggleOff = await request(`/menu-items/${menuItem1Id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ isAvailable: false }),
      });

      // Toggle back to Available
      const toggleOn = await request(`/menu-items/${menuItem1Id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${cashierToken}` },
        body: JSON.stringify({ isAvailable: true }),
      });

      if (
        toggleOff.status === 200 &&
        toggleOff.data?.data?.isAvailable === false &&
        toggleOn.status === 200 &&
        toggleOn.data?.data?.isAvailable === true
      ) {
        pass('Ca 7: Thu ngân thao tác nhanh Còn món / Tạm hết món', 'Đã chuyển thành công isAvailable: false -> true');
        passed++;
      } else {
        fail('Ca 7: Thu ngân thao tác nhanh Còn món / Tạm hết món', `Off: ${toggleOff.status} (${toggleOff.data?.data?.isAvailable}), On: ${toggleOn.status} (${toggleOn.data?.data?.isAvailable})`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 7: Thu ngân thao tác nhanh Còn món / Tạm hết món', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 8: Ràng buộc an toàn: Không cho xóa danh mục khi còn món ăn (Delete Category Constraint)
    // ----------------------------------------------------
    try {
      const res = await request(`/categories/${category1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });

      if (res.status === 400 && res.data?.message?.includes('Không thể xóa danh mục đang có')) {
        pass('Ca 8: Ràng buộc an toàn khi xóa danh mục có món ăn', `Chặn thành công (400 Bad Request): ${res.data.message}`);
        passed++;
      } else {
        fail('Ca 8: Ràng buộc an toàn khi xóa danh mục có món ăn', `Status ${res.status}, response: ${JSON.stringify(res.data)}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 8: Ràng buộc an toàn khi xóa danh mục có món ăn', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 9: Xóa món ăn thành công (Delete Menu Item)
    // ----------------------------------------------------
    try {
      const res = await request(`/menu-items/${menuItem1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });

      if (res.status === 200 && (res.data?.success === true || res.data?.data?.success === true)) {
        pass('Ca 9: Xóa món ăn khỏi thực đơn', res.data.message || res.data?.data?.message || 'Xóa thành công');
        passed++;
      } else {
        fail('Ca 9: Xóa món ăn khỏi thực đơn', `Status ${res.status}, data: ${JSON.stringify(res.data)}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 9: Xóa món ăn khỏi thực đơn', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 10: Xóa danh mục khi không còn món ăn (Delete Empty Category)
    // ----------------------------------------------------
    try {
      const res = await request(`/categories/${category1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });

      if (res.status === 200 && (res.data?.success === true || res.data?.data?.success === true)) {
        pass('Ca 10: Xóa danh mục trống thành công', res.data.message || res.data?.data?.message || 'Xóa thành công');
        passed++;
      } else {
        fail('Ca 10: Xóa danh mục trống thành công', `Status ${res.status}, data: ${JSON.stringify(res.data)}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 10: Xóa danh mục trống thành công', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 11: Phân lập dữ liệu đa người thuê (Multi-Tenant Isolation)
    // ----------------------------------------------------
    try {
      // Owner B attempts to edit or delete Category 2 of Owner A
      const crossCatUpdate = await request(`/categories/${category2Id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerBToken}` },
        body: JSON.stringify({ name: 'Hack Name' }),
      });

      const crossCatDelete = await request(`/categories/${category2Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerBToken}` },
      });

      if (
        (crossCatUpdate.status === 404 || crossCatUpdate.status === 403) &&
        (crossCatDelete.status === 404 || crossCatDelete.status === 403)
      ) {
        pass('Ca 11: Phân lập dữ liệu thực đơn đa người thuê (Multi-Tenant)', `Chặn truy cập chéo giữa Nhà hàng A & B (${crossCatUpdate.status}, ${crossCatDelete.status})`);
        passed++;
      } else {
        fail('Ca 11: Phân lập dữ liệu thực đơn đa người thuê (Multi-Tenant)', `Update: ${crossCatUpdate.status}, Delete: ${crossCatDelete.status}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 11: Phân lập dữ liệu thực đơn đa người thuê (Multi-Tenant)', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 12: Khách hàng quét mã QR xem thực đơn công khai (Public QR Menu Access)
    // ----------------------------------------------------
    try {
      // Client accesses public categories without JWT
      const pubCats = await request(`/categories/public?restaurantId=${restaurantAId}`, {
        method: 'GET',
      });

      // Client accesses public items without JWT
      const pubItems = await request(`/menu-items/public?restaurantId=${restaurantAId}`, {
        method: 'GET',
      });

      const pubCatList = pubCats.data?.data || [];
      const pubItemList = pubItems.data?.data?.items || pubItems.data?.data || [];

      if (pubCats.status === 200 && pubItems.status === 200 && Array.isArray(pubCatList)) {
        pass('Ca 12: Khách quét mã QR xem thực đơn công khai không cần Token', `Categories: ${pubCatList.length}, Items: ${pubItemList.length}`);
        passed++;
      } else {
        fail('Ca 12: Khách quét mã QR xem thực đơn công khai không cần Token', `Cats status: ${pubCats.status}, Items status: ${pubItems.status}`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 12: Khách quét mã QR xem thực đơn công khai không cần Token', e.message);
      failed++;
    }

    // ----------------------------------------------------
    // CA 13: Seed dữ liệu thực đơn mẫu tự động (Seed Default Menu via API)
    // ----------------------------------------------------
    try {
      const seedRes = await request(`/categories/seed-default`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerBToken}` },
      });

      const resCats = await request(`/categories`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${ownerBToken}` },
      });

      const resItems = await request(`/menu-items`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${ownerBToken}` },
      });

      const catsList = resCats.data?.data || [];
      const itemsList = resItems.data?.data?.items || resItems.data?.data || [];

      if ((seedRes.status === 200 || seedRes.status === 201) && catsList.length === 4 && itemsList.length >= 7) {
        pass('Ca 13: Seed thực đơn mẫu chuẩn nhà hàng Việt qua API', `API trả về ${seedRes.status} OK, tạo sẵn 4 danh mục và ${itemsList.length} món ăn kèm toppings`);
        passed++;
      } else {
        fail('Ca 13: Seed thực đơn mẫu chuẩn nhà hàng Việt qua API', `Seed status: ${seedRes.status}, Cats: ${catsList.length} (kỳ vọng 4), Items: ${itemsList.length} (kỳ vọng >=7)`);
        failed++;
      }
    } catch (e: any) {
      fail('Ca 13: Seed thực đơn mẫu chuẩn nhà hàng Việt qua API', e.message);
      failed++;
    }

    console.log(`\n----------------------------------------------------------------`);
    console.log(`Kết quả kiểm thử Phase 4: ${colors.green}${passed} passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} failed${colors.reset}`);
    console.log(`----------------------------------------------------------------\n`);
  } finally {
    console.log(`${colors.cyan}[Teardown] Dọn dẹp tài nguyên kiểm thử Phase 4...${colors.reset}`);
    try {
      if (restaurantAId) {
        await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantAId) });
        await connection.collection('menu_categories').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
        await connection.collection('menu_items').deleteMany({ restaurantId: new Types.ObjectId(restaurantAId) });
      }
      if (restaurantBId) {
        await connection.collection('restaurants').deleteOne({ _id: new Types.ObjectId(restaurantBId) });
        await connection.collection('menu_categories').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
        await connection.collection('menu_items').deleteMany({ restaurantId: new Types.ObjectId(restaurantBId) });
      }
      await connection.collection('users').deleteMany({ email: /^owner\.p4\./i });
      await connection.collection('users').deleteMany({ email: /^cashier\.p4\./i });

      console.log(`  ${colors.green}✔ Đã dọn dẹp sạch sẽ toàn bộ dữ liệu kiểm thử Phase 4 (Zero Garbage)${colors.reset}\n`);
    } catch (cleanErr: any) {
      console.warn('Cảnh báo khi dọn dẹp dữ liệu test:', cleanErr.message);
    }

    await app.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Lỗi khi chạy kiểm thử Phase 4:', err);
  if (app) app.close();
  process.exit(1);
});
