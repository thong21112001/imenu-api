import { spawnSync } from 'child_process';
import path from 'path';

/**
 * iMenu Ecosystem - Master Phase 10 Test Orchestrator
 * (Realtime WebSocket, Room Security, Domain Events Matrix, Call Staff, Client Resilience, SDK Contract & Browser E2E)
 * 
 * Hỗ trợ 2 chế độ:
 *   1. --mode=dev        : Developer Run (Suites 1-5 Backend & SDK Verification)
 *   2. --mode=acceptance : Final Acceptance Run (Official Phase 10 Quality Gate including Browser E2E)
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
const modeName = isAcceptanceMode ? 'FINAL ACCEPTANCE RUN (PHASE 10 CLOSURE GATE)' : 'DEVELOPER TEST RUN';

console.log(`\n${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}  iMenu Ecosystem - Phase 10 (Realtime & Multi-Tab Ecosystem) Orchestrator     ${colors.reset}`);
console.log(`${colors.bold}${colors.yellow}  CHẾ ĐỘ THỰC THI: [${modeName}] ${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

const backendDir = path.resolve(__dirname, '../..');
const frontendUtilsDir = path.resolve(__dirname, '../../../imenu-menudientu/packages/utils');

const suites: SuiteConfig[] = [
  {
    id: 'P10-01',
    name: 'Call Staff & Acknowledgment Flow (Port 3125)',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-10-realtime/call-staff-notification.test.ts'],
    casesCount: 13,
    cwd: backendDir,
  },
  {
    id: 'P10-02',
    name: 'WebSocket Room Security & Multi-Tenant Isolation (Port 3126)',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-10-realtime/websocket-room-security.test.ts'],
    casesCount: 10,
    cwd: backendDir,
  },
  {
    id: 'P10-03',
    name: 'Domain Events Matrix 7 Realtime Groups (Port 3127)',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-10-realtime/domain-events-matrix.test.ts'],
    casesCount: 11,
    cwd: backendDir,
  },
  {
    id: 'P10-04A',
    name: 'Frontend SDK Contract Verification Suite (Port 3108)',
    cmd: 'npx',
    args: ['ts-node', 'tests/sdk-contract.test.ts'],
    casesCount: 34,
    cwd: frontendUtilsDir,
  },
  {
    id: 'P10-04B',
    name: 'Client Resilience, Reconnect & Deduplication (Port 3128)',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-10-realtime/subphase-10-4-client-resilience.test.ts'],
    casesCount: 5,
    cwd: backendDir,
  },
  {
    id: 'P10-05',
    name: 'Browser E2E Multi-Tab Ecosystem: Customer Call Staff, Admin Header & KDS Sync',
    cmd: 'npx',
    args: ['ts-node', 'tests/phase-10-realtime/e2e-realtime-runner.test.ts'],
    casesCount: 3,
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
console.log(`${colors.bold}  TỔNG KẾT KIỂM THỬ TOÀN DIỆN PHASE 10: ${totalPassedSuites}/${suites.length} Suites Passed, ${totalCases} Test Cases Verified${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);

process.exit(totalFailedSuites > 0 ? 1 : 0);
