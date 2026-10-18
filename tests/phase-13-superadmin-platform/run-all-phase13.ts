import { spawnSync } from 'child_process';
import path from 'path';

/**
 * iMenu Ecosystem - Master Phase 13 Test Orchestrator
 * (Superadmin Platform Control Center, Global Revenue Analytics, Sales Team Management & Production Security Hardening)
 * 
 * Hỗ trợ 2 chế độ:
 *   1. --mode=dev        : Developer Run
 *   2. --mode=acceptance : Final Acceptance Run (Official Closure Gate)
 */

interface SuiteConfig {
  id: string;
  name: string;
  group: 'phase13_backend' | 'frontend_sdk' | 'frontend_build';
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
const modeName = isAcceptanceMode ? 'FINAL ACCEPTANCE RUN (PHASE 13 CLOSURE GATE)' : 'DEVELOPER TEST RUN';

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  iMenu Ecosystem - Phase 13 (Superadmin Platform) Master Test Orchestrator     ${colors.reset}`);
console.log(`${colors.bold}${colors.yellow}  CHẾ ĐỘ THỰC THI: [${modeName}] ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

const backendDir = path.resolve(__dirname, '../..');
const frontendDir = path.resolve(__dirname, '../../../imenu-menudientu');

const suites: SuiteConfig[] = [
  // ---------------------------------------------------------------------------
  // NHÓM 1: PHASE 13 BACKEND SUITES
  // ---------------------------------------------------------------------------
  {
    id: 'P13-01',
    name: 'Platform Restaurants, Tenant Suspension & Privilege Boundary (Port 3137)',
    group: 'phase13_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-13-superadmin-platform/platform-restaurants-management.test.ts'],
    casesCount: 6,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P13-02',
    name: 'Dual-Revenue Analytics, 4-Method GMV & Branch Drill-Down (Port 3138)',
    group: 'phase13_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-13-superadmin-platform/platform-revenue-analytics.test.ts'],
    casesCount: 4,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P13-03',
    name: 'Sales Reps Management & Atomic Commission Payout Batch (Port 3139)',
    group: 'phase13_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-13-superadmin-platform/platform-sales-payout.test.ts'],
    casesCount: 7,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P13-04',
    name: 'Security Hardening, Concurrency Race Guard & Safe Projection (Port 3140)',
    group: 'phase13_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-13-superadmin-platform/security-concurrency-hardening.test.ts'],
    casesCount: 4,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },

  // ---------------------------------------------------------------------------
  // NHÓM 2: FRONTEND SDK CONTRACT
  // ---------------------------------------------------------------------------
  {
    id: 'P13-SDK',
    name: 'Frontend SDK Contract & Platform Client Methods Verification (54/54)',
    group: 'frontend_sdk',
    cmd: 'npm',
    args: ['run', 'test:sdk'],
    casesCount: 54,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: frontendDir,
  },

  // ---------------------------------------------------------------------------
  // NHÓM 3: FRONTEND ADMIN PRODUCTION BUILD VALIDATION
  // ---------------------------------------------------------------------------
  {
    id: 'P13-ADMIN-BUILD',
    name: 'Next.js Production Build: imenu-admin (TypeScript, Pages, Routes)',
    group: 'frontend_build',
    cmd: 'npm',
    args: ['run', 'build:admin'],
    casesCount: 24,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: frontendDir,
  },
];

async function runAll() {
  const startTime = Date.now();
  let totalSuites = 0;
  let passedSuites = 0;
  let failedSuites = 0;
  let totalTestCases = 0;
  const results: Array<{ id: string; name: string; status: 'PASS' | 'FAIL'; duration: string }> = [];

  for (const suite of suites) {
    if (!isAcceptanceMode && !suite.isMandatoryInDev) {
      console.log(`${colors.yellow}⏩ Bỏ qua suite [${suite.id}] trong dev mode${colors.reset}`);
      continue;
    }

    totalSuites++;
    totalTestCases += suite.casesCount;

    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`▶ Bắt đầu chạy [${suite.id}]: ${suite.name}`);
    console.log(`--------------------------------------------------------------------------------`);

    const suiteStart = Date.now();
    const result = spawnSync(suite.cmd, suite.args, {
      cwd: suite.cwd || backendDir,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    const suiteDuration = ((Date.now() - suiteStart) / 1000).toFixed(2) + 's';

    if (result.status === 0) {
      passedSuites++;
      results.push({ id: suite.id, name: suite.name, status: 'PASS', duration: suiteDuration });
    } else {
      failedSuites++;
      results.push({ id: suite.id, name: suite.name, status: 'FAIL', duration: suiteDuration });
      if (isAcceptanceMode && suite.isMandatoryInAcceptance) {
        console.error(`\n${colors.red}❌ DỪNG TOÀN BỘ DO LỖI TẠI SUITE BẮT BUỘC [${suite.id}] TRONG ACCEPTANCE MODE${colors.reset}`);
        break;
      }
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

  console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  KẾT QUẢ TỔNG HỢP KIỂM THỬ GIAI ĐOẠN 13 (SUPERADMIN PLATFORM CONTROL CENTER)     ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`Chế độ thực thi: ${colors.bold}${modeName}${colors.reset}`);
  console.log(`Tổng số Test Suites : ${totalSuites}`);
  console.log(`Suites Thành công   : ${colors.green}${passedSuites}${colors.reset}`);
  console.log(`Suites Thất bại     : ${failedSuites > 0 ? colors.red + failedSuites + colors.reset : '0'}`);
  console.log(`Tổng số Test Cases  : ~${totalTestCases}`);
  console.log(`Thời gian thực thi  : ${totalDuration}\n`);

  console.log(`${colors.bold}BẢNG CHI TIẾT KẾT QUẢ:${colors.reset}`);
  results.forEach((r) => {
    const statusStr =
      r.status === 'PASS' ? `${colors.green}[PASS]${colors.reset}` : `${colors.red}[FAIL]${colors.reset}`;
    console.log(`  ${statusStr} [${r.id}] ${r.name.padEnd(72)} (${r.duration})`);
  });
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

  if (failedSuites > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll();
