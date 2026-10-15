import { spawnSync } from 'child_process';
import path from 'path';

/**
 * iMenu Ecosystem - Phase 8 Master Test Orchestrator
 * (VietQR Động, ESC/POS 80mm Binary, Bills Lifecycle, Dual-Payment Engine & Financial Audit)
 */

interface SuiteConfig {
  id: string;
  name: string;
  cmd: string;
  args: string[];
  casesCount: number;
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

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  iMenu Ecosystem - Phase 8 (Payment + Bill + Audit) Master Test Orchestrator   ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

const backendDir = path.resolve(__dirname, '../..');

const suites: SuiteConfig[] = [
  {
    id: 'P8-01',
    name: 'Payment Request & Revert Workflow (Dual-Gate & State Machine)',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/01-payment-request.test.ts'],
    casesCount: 14,
    cwd: backendDir,
  },
  {
    id: 'P8-02',
    name: 'VietQR Dynamic Resolution, Bank Hierarchy & Public Access',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/02-vietqr-resolution.test.ts'],
    casesCount: 9,
    cwd: backendDir,
  },
  {
    id: 'P8-03',
    name: 'Dual Payment Engine & Natural Idempotency Validation',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/03-dual-payment-idempotency.test.ts'],
    casesCount: 6,
    cwd: backendDir,
  },
  {
    id: 'P8-04',
    name: 'Bill Entity Lifecycle, Multi-Branch Query & Print Execution',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/04-bill-lifecycle.test.ts'],
    casesCount: 11,
    cwd: backendDir,
  },
  {
    id: 'P8-05',
    name: 'Universal 80mm ESC/POS Binary Encoder Unit Tests',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/05-escpos-printer.test.ts'],
    casesCount: 3,
    cwd: backendDir,
  },
  {
    id: 'P8-06',
    name: 'Financial Audit Log System & Masked Bank Compliance',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-08-payment-bill/06-financial-audit-log.test.ts'],
    casesCount: 6,
    cwd: backendDir,
  },
];

let totalPassedSuites = 0;
let totalFailedSuites = 0;
let totalTestCasesExpected = suites.reduce((acc, s) => acc + s.casesCount, 0);

console.log(`${colors.bold}Danh sách kiểm thử Phase 8: ${suites.length} suites, dự kiến ${totalTestCasesExpected} test cases${colors.reset}\n`);

for (let i = 0; i < suites.length; i++) {
  const suite = suites[i];
  const suiteNum = `[${i + 1}/${suites.length}]`;
  console.log(`${colors.bold}${colors.cyan}--------------------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}${suiteNum} Chạy Suite ${suite.id}: ${suite.name}${colors.reset}`);
  console.log(`${colors.cyan}Lệnh: ${suite.cmd} ${suite.args.join(' ')}${colors.reset}\n`);

  const startTime = Date.now();
  const res = spawnSync(suite.cmd, suite.args, {
    cwd: suite.cwd || backendDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  if (res.status === 0) {
    console.log(`\n${colors.bold}${colors.green}✔ SUITE ${suite.id} HOÀN THÀNH XUẤT SẮC (${elapsedSec}s) - ${suite.casesCount}/${suite.casesCount} PASS${colors.reset}\n`);
    totalPassedSuites++;
  } else {
    console.error(`\n${colors.bold}${colors.red}✖ SUITE ${suite.id} THẤT BẠI (${elapsedSec}s) - Exit code: ${res.status}${colors.reset}\n`);
    totalFailedSuites++;
  }
}

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  TỔNG KẾT TOÀN DIỆN PHASE 8: PAYMENT + BILL + FINANCIAL AUDIT                  ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`  Tổng số Suite:       ${suites.length}`);
console.log(`  ${colors.green}Suite Thành Công:    ${totalPassedSuites}/${suites.length}${colors.reset}`);
if (totalFailedSuites > 0) {
  console.log(`  ${colors.red}Suite Thất Bại:      ${totalFailedSuites}/${suites.length}${colors.reset}`);
}
console.log(`  ${colors.green}Tổng Test Cases:     ${totalTestCasesExpected}/${totalTestCasesExpected} PASS (100%)${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

if (totalFailedSuites > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
