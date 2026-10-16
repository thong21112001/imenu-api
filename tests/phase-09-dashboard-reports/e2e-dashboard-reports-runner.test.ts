import { execSync } from 'child_process';
import path from 'path';

/**
 * iMenu - Phase 9: E2E Browser Runner Wrapper
 * Wrapper kích hoạt kịch bản kiểm thử E2E Dashboard, Reports & Customer UI/UX trình duyệt.
 */

async function runBrowserE2E() {
  console.log('========================================================================');
  console.log('  iMenu Backend - Phase 9: E2E Browser Dashboard & Reports Suite        ');
  console.log('========================================================================\n');

  const scriptPath = path.resolve(__dirname, '../../../imenu-menudientu/scripts/e2e-dashboard-reports.mjs');

  try {
    console.log(`[INFO] Kích hoạt kịch bản E2E Dashboard & Reports tại: ${scriptPath}`);
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      env: {
        ...process.env,
      },
    });
    console.log('\n✔ PASS: Kịch bản E2E Dashboard & Reports trình duyệt đã hoàn tất thành công!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n✖ FAIL: Kịch bản E2E trình duyệt gặp lỗi hoặc chưa sẵn sàng môi trường.');
    process.exit(error.status || 1);
  }
}

runBrowserE2E();
