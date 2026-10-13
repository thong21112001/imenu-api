import { spawnSync } from 'child_process';
import path from 'path';

/**
 * iMenu Ecosystem - Master Phase 6 Test Orchestrator
 * Hỗ trợ 2 chế độ:
 *   1. --mode=dev        : Developer Run (270 Backend + 9 SDK; E2E được phép SKIP nếu thiếu server UI)
 *   2. --mode=acceptance : Final Acceptance Run (365 ca test bắt buộc: 270 Backend + 9 SDK + 9 E2E + 77 Phases 2-5)
 */

interface SuiteConfig {
  id: string;
  name: string;
  group: 'phase6_backend' | 'frontend_sdk' | 'browser_e2e' | 'regression_p2_5';
  cmd: string;
  args: string[];
  casesCount: number;
  isMandatoryInDev: boolean;
  isMandatoryInAcceptance: boolean;
  cwd?: string;
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
};

const isAcceptanceMode = process.argv.includes('--mode=acceptance') || process.env.STRICT_ACCEPTANCE === 'true';
const modeName = isAcceptanceMode ? 'FINAL ACCEPTANCE RUN (OFFICIAL CLOSURE GATE)' : 'DEVELOPER TEST RUN';

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  iMenu Ecosystem - Phase 6 Master Test Orchestrator                           ${colors.reset}`);
console.log(`${colors.bold}${colors.yellow}  CHẾ ĐỘ THỰC THI: [${modeName}] ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

const backendDir = path.resolve(__dirname, '../..');
const frontendDir = path.resolve(__dirname, '../../../imenu-menudientu');
const e2eScriptPath = path.resolve(frontendDir, 'scripts/e2e-order-lifecycle.mjs');
const sdkTestPath = path.resolve(frontendDir, 'packages/utils/tests/sdk-contract.test.ts');

const suites: SuiteConfig[] = [
  // ---------------------------------------------------------------------------
  // NHÓM 1: PHASE 6 BACKEND SUITES (7 TỆP - 270 CA TEST)
  // ---------------------------------------------------------------------------
  {
    id: 'P6-01',
    name: 'Sub-phase 6.2: State Machine & Business Invariants',
    group: 'phase6_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-06-order-pos/state-machine.test.ts'],
    casesCount: 56,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P6-02',
    name: 'Sub-phase 6.3: POS Cashier, Taxes, Cash Change & VietQR',
    group: 'phase6_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-06-order-pos/pos-cashier.test.ts'],
    casesCount: 30,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P6-03',
    name: 'Sub-phase 6.4: Customer QR Ordering & Staff Approval',
    group: 'phase6_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-06-order-pos/customer-qr.test.ts'],
    casesCount: 43,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P6-04',
    name: 'Sub-phase 6.5: Idempotency Key & Concurrent Payment Protection',
    group: 'phase6_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-06-order-pos/idempotency-concurrency.test.ts'],
    casesCount: 32,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P6-05',
    name: 'Sub-phase 6.6: Table Sync, Transfer, Merge & Atomic CAS',
    group: 'phase6_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-06-order-pos/table-order-sync.test.ts'],
    casesCount: 38,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P6-06',
    name: 'Sub-phase 6.7: Order Query, Filters, Search & Branch Isolation',
    group: 'phase6_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-06-order-pos/order-query.test.ts'],
    casesCount: 42,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P6-07',
    name: 'Sub-phase 6.8: Frontend Monorepo Integration & Room Auth',
    group: 'phase6_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-06-order-pos/subphase-6-8-integration.test.ts'],
    casesCount: 29,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },

  // ---------------------------------------------------------------------------
  // NHÓM 2: FRONTEND SDK CONTRACT SUITE (1 TỆP - 9 CA TEST)
  // ---------------------------------------------------------------------------
  {
    id: 'SDK-01_07',
    name: 'Frontend SDK Contract & Route Verification',
    group: 'frontend_sdk',
    cmd: 'npx',
    args: ['ts-node', sdkTestPath],
    casesCount: 9,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: frontendDir,
  },

  // ---------------------------------------------------------------------------
  // NHÓM 3: BROWSER E2E CROSS-APP SUITE (1 KỊCH BẢN - 9 CHECKPOINTS)
  // ---------------------------------------------------------------------------
  {
    id: 'E2E-01_09',
    name: 'Browser E2E Cross-App Validation (Customer QR <-> POS Lifecycle)',
    group: 'browser_e2e',
    cmd: 'node',
    args: [e2eScriptPath],
    casesCount: 9,
    isMandatoryInDev: false, // In dev mode: may skip if UI servers are down
    isMandatoryInAcceptance: true, // In acceptance mode: STRICTLY MANDATORY!
    cwd: frontendDir,
  },

  // ---------------------------------------------------------------------------
  // NHÓM 4: REGRESSION PHASES 2–5 SUITES (5 TỆP - 77 CA TEST)
  // ---------------------------------------------------------------------------
  {
    id: 'REG-P2-A',
    name: 'Phase 2 Part 1: Auth, Restaurant & Branch CRUD',
    group: 'regression_p2_5',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-02-auth-restaurant/test.ts'],
    casesCount: 12,
    isMandatoryInDev: false,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'REG-P2-B',
    name: 'Phase 2 Part 2: Multi-Branch Lifecycle & Isolation',
    group: 'regression_p2_5',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-02-auth-restaurant/test-multi-branch.ts'],
    casesCount: 12,
    isMandatoryInDev: false,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'REG-P3',
    name: 'Phase 3: Staff Management, RBAC & Cross-Tenant Security',
    group: 'regression_p2_5',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-03-staff-rbac/test.ts'],
    casesCount: 16,
    isMandatoryInDev: false,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'REG-P4',
    name: 'Phase 4: Menu Categories, Dishes & Option Groups',
    group: 'regression_p2_5',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-04-menu/test.ts'],
    casesCount: 17,
    isMandatoryInDev: false,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'REG-P5',
    name: 'Phase 5: Table Management, Zones & Realtime KDS WebSocket',
    group: 'regression_p2_5',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-05-order-table-kds/test.ts'],
    casesCount: 20,
    isMandatoryInDev: false,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
];

interface ExecutionResult {
  suite: SuiteConfig;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'BLOCKED';
  durationMs: number;
  reason?: string;
}

const results: ExecutionResult[] = [];

async function runMaster() {
  const overallStartTime = Date.now();

  for (const suite of suites) {
    // Trong Dev mode: bỏ qua các suite regression Phase 2-5
    if (!isAcceptanceMode && suite.group === 'regression_p2_5') {
      continue;
    }

    // Xử lý riêng cho Browser E2E Suite
    if (suite.group === 'browser_e2e') {
      console.log(`\n${colors.bold}[KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT BROWSER E2E]${colors.reset}`);
      const prereqCheck = spawnSync('node', [e2eScriptPath, '--prereq-check'], {
        cwd: frontendDir,
        encoding: 'utf8',
        shell: true,
      });

      const isPrereqOk = prereqCheck.status === 0;

      if (!isPrereqOk) {
        if (!isAcceptanceMode) {
          // Dev mode: SKIP có giải trình
          console.log(`  ${colors.yellow}⚠️ [SKIP] Browser E2E Suite bị bỏ qua:${colors.reset}`);
          console.log(`     Lý do: Các máy chủ giao diện (ports 3001, 3003, 3005) hoặc Chrome chưa sẵn sàng.`);
          console.log(`     Để chạy E2E, khởi động dev servers và thực thi: ${colors.cyan}npm run test:phase6:e2e${colors.reset}`);
          results.push({
            suite,
            status: 'SKIP',
            durationMs: 0,
            reason: 'Dev servers not listening on ports 3001/3003/3005',
          });
          continue;
        } else {
          // Acceptance mode: BLOCKED nghiêm ngặt, không cho phép SKIP!
          console.error(`  ${colors.red}❌ [BLOCKED] Final Acceptance Run bắt buộc Browser E2E nhưng các server chưa sẵn sàng!${colors.reset}`);
          console.error(`     Yêu cầu khởi động API (port 3001), Admin (port 3003) và Customer Menu (port 3005) trước khi nghiệm thu.`);
          results.push({
            suite,
            status: 'BLOCKED',
            durationMs: 0,
            reason: 'Mandatory E2E servers down during acceptance run',
          });
          break; // Dừng ngay lập tức
        }
      }
    }

    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`[CHẠY SUITE ${suite.id}]: ${suite.name} (${suite.casesCount} ca test)`);
    console.log(`--------------------------------------------------------------------------------`);

    const start = Date.now();
    const child = spawnSync(suite.cmd, suite.args, {
      cwd: suite.cwd || backendDir,
      stdio: 'inherit',
      env: { ...process.env },
      shell: true,
    });
    const duration = Date.now() - start;

    if (child.status === 0) {
      results.push({ suite, status: 'PASS', durationMs: duration });
    } else {
      results.push({
        suite,
        status: 'FAIL',
        durationMs: duration,
        reason: `Process exited with code ${child.status}`,
      });

      console.error(`\n${colors.red}❌ SUITE ${suite.id} THẤT BẠI (Exit code ${child.status}). Dừng tiến trình điều phối.${colors.reset}`);
      break; // Fail-fast: dừng ngay lập tức khi gặp lỗi
    }
  }

  // ---------------------------------------------------------------------------
  // TỔNG KẾT VÀ BÁO CÁO KIỂM TOÁN
  // ---------------------------------------------------------------------------
  const totalDurationSec = ((Date.now() - overallStartTime) / 1000).toFixed(2);

  console.log(`\n\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}                   BẢNG TỔNG KẾT ĐIỀU PHỐI KIỂM THỬ PHASE 6                     ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`Chế độ: ${colors.bold}${modeName}${colors.reset} | Thời gian thực thi: ${totalDurationSec}s\n`);

  console.log(
    'Mã Suite'.padEnd(12) +
    'Tên Phân Hệ Kiểm Thử'.padEnd(46) +
    'Số Ca'.padEnd(8) +
    'Kết Quả'.padEnd(12) +
    'Thời Gian'
  );
  console.log('-'.repeat(88));

  let totalRegisteredCases = 0;
  let totalPassedCases = 0;
  let totalFailedCases = 0;
  let totalSkippedCases = 0;
  let totalBlockedCases = 0;

  for (const r of results) {
    totalRegisteredCases += r.suite.casesCount;
    let statusColored: string = r.status;
    if (r.status === 'PASS') {
      statusColored = `${colors.green}✔ PASS${colors.reset}`;
      totalPassedCases += r.suite.casesCount;
    } else if (r.status === 'FAIL') {
      statusColored = `${colors.red}✖ FAIL${colors.reset}`;
      totalFailedCases += r.suite.casesCount;
    } else if (r.status === 'SKIP') {
      statusColored = `${colors.yellow}⚠ SKIP${colors.reset}`;
      totalSkippedCases += r.suite.casesCount;
    } else if (r.status === 'BLOCKED') {
      statusColored = `${colors.magenta}⛔ BLOCKED${colors.reset}`;
      totalBlockedCases += r.suite.casesCount;
    }

    const durationStr = `${(r.durationMs / 1000).toFixed(1)}s`;
    console.log(
      r.suite.id.padEnd(12) +
      r.suite.name.slice(0, 44).padEnd(46) +
      String(r.suite.casesCount).padEnd(8) +
      statusColored.padEnd(20) +
      durationStr
    );
  }

  console.log('-'.repeat(88));
  console.log(`Tổng số ca đăng ký trong lượt chạy: ${totalRegisteredCases}`);
  console.log(`  - Đạt (Passed) : ${colors.green}${totalPassedCases}${colors.reset}`);
  console.log(`  - Hỏng (Failed): ${totalFailedCases > 0 ? colors.red : colors.green}${totalFailedCases}${colors.reset}`);
  console.log(`  - Bỏ qua (Skip): ${totalSkippedCases > 0 ? colors.yellow : colors.green}${totalSkippedCases}${colors.reset}`);
  console.log(`  - Bị chặn (Blk): ${totalBlockedCases > 0 ? colors.magenta : colors.green}${totalBlockedCases}${colors.reset}`);

  // Đánh giá cổng chuyển tiếp
  const hasFailures = totalFailedCases > 0;
  const hasBlocks = totalBlockedCases > 0;
  const hasSkips = totalSkippedCases > 0;

  if (isAcceptanceMode) {
    const isFullAcceptancePassed =
      !hasFailures && !hasBlocks && !hasSkips && totalPassedCases === 365;

    if (isFullAcceptancePassed) {
      console.log(`\n${colors.bold}${colors.green}🎉 KẾT LUẬN: FINAL ACCEPTANCE RUN THÀNH CÔNG RỰC RỠ! (365/365 PASS 100%)${colors.reset}`);
      console.log(`${colors.green}   ĐỦ ĐIỀU KIỆN CHẤP THUẬN NGHIỆM THU ĐÓNG CHÍNH THỨC TOÀN BỘ PHASE 6!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.error(`\n${colors.bold}${colors.red}❌ KẾT LUẬN: FINAL ACCEPTANCE RUN CHƯA ĐẠT CHỈ TIÊU NGHIỆM THU ĐÓNG PHASE!${colors.reset}`);
      console.error(`   Yêu cầu bắt buộc: 365/365 PASS, 0 FAIL, 0 SKIP, 0 BLOCKED.`);
      console.error(`   Thực tế: ${totalPassedCases} Passed, ${totalFailedCases} Failed, ${totalSkippedCases} Skipped, ${totalBlockedCases} Blocked.\n`);
      process.exit(1);
    }
  } else {
    // Developer Run: Cho phép skip E2E nếu servers chưa bật
    const isDevPassed = !hasFailures && !hasBlocks && totalPassedCases >= 279;
    if (isDevPassed) {
      console.log(`\n${colors.bold}${colors.green}✔ KẾT LUẬN: DEVELOPER TEST RUN HOÀN TẤT THÀNH CÔNG (${totalPassedCases} CA BẮT BUỘC PASS)!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.error(`\n${colors.bold}${colors.red}❌ KẾT LUẬN: DEVELOPER TEST RUN CÓ LỖI XẢY RA!${colors.reset}\n`);
      process.exit(1);
    }
  }
}

runMaster();
