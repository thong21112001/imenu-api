import 'dotenv/config';
import * as dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://127.0.0.1:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { McpRegistryService } from '../../src/modules/ai-mcp/mcp-registry.service';
import { getTestNumberSecret } from '../shared/test-credentials.helper';

const TEST_PORT = 3181;
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

export async function runMcpRegistryAndToolsTests(): Promise<{ passed: boolean; count: number; failures: number }> {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 18 Sub-phase 18.1: MCP Core & 4 Read-Only Platform Tools (Port ${TEST_PORT}) ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let count = 0;
  let failures = 0;

  try {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.listen(TEST_PORT);

    const connection = app.get<Connection>(getConnectionToken());
    const db = connection.db!;
    const registry = app.get(McpRegistryService);

    // Dọn dẹp dữ liệu kiểm thử test-p18
    await db.collection('restaurants').deleteMany({ slug: { $regex: /^test-p18-/ } });
    await db.collection('users').deleteMany({ email: { $regex: /@test-p18\.vn$/ } });
    await db.collection('orders').deleteMany({ orderCode: { $regex: /^ORD-P18-/ } });
    await db.collection('commission_ledgers').deleteMany({ ledgerCode: { $regex: /^LED-P18-/ } });
    await db.collection('reviews').deleteMany({ orderCode: { $regex: /^ORD-P18-/ } });

    // Khởi tạo các vai trò mẫu
    let superAdminRole = await db.collection('roles').findOne({ slug: 'system_admin' });
    if (!superAdminRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'System Admin',
        slug: 'system_admin',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      superAdminRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    let ownerRole = await db.collection('roles').findOne({ slug: 'restaurant_admin' });
    if (!ownerRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'Restaurant Admin',
        slug: 'restaurant_admin',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      ownerRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    let cashierRole = await db.collection('roles').findOne({ slug: 'cashier' });
    if (!cashierRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'Cashier Staff',
        slug: 'cashier',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      cashierRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    let salesRole = await db.collection('roles').findOne({ slug: 'sales_rep' });
    if (!salesRole) {
      const resRole = await db.collection('roles').insertOne({
        name: 'Sales Rep',
        slug: 'sales_rep',
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      salesRole = await db.collection('roles').findOne({ _id: resRole.insertedId });
    }

    const testPassword = getTestNumberSecret();
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Khởi tạo Nhà hàng kiểm thử
    const restRes = await db.collection('restaurants').insertOne({
      name: 'Nhà Hàng P18 MCP Test',
      slug: 'test-p18-mcp-restaurant',
      status: 'ACTIVE',
      phone: '0908888888',
      plan: 'Pro',
      subscriptionStatus: 'ACTIVE_PAID',
      planExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Sắp hết hạn sau 3 ngày
      branches: [
        {
          _id: new Types.ObjectId(),
          name: 'Chi Nhánh 1',
          slug: 'chi-nhanh-1',
          isMainBranch: true,
          status: 'ACTIVE',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const testRestId = restRes.insertedId;

    // 1. Tạo SuperAdmin User
    const superAdminId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: superAdminId,
      fullName: 'Super Admin P18 Guard',
      email: 'superadmin@test-p18.vn',
      password: hashedPassword,
      role: superAdminRole!._id,
      isSuperAdmin: true,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Tạo Merchant (Restaurant Owner) User
    const merchantId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: merchantId,
      fullName: 'Chủ Nhà Hàng P18',
      email: 'merchant@test-p18.vn',
      password: hashedPassword,
      role: ownerRole!._id,
      restaurantId: testRestId,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Tạo Staff (Cashier) User
    const staffId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: staffId,
      fullName: 'Thu Ngân P18',
      email: 'staff@test-p18.vn',
      password: hashedPassword,
      role: cashierRole!._id,
      restaurantId: testRestId,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 4. Tạo Sales Rep User
    const salesRepId = new Types.ObjectId();
    await db.collection('users').insertOne({
      _id: salesRepId,
      fullName: 'Sales Rep P18',
      email: 'sales@test-p18.vn',
      password: hashedPassword,
      role: salesRole!._id,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Lấy Token đăng nhập
    async function getToken(email: string): Promise<string> {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: testPassword }),
      });
      return res.data?.data?.accessToken || res.data?.accessToken;
    }

    const superAdminToken = await getToken('superadmin@test-p18.vn');
    const merchantToken = await getToken('merchant@test-p18.vn');
    const staffToken = await getToken('staff@test-p18.vn');

    // ---------------------------------------------------------------------------
    // TEST 1: Đăng ký đúng 4 Platform MCP Tools với scope: 'PLATFORM' & isReadOnly: true
    // ---------------------------------------------------------------------------
    count++;
    try {
      const tools = registry.getTools('PLATFORM');
      const toolNames = tools.map((t) => t.name);

      const expectedNames = [
        'get_platform_revenue_overview',
        'detect_restaurant_churn_risk',
        'diagnose_underperforming_restaurants',
        'audit_sales_commissions_anomalies',
      ];

      const hasAllTools = expectedNames.every((name) => toolNames.includes(name));
      const allPlatform = tools.every((t) => t.scope === 'PLATFORM');
      const allReadOnly = tools.every((t) => t.isReadOnly === true);
      const allHaveSchema = tools.every((t) => t.inputSchema?.type === 'object');

      if (tools.length === 4 && hasAllTools && allPlatform && allReadOnly && allHaveSchema) {
        pass(
          'TEST 1: Đăng ký thành công chuẩn xác 4 MCP Tools (scope: PLATFORM, isReadOnly: true, inputSchema chuẩn JSON Schema)',
          `Tổng tools: ${tools.length}`,
        );
      } else {
        failures++;
        fail('TEST 1: Danh sách tools không đúng quy cách', {
          count: tools.length,
          toolNames,
          allPlatform,
          allReadOnly,
        });
      }
    } catch (err: any) {
      failures++;
      fail('TEST 1: Lỗi khi kiểm tra Registry tools', err);
    }

    // ---------------------------------------------------------------------------
    // TEST 2: Tool 1 - get_platform_revenue_overview (GMV, Subscription, Top Restaurants, Tinh gọn JSON)
    // ---------------------------------------------------------------------------
    count++;
    try {
      // Seed đơn hàng mẫu
      await db.collection('orders').insertOne({
        orderCode: 'ORD-P18-001',
        restaurantId: testRestId,
        branchId: 'b1',
        tableName: 'Bàn 01',
        status: 'Paid',
        isPaid: true,
        totalAmount: 500000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request('/platform/mcp/execute', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({
          tool: 'get_platform_revenue_overview',
          arguments: { limit: 5 },
        }),
      });

      const data = res.data;
      const isSuccess = res.status === 200 && data.success === true;
      const hasSummary = Boolean(data.data?.summary?.totalGmvRevenue !== undefined);
      const hasTop = Array.isArray(data.data?.topRevenueRestaurants);
      const isLean = !data.data?._doc && !data.data?.$__; // Chống tràn bộ nhớ

      if (isSuccess && hasSummary && hasTop && isLean) {
        pass(
          'TEST 2: get_platform_revenue_overview tổng hợp GMV, SaaS và Top nhà hàng thành công với JSON tinh gọn',
          `GMV: ${data.data.summary.totalGmvRevenue.toLocaleString()} VNĐ`,
        );
      } else {
        failures++;
        fail('TEST 2: get_platform_revenue_overview trả về kết quả không hợp lệ', data);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 2: Lỗi khi thực thi get_platform_revenue_overview', err);
    }

    // ---------------------------------------------------------------------------
    // TEST 3: Tool 2 - detect_restaurant_churn_risk (Quét sụt giảm đơn >40% & hạn gói cước)
    // ---------------------------------------------------------------------------
    count++;
    try {
      const res = await request('/platform/mcp/execute', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({
          tool: 'detect_restaurant_churn_risk',
          arguments: { dropThresholdPercent: 40, daysExpiringThreshold: 7 },
        }),
      });

      const data = res.data;
      const isSuccess = res.status === 200 && data.success === true;
      const hasAtRisk = Array.isArray(data.data?.atRiskRestaurants);
      // Nhà hàng test-p18 có gói cước hết hạn sau 3 ngày -> phải xuất hiện trong cảnh báo
      const flaggedTestRest = data.data?.atRiskRestaurants?.find(
        (r: any) => r.restaurantId === testRestId.toString(),
      );

      if (isSuccess && hasAtRisk && flaggedTestRest && flaggedTestRest.actionLink.includes('/platform/restaurants')) {
        pass(
          'TEST 3: detect_restaurant_churn_risk phát hiện nhà hàng rủi ro rời bỏ kèm link điều hướng /platform/restaurants',
          `Risk level: ${flaggedTestRest.riskLevel} | Lý do: ${flaggedTestRest.reasons[0]}`,
        );
      } else {
        failures++;
        fail('TEST 3: detect_restaurant_churn_risk không phát hiện nhà hàng rủi ro theo tiêu chí', data);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 3: Lỗi khi thực thi detect_restaurant_churn_risk', err);
    }

    // ---------------------------------------------------------------------------
    // TEST 4: Tool 3 - diagnose_underperforming_restaurants (Phân tích hủy món & đánh giá 1-2 sao)
    // ---------------------------------------------------------------------------
    count++;
    try {
      // Seed đơn hàng hủy món & đánh giá 1 sao
      const cancelledOrderCode = 'ORD-P18-002';
      await db.collection('orders').insertOne({
        orderCode: cancelledOrderCode,
        restaurantId: testRestId,
        branchId: 'b1',
        tableName: 'Bàn 02',
        status: 'Cancelled',
        isPaid: false,
        totalAmount: 250000,
        items: [
          {
            name: 'Lẩu Thái Hải Sản',
            price: 250000,
            quantity: 1,
            status: 'Cancelled',
            cancelReason: 'Khách đợi quá lâu',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.collection('reviews').insertOne({
        orderCode: cancelledOrderCode,
        restaurantId: testRestId,
        branchId: 'b1',
        overallRating: 1,
        comment: 'Món lên quá lâu, phục vụ chậm chạp',
        quickTags: ['Món lên chậm', 'Phục vụ kém'],
        isHidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request('/platform/mcp/execute', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({
          tool: 'diagnose_underperforming_restaurants',
          arguments: { restaurantId: testRestId.toString(), cancellationThresholdPercent: 10 },
        }),
      });

      const data = res.data;
      const isSuccess = res.status === 200 && data.success === true;
      const diag = data.data?.diagnostics?.[0];
      const hasIssues = Array.isArray(diag?.detectedIssues) && diag.detectedIssues.length > 0;
      const hasRecommendations = Array.isArray(diag?.recommendedActions) && diag.recommendedActions.length > 0;

      if (isSuccess && diag && hasIssues && hasRecommendations) {
        pass(
          'TEST 4: diagnose_underperforming_restaurants phân tích thành công tỷ lệ hủy món KDS và đánh giá CSAT tiêu cực',
          `Sức khỏe vận hành: ${diag.operationalHealth} | Vấn đề: ${diag.detectedIssues[0]}`,
        );
      } else {
        failures++;
        fail('TEST 4: diagnose_underperforming_restaurants trả về chẩn đoán không chính xác', data);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 4: Lỗi khi thực thi diagnose_underperforming_restaurants', err);
    }

    // ---------------------------------------------------------------------------
    // TEST 5: Tool 4 - audit_sales_commissions_anomalies (Phát hiện Sales Rep & Nhà hàng không có đơn thật)
    // ---------------------------------------------------------------------------
    count++;
    try {
      // Tạo 1 nhà hàng ma không có đơn hàng nào
      const ghostRest = await db.collection('restaurants').insertOne({
        name: 'Nhà Hàng Ma P18 (0 Đơn)',
        slug: 'test-p18-ghost-restaurant',
        status: 'ACTIVE',
        subscriptionStatus: 'ACTIVE_PAID',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Tạo bản kê hoa hồng cho nhà hàng ma
      await db.collection('commission_ledgers').insertOne({
        ledgerCode: 'LED-P18-GHOST-01',
        salesId: salesRepId,
        restaurantId: ghostRest.insertedId,
        commissionType: 'SETUP_COMMISSION',
        baseAmount: 10000000,
        commissionAmount: 1500000,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request('/platform/mcp/execute', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({
          tool: 'audit_sales_commissions_anomalies',
          arguments: { status: 'ALL' },
        }),
      });

      const data = res.data;
      const isSuccess = res.status === 200 && data.success === true;
      const anomalies = data.data?.anomalies || [];
      const ghostAnomaly = anomalies.find((a: any) => a.anomalyType === 'ZERO_GMV_REFERRED_RESTAURANT');

      if (isSuccess && ghostAnomaly && data.data.totalAmountAtRisk >= 1500000) {
        pass(
          'TEST 5: audit_sales_commissions_anomalies phát hiện dấu hiệu bất thường nhà hàng ma (0 đơn, 0 GMV)',
          `Số tiền rủi ro: ${ghostAnomaly.commissionAmount.toLocaleString()} VNĐ | Sales Rep: ${ghostAnomaly.salesRep.fullName}`,
        );
      } else {
        failures++;
        fail('TEST 5: audit_sales_commissions_anomalies không phát hiện được bất thường nhà hàng ma', data);
      }
    } catch (err: any) {
      failures++;
      fail('TEST 5: Lỗi khi thực thi audit_sales_commissions_anomalies', err);
    }

    // ---------------------------------------------------------------------------
    // TEST 6: Phân quyền & Khóa bảo mật (403 Forbidden cho Merchant & Staff, 401 cho Unauthenticated)
    // ---------------------------------------------------------------------------
    count++;
    try {
      // 6.1 Không truyền token -> 401 Unauthorized
      const noAuthRes = await request('/platform/mcp/tools');
      const is401 = noAuthRes.status === 401;

      // 6.2 Dùng token Merchant -> 403 Forbidden
      const merchantListRes = await request('/platform/mcp/tools', {
        headers: { Authorization: `Bearer ${merchantToken}` },
      });
      const merchantExecRes = await request('/platform/mcp/execute', {
        method: 'POST',
        headers: { Authorization: `Bearer ${merchantToken}` },
        body: JSON.stringify({ tool: 'get_platform_revenue_overview' }),
      });
      const isMerchantBlocked = merchantListRes.status === 403 && merchantExecRes.status === 403;

      // 6.3 Dùng token Staff -> 403 Forbidden
      const staffListRes = await request('/platform/mcp/tools', {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const staffExecRes = await request('/platform/mcp/execute', {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ tool: 'get_platform_revenue_overview' }),
      });
      const isStaffBlocked = staffListRes.status === 403 && staffExecRes.status === 403;

      // 6.4 Dùng token SuperAdmin -> 200 OK
      const superAdminListRes = await request('/platform/mcp/tools', {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      const isSuperAdminAllowed = superAdminListRes.status === 200;

      if (is401 && isMerchantBlocked && isStaffBlocked && isSuperAdminAllowed) {
        pass(
          'TEST 6: Bảo mật & Phân quyền hoàn hảo (Chặn 401/403 cho Merchant & Staff, cấp quyền Superadmin)',
          '401 Unauth, 403 Merchant, 403 Staff, 200 Superadmin',
        );
      } else {
        failures++;
        fail('TEST 6: Kiểm tra bảo mật & phân quyền thất bại', {
          is401,
          isMerchantBlocked,
          isStaffBlocked,
          isSuperAdminAllowed,
        });
      }
    } catch (err: any) {
      failures++;
      fail('TEST 6: Lỗi khi kiểm tra phân quyền RBAC', err);
    }

    // ---------------------------------------------------------------------------
    // TEST 7: Khóa cứng Registry (Chặn công cụ không tồn tại hoặc sai scope/isReadOnly)
    // ---------------------------------------------------------------------------
    count++;
    try {
      // 7.1 Tool không tồn tại -> 404 Not Found
      const notFoundRes = await request('/platform/mcp/execute', {
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: JSON.stringify({ tool: 'unknown_fictional_tool' }),
      });
      const is404 = notFoundRes.status === 404;

      // 7.2 Đăng ký tool có scope !== 'PLATFORM' vào registry và kiểm tra chặn khi gọi trực tiếp
      let isScopeBlocked = false;
      try {
        registry.registerTool({
          name: 'test_restaurant_scoped_tool',
          description: 'Công cụ phạm vi nhà hàng',
          scope: 'RESTAURANT',
          isReadOnly: true,
          inputSchema: { type: 'object' },
          handler: async () => ({ test: true }),
        });
        await registry.executeTool('test_restaurant_scoped_tool', {});
      } catch (e: any) {
        if (e?.status === 403 || e?.message?.includes('PLATFORM')) {
          isScopeBlocked = true;
        }
      }

      // 7.3 Kiểm tra getTools('PLATFORM') không chứa tool có scope: 'RESTAURANT'
      const platformTools = registry.getTools('PLATFORM');
      const doesNotLeak = !platformTools.some((t) => t.name === 'test_restaurant_scoped_tool');

      if (is404 && isScopeBlocked && doesNotLeak) {
        pass(
          'TEST 7: Khóa cứng MCP Registry (404 khi tool không tồn tại, từ chối scope ngoài PLATFORM ở Phase 18)',
        );
      } else {
        failures++;
        fail('TEST 7: Khóa cứng Registry kiểm tra thất bại', {
          is404,
          isScopeBlocked,
          doesNotLeak,
        });
      }
    } catch (err: any) {
      failures++;
      fail('TEST 7: Lỗi khi kiểm tra khóa cứng Registry', err);
    }

    // Dọn dẹp dữ liệu kiểm thử
    await db.collection('restaurants').deleteMany({ slug: { $regex: /^test-p18-/ } });
    await db.collection('users').deleteMany({ email: { $regex: /@test-p18\.vn$/ } });
    await db.collection('orders').deleteMany({ orderCode: { $regex: /^ORD-P18-/ } });
    await db.collection('commission_ledgers').deleteMany({ ledgerCode: { $regex: /^LED-P18-/ } });
    await db.collection('reviews').deleteMany({ orderCode: { $regex: /^ORD-P18-/ } });
  } catch (err: any) {
    failures++;
    fail('Khởi động test suite gặp sự cố nghiêm trọng', err);
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n  MCP Registry & Tools Summary: ${count - failures}/${count} tests passed\n`);
  return { passed: failures === 0, count, failures };
}

if (require.main === module) {
  runMcpRegistryAndToolsTests().then((res) => {
    if (!res.passed) {
      process.exit(1);
    }
  });
}

