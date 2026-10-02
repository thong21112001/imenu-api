import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RolesService } from '../modules/roles/roles.service';
import { UsersService } from '../modules/users/users.service';
import { AuthService } from '../modules/auth/auth.service';
import { RestaurantsService } from '../modules/restaurants/restaurants.service';
import { CategoriesService } from '../modules/menu/categories.service';
import { TablesService } from '../modules/tables/tables.service';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
  gray: '\x1b[90m',
};

async function runSeeder() {
  const isClean = process.argv.includes('--clean');
  const startTime = Date.now();

  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}         iMenu Database Seeder (Standalone CLI)     ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  if (isClean) {
    console.log(`${colors.yellow}⚠️  Chế độ --clean: Dọn dẹp dữ liệu demo cũ trước khi seed lại.${colors.reset}\n`);
  }

  // Khởi tạo NestJS Application Context (không mở HTTP port)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const rolesService = app.get(RolesService);
    const usersService = app.get(UsersService);
    const authService = app.get(AuthService);
    const restaurantsService = app.get(RestaurantsService);
    const categoriesService = app.get(CategoriesService);
    const tablesService = app.get(TablesService);

    if (isClean) {
      console.log(`${colors.gray}[Clean] Đang dọn dẹp dữ liệu demo...${colors.reset}`);
      const userModel = (usersService as any).userModel;
      const restModel = (restaurantsService as any).restaurantModel;

      await userModel.deleteMany({
        email: {
          $in: [
            'owner@sample.vn',
            'manager@sample.vn',
            'cashier@sample.vn',
            'kitchen@sample.vn',
            'waiter@sample.vn',
          ],
        },
      });
      await restModel.deleteOne({ slug: 'bep-nha' });
      console.log(`  ✔ Đã dọn sạch 5 tài khoản demo (owner, manager, cashier, kitchen, waiter) và nhà hàng bep-nha`);
    }

    // 1. Seed Roles hệ thống
    console.log(`\n${colors.bold}1. Khởi tạo vai trò hệ thống (Default Roles)...${colors.reset}`);
    await rolesService.seedDefaultRoles();
    console.log(`  ✔ ${colors.green}6 vai trò hệ thống đã sẵn sàng${colors.reset}`);

    // 2. Seed Super Admin
    console.log(`\n${colors.bold}2. Khởi tạo Quản trị viên tối cao (Super Admin)...${colors.reset}`);
    await usersService.initAdmin();
    console.log(`  ✔ ${colors.green}Tài khoản admin@imenu.vn đã sẵn sàng${colors.reset}`);

    // 3. Seed Demo Restaurant & Owner
    console.log(`\n${colors.bold}3. Khởi tạo Nhà hàng & Chủ quán trải nghiệm (Demo Owner)...${colors.reset}`);
    await authService.seedDemoOwner();
    console.log(`  ✔ ${colors.green}Nhà hàng "Bếp Nhà" & owner@sample.vn đã sẵn sàng${colors.reset}`);

    // 4. Seed Demo Menu & Tables
    const bepNha = await restaurantsService.findBySlug('bep-nha').catch(() => null);
    if (bepNha) {
      const bepNhaId = (bepNha as any)._id.toString();
      console.log(`\n${colors.bold}4. Khởi tạo Thực đơn & Sơ đồ bàn cho Nhà hàng Bếp Nhà...${colors.reset}`);
      await categoriesService.seedDefaultMenu(bepNhaId);
      console.log(`  ✔ ${colors.green}Thực đơn: Đã khởi tạo 4 danh mục và các món ăn mẫu${colors.reset}`);
      const tableRes = await tablesService.seedDefaultTables(bepNhaId);
      console.log(`  ✔ ${colors.green}Sơ đồ bàn: ${tableRes.zones} khu vực, ${tableRes.tables} bàn ăn${colors.reset}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bold}${colors.green}====================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.green}  ✔ Hoàn tất quá trình Seed dữ liệu trong ${duration}s!${colors.reset}`);
    console.log(`${colors.bold}${colors.green}====================================================${colors.reset}\n`);
  } catch (error: any) {
    console.error(`\n❌ Lỗi khi thực hiện seed:`, error.message || error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

runSeeder();
