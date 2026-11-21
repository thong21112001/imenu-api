import { runMcpRegistryAndToolsTests } from './mcp-registry-and-tools.test';
import { runAiOrchestratorAndSecurityTests } from './ai-orchestrator-and-security.test';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

export async function runAllPhase18Tests(): Promise<boolean> {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}    PHASE 18 MASTER TEST RUNNER: SUPERADMIN MCP & AI ORCHESTRATOR      ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  const startTime = Date.now();

  // Chạy Suite 1: MCP Core & 4 Read-Only Platform Tools
  const res1 = await runMcpRegistryAndToolsTests();

  // Nghỉ 500ms giữa 2 test suite để giải phóng port và connection
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Chạy Suite 2: AI Orchestrator, Deterministic Fallback, Rate Limiting & Audit Trail
  const res2 = await runAiOrchestratorAndSecurityTests();

  const totalCount = res1.count + res2.count;
  const totalFailures = res1.failures + res2.failures;
  const totalPassed = totalCount - totalFailures;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}  KẾT QUẢ TỔNG HỢP KIỂM THỬ TOÀN BỘ PHASE 18 (MCP & AI ORCHESTRATOR)  ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`  Sub-phase 18.1 (MCP Registry & Tools):    ${res1.passed ? colors.green + '✔ PASS' : colors.red + '✖ FAIL'}${colors.reset} (${res1.count - res1.failures}/${res1.count})`);
  console.log(`  Sub-phase 18.2 (AI Orchestrator & Audit): ${res2.passed ? colors.green + '✔ PASS' : colors.red + '✖ FAIL'}${colors.reset} (${res2.count - res2.failures}/${res2.count})`);
  console.log(`  Thời gian thực thi: ${elapsed} giây`);
  console.log(`  Tổng số ca kiểm thử: ${totalCount} | Thành công: ${totalPassed} | Thất bại: ${totalFailures}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  return totalFailures === 0;
}

if (require.main === module) {
  runAllPhase18Tests()
    .then((allPassed) => process.exit(allPassed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

