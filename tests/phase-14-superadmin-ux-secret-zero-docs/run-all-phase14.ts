/**
 * MASTER TEST RUNNER - PHASE 14
 * Superadmin Workspace Purification, Zero Test-Password Leakage on Main Merge & Master README Synchronization
 *
 * Runs all 3 test suites:
 * 1. secret-scanning-guard.test.ts (AUD-14.1)
 * 2. superadmin-workspace-isolation.test.ts (AUD-14.2, AUD-14.3, AUD-14.4)
 * 3. readme-documentation-integrity.test.ts (AUD-14.5)
 */

import { runSecretScanningTests } from './secret-scanning-guard.test';
import { runSuperAdminWorkspaceIsolationTests } from './superadmin-workspace-isolation.test';
import { runReadmeDocumentationIntegrityTests } from './readme-documentation-integrity.test';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function runAllPhase14() {
  const isAcceptance = process.argv.includes('--mode=acceptance');

  console.log(`\n${colors.bold}${colors.cyan}╔═══════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}║   IMENU PHASE 14: MASTER ACCEPTANCE TEST ORCHESTRATOR                 ║${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}║   Mode: ${isAcceptance ? 'ACCEPTANCE (Strict Quality Gate)' : 'DEVELOPER RUN'}                                      ║${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}╚═══════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const results: { name: string; passed: boolean; count: number; failures: number }[] = [];

  // 1. Suite 1: Secret Scanning Guard
  try {
    const res = await runSecretScanningTests();
    results.push({ name: 'Secret Scanning Guard (AUD-14.1)', ...res });
  } catch (err: any) {
    results.push({ name: 'Secret Scanning Guard (AUD-14.1)', passed: false, count: 3, failures: 3 });
  }

  // 2. Suite 2: Superadmin Workspace Isolation
  try {
    const res = await runSuperAdminWorkspaceIsolationTests();
    results.push({ name: 'Superadmin Workspace Isolation (AUD-14.2 - 14.4)', ...res });
  } catch (err: any) {
    results.push({ name: 'Superadmin Workspace Isolation (AUD-14.2 - 14.4)', passed: false, count: 3, failures: 3 });
  }

  // 3. Suite 3: Master README Documentation Integrity
  try {
    const res = await runReadmeDocumentationIntegrityTests();
    results.push({ name: 'Master README Integrity & Parity (AUD-14.5)', ...res });
  } catch (err: any) {
    results.push({ name: 'Master README Integrity & Parity (AUD-14.5)', passed: false, count: 4, failures: 4 });
  }

  // Summary Table
  console.log(`\n${colors.bold}═════════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}                  PHASE 14 FINAL TEST SUMMARY REPORT                     ${colors.reset}`);
  console.log(`${colors.bold}═════════════════════════════════════════════════════════════════════════${colors.reset}`);

  let totalTests = 0;
  let totalFailures = 0;

  for (const r of results) {
    totalTests += r.count;
    totalFailures += r.failures;
    const status = r.passed
      ? `${colors.green}✔ PASS${colors.reset}`
      : `${colors.red}✖ FAIL (${r.failures} failed)${colors.reset}`;
    console.log(`  ${r.name.padEnd(52)}: [${status}] (${r.count - r.failures}/${r.count})`);
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
    console.log(`${colors.green}${colors.bold}🎉 PHASE 14 ALL TESTS PASSED! QUALITY GATE ACCEPTANCE CRITERIA MET.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.red}${colors.bold}❌ PHASE 14 TEST SUITE FAILED WITH ${totalFailures} ERROR(S).${colors.reset}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllPhase14();
}
