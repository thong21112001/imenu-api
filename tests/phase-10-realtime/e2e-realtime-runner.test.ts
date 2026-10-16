import { execSync } from 'child_process';
import path from 'path';

/**
 * iMenu - Phase 10: E2E Browser Realtime Runner Wrapper
 * Wrapper kích hoạt kịch bản kiểm thử E2E Đa Tab Thời Gian Thực (Admin Header, Customer Call Staff, KDS, POS).
 */

async function runBrowserE2E() {
  console.log('========================================================================');
  console.log('  iMenu Backend - Phase 10: E2E Browser Realtime Ecosystem Suite       ');
  console.log('========================================================================\n');

  const scriptPath = path.resolve(__dirname, '../../../imenu-menudientu/scripts/e2e-realtime-ecosystem.mjs');

  try {
    console.log(`[INFO] Kích hoạt kịch bản E2E Realtime tại: ${scriptPath}`);
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      env: {
        ...process.env,
      },
    });
    console.log('\n✔ PASS: Kịch bản E2E Realtime trình duyệt đã hoàn tất thành công!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n✖ FAIL: Kịch bản E2E trình duyệt gặp lỗi hoặc chưa sẵn sàng môi trường.');
    process.exit(error.status || 1);
  }
}

runBrowserE2E();
