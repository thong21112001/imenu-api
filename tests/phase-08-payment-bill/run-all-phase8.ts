import { spawnSync } from 'child_process';
import path from 'path';

/**
 * iMenu Ecosystem - Master Phase 8 Test Orchestrator
 * (VietQR Động, ESC/POS 80mm Binary, Bills Lifecycle, Dual-Payment Engine & Financial Audit)
 * 
 * Hỗ trợ 2 chế độ:
 *   1. --mode=dev        : Developer Run (Suites 1-4 Backend + SDK Contract + E2E Graceful)
 *   2. --mode=acceptance : Final Acceptance Run (Official Closure Gate)
 */

interface SuiteConfig {
  id: string;
  name: string;
  group: 'phase8_backend' | 'frontend_sdk' | 'browser_e2e';
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
const modeName = isAcceptanceMode ? 'FINAL ACCEPTANCE RUN (PHASE 8 CLOSURE GATE)' : 'DEVELOPER TEST RUN';

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  iMenu Ecosystem - Phase 8 (Payment + Bill + Audit) Master Test Orchestrator   ${colors.reset}`);
console.log(`${colors.bold}${colors.yellow}  CHẾ ĐỘ THỰC THI: [${modeName}] ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

const backendDir = path.resolve(__dirname, '../..');
const frontendDir = path.resolve(__dirname, '../../../imenu-menudientu');

const suites: SuiteConfig[] = [
  // ---------------------------------------------------------------------------
  // NHÓM 1: PHASE 8 BACKEND SUITES
  // ---------------------------------------------------------------------------
  {
    id: 'P8-01',
    name: 'Customer Payment Request, Table Status Update & Multi-Branch VietQR Resolution',
    group: 'phase8_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/payment-request-vietqr.test.ts'],
    casesCount: 18,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P8-02',
    name: 'Bills Complete-Payment, Natural Idempotency, Table Release & RBAC Isolation',
    group: 'phase8_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/bills-complete-payment.test.ts'],
    casesCount: 15,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P8-03',
    name: 'Financial Activity Audit Log & Masked Bank Account Security Compliance',
    group: 'phase8_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/financial-audit-log.test.ts'],
    casesCount: 7,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P8-04',
    name: 'Universal 80mm & 58mm ESC/POS Binary Encoder Unit & Contract Tests',
    group: 'phase8_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/escpos-receipt-encoder.test.ts'],
    casesCount: 16,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },

  // ---------------------------------------------------------------------------
  // NHÓM 2: FRONTEND SDK CONTRACT
  // ---------------------------------------------------------------------------
  {
    id: 'P8-SDK',
    name: 'Frontend SDK Contract & Payment/Bill Endpoints Verification',
    group: 'frontend_sdk',
    cmd: 'npx',
    args: ['ts-node', 'tests/sdk-contract.test.ts'],
    casesCount: 27,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: path.resolve(frontendDir, 'packages/utils'),
  },

  // ---------------------------------------------------------------------------
  // NHÓM 3: BROWSER E2E PAYMENT BILL RUNNER
  // ---------------------------------------------------------------------------
  {
    id: 'P8-E2E',
    name: 'Cross-App Browser E2E Payment & Bill Lifecycle (Puppeteer Core)',
    group: 'browser_e2e',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/e2e-payment-bill-runner.test.ts'],
    casesCount: 5,
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

for (let i = 0; i < suites.length; i++) {
  const suite = suites[i];
  const suiteNum = `[${i + 1}/${suites.length}]`;
  console.log(`\n${colors.bold}${colors.magenta}▶ ĐANG CHẠY SUITE ${suiteNum} [${suite.id}]: ${suite.name}${colors.reset}`);
  console.log(`${colors.cyan}Thư mục: ${suite.cwd || backendDir}${colors.reset}`);
  console.log(`${colors.cyan}Lệnh:    ${suite.cmd} ${suite.args.join(' ')}${colors.reset}\n`);

  totalCases += suite.casesCount;
  const startTime = Date.now();
  const res = spawnSync(suite.cmd, suite.args, {
    cwd: suite.cwd || backendDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });
  const durationMs = Date.now() - startTime;
  const elapsedSec = (durationMs / 1000).toFixed(1);

  if (res.status === 0) {
    console.log(`\n${colors.bold}${colors.green}✔ SUITE [${suite.id}] PASS THÀNH CÔNG (${elapsedSec}s) - ${suite.casesCount}/${suite.casesCount} ca test đạt chuẩn!${colors.reset}\n`);
    passedCases += suite.casesCount;
    results.push({
      id: suite.id,
      name: suite.name,
      group: suite.group,
      status: 'PASSED',
      durationMs,
      casesCount: suite.casesCount,
    });
  } else {
    const isMandatory = isAcceptanceMode ? suite.isMandatoryInAcceptance : suite.isMandatoryInDev;
    console.error(`\n${colors.bold}${colors.red}✖ SUITE [${suite.id}] THẤT BẠI (${elapsedSec}s) - Exit code: ${res.status}${colors.reset}\n`);
    if (isMandatory) {
      failedSuites++;
    }
    results.push({
      id: suite.id,
      name: suite.name,
      group: suite.group,
      status: 'FAILED',
      durationMs,
      casesCount: suite.casesCount,
      error: `Exit code: ${res.status}`,
    });
  }
}

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  BẢNG TỔNG HỢP KIỂM THỬ GIAI ĐOẠN 8 (PHASE 8 ACCEPTANCE REPORT)                ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`  Chế độ: ${colors.bold}${colors.yellow}${modeName}${colors.reset}`);
console.log(`  Thời gian: ${new Date().toISOString()}`);
console.log(`--------------------------------------------------------------------------------`);
console.log(`  ID       Nhóm              Số Ca    Thời Gian   Trạng Thái`);
console.log(`--------------------------------------------------------------------------------`);

for (const r of results) {
  const statusStr =
    r.status === 'PASSED'
      ? `${colors.green}✔ PASS${colors.reset}`
      : `${colors.red}✖ FAIL${colors.reset}`;
  const casesStr = String(r.casesCount).padStart(5, ' ');
  const durStr = `${(r.durationMs / 1000).toFixed(1)}s`.padStart(9, ' ');
  const idStr = r.id.padEnd(8, ' ');
  const groupStr = r.group.padEnd(16, ' ');
  console.log(`  ${idStr} ${groupStr} ${casesStr}   ${durStr}   ${statusStr}`);
}

console.log(`--------------------------------------------------------------------------------`);
console.log(`  TỔNG CỘNG:               ${String(passedCases).padStart(5, ' ')} / ${totalCases} test cases`);
console.log(`  TỔNG SUITE THÀNH CÔNG:   ${colors.green}${results.filter((r) => r.status === 'PASSED').length}/${suites.length} suites${colors.reset}`);
if (failedSuites > 0) {
  console.log(`  ${colors.red}SUITE THẤT BẠI:          ${failedSuites} suites${colors.reset}`);
}
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

if (failedSuites > 0) {
  console.error(`${colors.bold}${colors.red}Giai đoạn kiểm thử Phase 8 CHƯA ĐẠT. Vui lòng kiểm tra lại các lỗi trên.${colors.reset}\n`);
  process.exit(1);
} else {
  console.log(`${colors.bold}${colors.green}TOÀN BỘ CÁC CA KIỂM THỬ PHASE 8 ĐÃ ĐẠT 100% TIÊU CHUẨN XUẤT SẮC!${colors.reset}\n`);
  process.exit(0);
}
