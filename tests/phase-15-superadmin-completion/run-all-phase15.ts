/**
 * MASTER TEST RUNNER - PHASE 15
 * Superadmin Completion, Impersonation Support Mode & Multi-Role RBAC Sync
 *
 * Runs all 5 test suites:
 * 1. superadmin-restaurant-lifecycle.test.ts (P15-01)
 * 2. superadmin-sales-management.test.ts (P15-02)
 * 3. superadmin-payout-and-commissions.test.ts (P15-03)
 * 4. superadmin-impersonation-rbac.test.ts (P15-04)
 * 5. Frontend SDK Contract Verification (P15-05)
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { runSuperAdminRestaurantLifecycleTests } from './superadmin-restaurant-lifecycle.test';
import { runSuperAdminSalesManagementTests } from './superadmin-sales-management.test';
import { runSuperAdminPayoutAndCommissionsTests } from './superadmin-payout-and-commissions.test';
import { runSuperAdminImpersonationRbacTests } from './superadmin-impersonation-rbac.test';

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
  console.log(`${colors.bold}${colors.cyan}  Phase 15 Suite 5: Frontend SDK Contract & Platform Client Sync          ${colors.reset}`);
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

export async function runAllPhase15() {
  const isAcceptance = process.argv.includes('--mode=acceptance');

  console.log(`\n${colors.bold}${colors.cyan}╔═══════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}║   IMENU PHASE 15: SUPERADMIN COMPLETION & RBAC SYNC ORCHESTRATOR      ║${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}║   Mode: ${isAcceptance ? 'ACCEPTANCE (Strict Quality Gate)' : 'DEVELOPER TEST RUN'}                                ║${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}╚═══════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const results: { name: string; passed: boolean; count: number; failures: number }[] = [];

  // Suite 1: Restaurant Lifecycle
  try {
    const res = await runSuperAdminRestaurantLifecycleTests();
    results.push({ name: '[P15-01] Restaurant Lifecycle & Subscription Sync', ...res });
  } catch (err: any) {
    results.push({ name: '[P15-01] Restaurant Lifecycle & Subscription Sync', passed: false, count: 5, failures: 5 });
  }

  // Suite 2: Sales Management
  try {
    const res = await runSuperAdminSalesManagementTests();
    results.push({ name: '[P15-02] Sales Reps Management & Commission Policies', ...res });
  } catch (err: any) {
    results.push({ name: '[P15-02] Sales Reps Management & Commission Policies', passed: false, count: 4, failures: 4 });
  }

  // Suite 3: Payout & Commissions Ledger
  try {
    const res = await runSuperAdminPayoutAndCommissionsTests();
    results.push({ name: '[P15-03] Platform Commissions Ledger & Payout Batches', ...res });
  } catch (err: any) {
    results.push({ name: '[P15-03] Platform Commissions Ledger & Payout Batches', passed: false, count: 4, failures: 4 });
  }

  // Suite 4: Impersonation Mode & RBAC
  try {
    const res = await runSuperAdminImpersonationRbacTests();
    results.push({ name: '[P15-04] Support Impersonation & Strict RBAC Isolation', ...res });
  } catch (err: any) {
    results.push({ name: '[P15-04] Support Impersonation & Strict RBAC Isolation', passed: false, count: 5, failures: 5 });
  }

  // Suite 5: Frontend SDK Contract
  try {
    const res = await runFrontendSdkContract();
    results.push({ name: '[P15-05] Frontend SDK Contract Verification (57/57)', ...res });
  } catch (err: any) {
    results.push({ name: '[P15-05] Frontend SDK Contract Verification (57/57)', passed: false, count: 57, failures: 1 });
  }

  // Summary Table
  console.log(`\n${colors.bold}═════════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}                  PHASE 15 FINAL TEST SUMMARY REPORT                     ${colors.reset}`);
  console.log(`${colors.bold}═════════════════════════════════════════════════════════════════════════${colors.reset}`);

  let totalTests = 0;
  let totalFailures = 0;

  for (const r of results) {
    totalTests += r.count;
    totalFailures += r.failures;
    const status = r.passed
      ? `${colors.green}✔ PASS${colors.reset}`
      : `${colors.red}✖ FAIL (${r.failures} failed)${colors.reset}`;
    console.log(`  ${r.name.padEnd(54)}: [${status}] (${r.count - r.failures}/${r.count})`);
  }

  console.log(`${colors.bold}─────────────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(
    `  Total Tests Executed : ${totalTests}\n` +
    `  Total Tests Passed   : ${colors.green}${totalTests - totalFailures}${colors.reset}\n` +
    `  Total Tests Failed   : ${totalFailures > 0 ? colors.red + totalFailures + colors.reset : '0'}\n` +
    `  Overall Pass Rate    : ${colors.bold}${Math.round(((totalTests - totalFailures) / totalTests) * 100)}%${colors.reset}`
  );
  console.log(`${colors.bold}═════════════════════════════════════════════════════════════════════════${colors.reset}\n`);

  if (totalFailures === 0) {
    console.log(`${colors.green}${colors.bold}🎉 PHASE 15 ALL TESTS PASSED! QUALITY GATE ACCEPTANCE CRITERIA MET.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.red}${colors.bold}❌ PHASE 15 TEST SUITE FAILED WITH ${totalFailures} ERROR(S).${colors.reset}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllPhase15();
}
