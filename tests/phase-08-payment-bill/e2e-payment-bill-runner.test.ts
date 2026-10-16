import { execSync } from 'child_process';
import path from 'path';

/**
 * iMenu - Phase 8: E2E Browser Runner Wrapper
 * Wrapper khởi chạy kịch bản kiểm thử E2E Payment & Bill trình duyệt đa ứng dụng từ Backend.
 */

async function runBrowserE2E() {
  console.log('========================================================================');
  console.log('  iMenu Backend - Phase 8: E2E Browser Payment & Bill Suite Trigger     ');
  console.log('========================================================================\n');

  const scriptPath = path.resolve(__dirname, '../../../imenu-menudientu/scripts/e2e-payment-bill-lifecycle.mjs');
  
  try {
    console.log(`[INFO] Kích hoạt kịch bản E2E Payment & Bill tại: ${scriptPath}`);
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      env: {
        ...process.env,
      },
    });
    console.log('\n✔ PASS: Kịch bản E2E Payment & Bill trình duyệt đã hoàn tất thành công!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n✖ FAIL: Kịch bản E2E trình duyệt gặp lỗi hoặc chưa sẵn sàng môi trường.');
    process.exit(error.status || 1);
  }
}

runBrowserE2E();
