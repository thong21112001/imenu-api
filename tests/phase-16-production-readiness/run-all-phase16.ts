/**
 * MASTER TEST RUNNER - PHASE 16
 * E2E Stabilization & Production Readiness Verification Suite
 *
 * Runs:
 * 1. production-security-and-cors.test.ts (P16-01 to P16-05)
 * 2. realtime-resilience-and-isolation.test.ts (P16-06 to P16-09)
 * 3. Frontend SDK Contract Verification (P16-10 / SDK Contract 57 tests)
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { runProductionSecurityAndCorsTests } from './production-security-and-cors.test';
import { runRealtimeResilienceTests } from './realtime-resilience-and-isolation.test';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function runFrontendSdkContract(): Promise<{ passed: boolean; count: number; failures: number }> {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 16 Suite 3: Frontend SDK Contract & Platform Client Sync          ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  const utilsDir = path.resolve(__dirname, '../../../imenu-menudientu/packages/utils');
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const npxCmd = isWindows ? 'npx.cmd' : 'npx';
    const child = spawn(npxCmd, ['ts-node', 'tests/sdk-contract.test.ts'], {
      cwd: utilsDir,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      resolve({
        passed: code === 0,
        count: 57,
        failures: code === 0 ? 0 : 1,
      });
    });

    child.on('error', () => {
      resolve({
        passed: false,
        count: 57,
        failures: 1,
      });
    });
  });
}

async function main() {
  const startTime = Date.now();

  console.log(`\n${colors.bold}========================================================================${colors.reset}`);
  console.log(`${colors.bold}  iMenu Phase 16: E2E Stabilization & Production Readiness Master Runner ${colors.reset}`);
  console.log(`${colors.bold}========================================================================${colors.reset}`);

  const suite1 = await runProductionSecurityAndCorsTests();
  const suite2 = await runRealtimeResilienceTests();
  const suite3 = await runFrontendSdkContract();

  const totalCount = suite1.count + suite2.count + suite3.count;
  const totalFailures = suite1.failures + suite2.failures + suite3.failures;
  const passedAll = totalFailures === 0;

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${colors.bold}========================================================================${colors.reset}`);
  console.log(`${colors.bold}  KẾT QUẢ TỔNG HỢP KIỂM THỬ SẴN SÀNG PRODUCTION (PHASE 16)                ${colors.reset}`);
  console.log(`${colors.bold}========================================================================${colors.reset}`);
  console.log(`  1. Production Security & CORS:       ${suite1.passed ? colors.green + '✔ PASS' : colors.red + '✖ FAIL'}${colors.reset} (${suite1.count - suite1.failures}/${suite1.count})`);
  console.log(`  2. Realtime Resilience & Isolation:  ${suite2.passed ? colors.green + '✔ PASS' : colors.red + '✖ FAIL'}${colors.reset} (${suite2.count - suite2.failures}/${suite2.count})`);
  console.log(`  3. Frontend SDK Contract Sync:       ${suite3.passed ? colors.green + '✔ PASS' : colors.red + '✖ FAIL'}${colors.reset} (${suite3.count - suite3.failures}/${suite3.count})`);
  console.log(`${colors.bold}------------------------------------------------------------------------${colors.reset}`);
  console.log(`  Tổng số kiểm tra: ${totalCount} | Thành công: ${totalCount - totalFailures} | Thất bại: ${totalFailures} | Thời gian: ${durationSec}s`);
  console.log(`${colors.bold}========================================================================${colors.reset}\n`);

  process.exit(passedAll ? 0 : 1);
}

main();
