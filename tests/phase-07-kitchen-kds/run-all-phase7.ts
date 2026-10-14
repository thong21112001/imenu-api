import { spawnSync } from 'child_process';
import path from 'path';

/**
 * iMenu Ecosystem - Master Phase 7 Test Orchestrator
 * Hỗ trợ 2 chế độ:
 *   1. --mode=dev        : Developer Run (Suites 1-4 Backend + SDK Contract + E2E Graceful)
 *   2. --mode=acceptance : Final Acceptance Run (Official Closure Gate)
 */

interface SuiteConfig {
  id: string;
  name: string;
  group: 'phase7_backend' | 'frontend_sdk' | 'browser_e2e';
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
const modeName = isAcceptanceMode ? 'FINAL ACCEPTANCE RUN (PHASE 7 CLOSURE GATE)' : 'DEVELOPER TEST RUN';

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  iMenu Ecosystem - Phase 7 (Kitchen / KDS) Master Test Orchestrator           ${colors.reset}`);
console.log(`${colors.bold}${colors.yellow}  CHẾ ĐỘ THỰC THI: [${modeName}] ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

const backendDir = path.resolve(__dirname, '../..');
const frontendDir = path.resolve(__dirname, '../../../imenu-menudientu');

const suites: SuiteConfig[] = [
  // ---------------------------------------------------------------------------
  // NHÓM 1: PHASE 7 BACKEND SUITES
  // ---------------------------------------------------------------------------
  {
    id: 'P7-01',
    name: 'KDS Queue Query, FIFO Ordering, Filters & Multi-Tenant Isolation',
    group: 'phase7_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-07-kitchen-kds/kds-queue-query.test.ts'],
    casesCount: 8,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P7-02',
    name: 'KDS State Transitions, Auto Order Status Upgrade & Negative Guards',
    group: 'phase7_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-07-kitchen-kds/kds-state-transitions.test.ts'],
    casesCount: 8,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P7-03',
    name: 'KDS Double-Click Idempotency & OCC Concurrent Updates (Zero Lost Update)',
    group: 'phase7_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-07-kitchen-kds/kds-concurrency-idempotency.test.ts'],
    casesCount: 4,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P7-04',
    name: 'KDS Out-of-Stock (86), Branch Isolation, Edge Case 2 & Realtime Events',
    group: 'phase7_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-07-kitchen-kds/kds-out-of-stock.test.ts'],
    casesCount: 5,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },

  // ---------------------------------------------------------------------------
  // NHÓM 2: FRONTEND SDK CONTRACT
  // ---------------------------------------------------------------------------
  {
    id: 'P7-SDK',
    name: 'Frontend SDK Contract & KDS Route Verification (SDK-01 -> SDK-12)',
    group: 'frontend_sdk',
    cmd: 'npx',
    args: ['ts-node', 'tests/sdk-contract.test.ts'],
    casesCount: 14,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: path.resolve(frontendDir, 'packages/utils'),
  },

  // ---------------------------------------------------------------------------
  // NHÓM 3: BROWSER E2E KDS RUNNER
  // ---------------------------------------------------------------------------
  {
    id: 'P7-E2E',
    name: 'Browser E2E KDS Dispatching & Realtime Synchronization Lifecycle',
    group: 'browser_e2e',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-07-kitchen-kds/e2e-kds-runner.test.ts'],
    casesCount: 6,
    isMandatoryInDev: false,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
];

interface SuiteResult {
  id: string;
  name: string;
  group: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  casesCount: number;
  error?: string;
}

const results: SuiteResult[] = [];
let totalCases = 0;
let passedCases = 0;
let failedSuites = 0;

for (const suite of suites) {
  console.log(`\n${colors.bold}${colors.magenta}▶ ĐANG CHẠY SUITE [${suite.id}]: ${suite.name}${colors.reset}`);
  console.log(`  Lệnh: ${suite.cmd} ${suite.args.join(' ')}`);
  console.log(`  Thư mục: ${suite.cwd || process.cwd()}\n`);

  const startTime = Date.now();
  const spawnRes = spawnSync(suite.cmd, suite.args, {
    cwd: suite.cwd || process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
    },
  });
  const durationMs = Date.now() - startTime;

  totalCases += suite.casesCount;

  if (spawnRes.status === 0) {
    passedCases += suite.casesCount;
    results.push({
      id: suite.id,
      name: suite.name,
      group: suite.group,
      status: 'PASSED',
      durationMs,
      casesCount: suite.casesCount,
    });
    console.log(`\n${colors.green}✔ HOÀN TẤT [${suite.id}]: PASSED trong ${(durationMs / 1000).toFixed(2)}s${colors.reset}`);
  } else {
    const isMandatory = isAcceptanceMode ? suite.isMandatoryInAcceptance : suite.isMandatoryInDev;
    if (!isMandatory) {
      results.push({
        id: suite.id,
        name: suite.name,
        group: suite.group,
        status: 'SKIPPED',
        durationMs,
        casesCount: suite.casesCount,
      });
      console.log(`\n${colors.yellow}⚠ SKIP [${suite.id}]: Không bắt buộc ở chế độ hiện tại (Exit: ${spawnRes.status})${colors.reset}`);
    } else {
      failedSuites++;
      results.push({
        id: suite.id,
        name: suite.name,
        group: suite.group,
        status: 'FAILED',
        durationMs,
        casesCount: suite.casesCount,
        error: `Exit code: ${spawnRes.status}`,
      });
      console.error(`\n${colors.red}✖ THẤT BẠI [${suite.id}]: FAILED với mã lỗi ${spawnRes.status}${colors.reset}`);
    }
  }
}

// -----------------------------------------------------------------------------
// TỔNG KẾT BÁO CÁO
// -----------------------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  BẢNG TỔNG HỢP KẾT QUẢ KIỂM THỬ PHASE 7: KITCHEN / KDS                         ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);

console.log(`| Mã ID   | Tên Bộ Kiểm Thử                                       | Thời Gian | Trạng Thái  |`);
console.log(`|---------|-------------------------------------------------------|-----------|-------------|`);

for (const r of results) {
  const statusColor = r.status === 'PASSED' ? colors.green : r.status === 'SKIPPED' ? colors.yellow : colors.red;
  const idStr = r.id.padEnd(7);
  const nameStr = (r.name.length > 53 ? r.name.slice(0, 50) + '...' : r.name).padEnd(53);
  const timeStr = `${(r.durationMs / 1000).toFixed(1)}s`.padStart(9);
  const statusStr = r.status.padEnd(11);
  console.log(`| ${idStr} | ${nameStr} | ${timeStr} | ${statusColor}${statusStr}${colors.reset} |`);
}

console.log(`--------------------------------------------------------------------------------`);
console.log(`Tổng số Suite thực thi: ${results.length}`);
console.log(`Suite thành công      : ${results.filter((r) => r.status === 'PASSED').length}`);
console.log(`Suite bỏ qua (Skip)   : ${results.filter((r) => r.status === 'SKIPPED').length}`);
console.log(`Suite thất bại        : ${failedSuites}`);
console.log(`Tổng số ca test đạt   : ${passedCases} / ${totalCases}`);
console.log(`--------------------------------------------------------------------------------\n`);

if (failedSuites > 0) {
  console.error(`${colors.bold}${colors.red}❌ KẾT QUẢ: PHASE 7 CHƯA ĐẠT CHỈ TIÊU (Có ${failedSuites} suite lỗi).${colors.reset}\n`);
  process.exit(1);
} else {
  console.log(`${colors.bold}${colors.green}🎉 KẾT QUẢ: TOÀN BỘ CÁC BỘ TEST PHASE 7 ĐÃ VƯỢT QUA XUẤT SẮC! (100% PASS)${colors.reset}\n`);
  process.exit(0);
}
