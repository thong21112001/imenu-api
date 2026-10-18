import { spawnSync } from 'child_process';
import path from 'path';

/**
 * iMenu Ecosystem - Master Phase 11 Test Orchestrator
 * (Customer Review Per Branch, Atomic CAS Concurrency, Digital Bill Download & 24h Expiration)
 * 
 * Hỗ trợ 2 chế độ:
 *   1. --mode=dev        : Developer Run
 *   2. --mode=acceptance : Final Acceptance Run (Official Closure Gate)
 */

interface SuiteConfig {
  id: string;
  name: string;
  group: 'phase11_backend' | 'frontend_sdk';
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
const modeName = isAcceptanceMode ? 'FINAL ACCEPTANCE RUN (PHASE 11 CLOSURE GATE)' : 'DEVELOPER TEST RUN';

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  iMenu Ecosystem - Phase 11 (Review + Digital Bill) Master Test Orchestrator   ${colors.reset}`);
console.log(`${colors.bold}${colors.yellow}  CHẾ ĐỘ THỰC THI: [${modeName}] ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

const backendDir = path.resolve(__dirname, '../..');
const frontendDir = path.resolve(__dirname, '../../../imenu-menudientu');

const suites: SuiteConfig[] = [
  // ---------------------------------------------------------------------------
  // NHÓM 1: PHASE 11 BACKEND SUITES
  // ---------------------------------------------------------------------------
  {
    id: 'P11-01',
    name: 'Customer Review Submission, State Machine Guards & Atomic CAS Concurrency (Port 3129)',
    group: 'phase11_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-11-review-digital-bill/customer-review-submission.test.ts'],
    casesCount: 11,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P11-02',
    name: 'Multi-Branch Review Isolation, CSAT Aggregation & Moderation RBAC (Port 3130)',
    group: 'phase11_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-11-review-digital-bill/branch-review-isolation.test.ts'],
    casesCount: 9,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },
  {
    id: 'P11-03',
    name: 'Digital Bill Download & Post-Settlement 24h Receipt Access Token Expiration (Port 3131)',
    group: 'phase11_backend',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-11-review-digital-bill/digital-bill-download.test.ts'],
    casesCount: 7,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: backendDir,
  },

  // ---------------------------------------------------------------------------
  // NHÓM 2: FRONTEND SDK CONTRACT
  // ---------------------------------------------------------------------------
  {
    id: 'P11-SDK',
    name: 'Frontend SDK Contract & Canvas Receipt 2D Renderer Verification',
    group: 'frontend_sdk',
    cmd: 'npm',
    args: ['run', 'test:sdk'],
    casesCount: 40,
    isMandatoryInDev: true,
    isMandatoryInAcceptance: true,
    cwd: frontendDir,
  },
];

async function runAll() {
  const startTime = Date.now();
  let totalSuites = suites.length;
  let passedSuites = 0;
  let failedSuites = 0;
  let totalTestCases = 0;
  let passedTestCases = 0;

  for (const suite of suites) {
    console.log(`\n${colors.bold}${colors.magenta}>>> BẮT ĐẦU SUITE: [${suite.id}] ${suite.name}${colors.reset}`);
    totalTestCases += suite.casesCount;

    const res = spawnSync(suite.cmd, suite.args, {
      cwd: suite.cwd || backendDir,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
      },
    });

    if (res.status === 0) {
      console.log(`${colors.green}✔ SUITE [${suite.id}] HOÀN TẤT THÀNH CÔNG!${colors.reset}`);
      passedSuites++;
      passedTestCases += suite.casesCount;
    } else {
      console.error(`${colors.red}✖ SUITE [${suite.id}] THẤT BÀI (Exit code: ${res.status})${colors.reset}`);
      failedSuites++;
      if (isAcceptanceMode && suite.isMandatoryInAcceptance) {
        console.error(`${colors.red}[FATAL] Chế độ Acceptance dừng ngay lập tức do suite bắt buộc thất bại!${colors.reset}`);
        process.exit(1);
      }
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}              BÁO CÁO TỔNG HỢP KIỂM THỬ GIAI ĐOẠN 11 (PHASE 11)                 ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`  Thời gian thực thi   : ${durationSec}s`);
  console.log(`  Tổng số Suite        : ${totalSuites} (Passed: ${passedSuites}, Failed: ${failedSuites})`);
  console.log(`  Tổng số Test Cases   : ~${totalTestCases} (Passed: ~${passedTestCases}, Failed: ~${totalTestCases - passedTestCases})`);
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);

  if (failedSuites === 0) {
    console.log(`\n${colors.bold}${colors.green}🎉 TẤT CẢ TEST SUITES CỦA PHASE 11 ĐÃ PASS 100%! ĐỦ ĐIỀU KIỆN TIẾP TỤC BƯỚC TIẾP THEO.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.bold}${colors.red}❌ CÓ ${failedSuites} TEST SUITE THẤT BÀI. VUI LÒNG KIỂM TRA LOG VÀ SỬA LỖI (FIX ↺).${colors.reset}\n`);
    process.exit(1);
  }
}

runAll();
