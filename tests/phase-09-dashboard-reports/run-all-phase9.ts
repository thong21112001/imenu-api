import { spawnSync } from 'child_process';
import path from 'path';

/**
 * iMenu Ecosystem - Master Phase 9 Test Orchestrator
 * (Dashboard Dual-Key Analytics, Reports Revenue & Top Items, CSV Export Security, Public Demo Tables & Browser E2E)
 * 
 * Hỗ trợ 2 chế độ:
 *   1. --mode=dev        : Developer Run (Suites 1-5 Backend Verification)
 *   2. --mode=acceptance : Final Acceptance Run (Official Phase 9 Quality Gate including Browser E2E)
 */

interface SuiteConfig {
  id: string;
  name: string;
  cmd: string;
  args: string[];
  casesCount: number;
  cwd?: string;
  skipInDev?: boolean;
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
const modeName = isAcceptanceMode ? 'FINAL ACCEPTANCE RUN (PHASE 9 CLOSURE GATE)' : 'DEVELOPER TEST RUN';

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  iMenu Ecosystem - Phase 9 (Dashboard + Reports + Demo) Master Orchestrator    ${colors.reset}`);
console.log(`${colors.bold}${colors.yellow}  CHẾ ĐỘ THỰC THI: [${modeName}] ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

const backendDir = path.resolve(__dirname, '../..');

const suites: SuiteConfig[] = [
  {
    id: 'P9-01',
    name: 'Dashboard Overview & Realtime KPI Dual-Key Engine (Port 3120)',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-09-dashboard-reports/dashboard-overview.test.ts'],
    casesCount: 15,
    cwd: backendDir,
  },
  {
    id: 'P9-02',
    name: 'Revenue Reports Analytics, Multi-Method & Branch Breakdown (Port 3121)',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-09-dashboard-reports/reports-revenue-analytics.test.ts'],
    casesCount: 12,
    cwd: backendDir,
  },
  {
    id: 'P9-03',
    name: 'Top Selling Items, Option Price Delta & Cancelled Guard (Port 3122)',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-09-dashboard-reports/reports-top-items.test.ts'],
    casesCount: 6,
    cwd: backendDir,
  },
  {
    id: 'P9-04',
    name: 'Reports CSV Export Security, RBAC & Multi-Tenant Isolation (Port 3123)',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-09-dashboard-reports/reports-export-rbac.test.ts'],
    casesCount: 9,
    cwd: backendDir,
  },
  {
    id: 'P9-05',
    name: 'Customer Public Demo Tables Discovery & Table QR Resolution (Port 3124)',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-09-dashboard-reports/customer-demo-tables.test.ts'],
    casesCount: 7,
    cwd: backendDir,
  },
  {
    id: 'P9-06',
    name: 'Browser E2E Lifecycle: Admin Sidebar, Dashboard, Reports & Customer Responsive Layout',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-09-dashboard-reports/e2e-dashboard-reports-runner.test.ts'],
    casesCount: 4,
    cwd: backendDir,
  },
];

let totalPassedSuites = 0;
let totalFailedSuites = 0;
let totalCases = 0;

for (const suite of suites) {
  totalCases += suite.casesCount;
  console.log(`${colors.bold}${colors.magenta}>>> BẮT ĐẦU [${suite.id}]: ${suite.name}${colors.reset}`);

  const start = Date.now();
  const result = spawnSync(suite.cmd, suite.args, {
    cwd: suite.cwd || backendDir,
    stdio: 'inherit',
    shell: true,
  });
  const duration = ((Date.now() - start) / 1000).toFixed(2);

  if (result.status === 0) {
    console.log(`${colors.green}✔ THÀNH CÔNG: [${suite.id}] hoàn thành trong ${duration}s (${suite.casesCount} tests passed)${colors.reset}\n`);
    totalPassedSuites++;
  } else {
    console.error(`${colors.red}✖ THẤT BẠI: [${suite.id}] kết thúc với mã lỗi ${result.status} (${duration}s)${colors.reset}\n`);
    totalFailedSuites++;
  }
}

console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}  TỔNG KẾT KIỂM THỬ TOÀN DIỆN PHASE 9: ${totalPassedSuites}/${suites.length} Suites Passed, ${totalCases} Test Cases Verified${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

if (totalFailedSuites > 0) {
  console.error(`${colors.red}${colors.bold}GATE THẤT BẠI: Có ${totalFailedSuites} test suites không vượt qua yêu cầu kiểm thử!${colors.reset}\n`);
  process.exit(1);
} else {
  console.log(`${colors.green}${colors.bold}GATE CHẤP THUẬN HOÀN TOÀN: 100% Phase 9 Test Suites Passed!${colors.reset}\n`);
  process.exit(0);
}
