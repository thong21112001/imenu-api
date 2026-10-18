import * as fs from 'fs';
import * as path from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function pass(name: string, detail?: string) {
  console.log(`  ${colors.green}✔ PASS:${colors.reset} ${name}${detail ? ` (${detail})` : ''}`);
}

function fail(name: string, error?: any) {
  console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${name}`);
  if (error) {
    console.error(`    ${colors.red}${error?.stack || error?.message || (typeof error === 'object' ? JSON.stringify(error) : error)}${colors.reset}`);
  }
}

export async function runReadmeDocumentationIntegrityTests(): Promise<{ passed: boolean; count: number; failures: number }> {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  PHASE 14 AUD-14.5: MASTER README DOCUMENTATION INTEGRITY & PARITY     ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let testCount = 0;
  let failures = 0;

  const apiRoot = path.resolve(__dirname, '../..');
  const webRoot = path.resolve(__dirname, '../../../imenu-menudientu');

  const MASTER_READMES = [
    { label: 'imenu-api / README.md (VI)', path: path.join(apiRoot, 'README.md'), lang: 'vi' },
    { label: 'imenu-api / README_en.md (EN)', path: path.join(apiRoot, 'README_en.md'), lang: 'en' },
    { label: 'imenu-api / tests / README.md (VI)', path: path.join(apiRoot, 'tests/README.md'), lang: 'vi' },
    { label: 'imenu-api / tests / README_en.md (EN)', path: path.join(apiRoot, 'tests/README_en.md'), lang: 'en' },
    { label: 'imenu-menudientu / README.md (VI)', path: path.join(webRoot, 'README.md'), lang: 'vi' },
    { label: 'imenu-menudientu / README_en.md (EN)', path: path.join(webRoot, 'README_en.md'), lang: 'en' },
  ];

  // ---------------------------------------------------------------------------
  // TEST 1: Existence & Accessibility of All 6 Master READMEs
  // ---------------------------------------------------------------------------
  testCount++;
  try {
    const missingFiles = MASTER_READMES.filter((doc) => !fs.existsSync(doc.path));
    if (missingFiles.length === 0) {
      pass('TEST 1: AUD-14.5.1 Toàn bộ 6 tệp Master README song ngữ (API, Tests, Frontend) tồn tại đầy đủ và toàn vẹn');
    } else {
      failures++;
      fail('TEST 1: AUD-14.5.1 Thiếu các tệp Master README sau:', missingFiles.map((m) => m.label).join(', '));
    }
  } catch (err) {
    failures++;
    fail('TEST 1: Kiểm tra sự tồn tại của các tệp README gặp lỗi', err);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Documentation Coverage for Phases 12, 13, and 14 Across All READMEs
  // ---------------------------------------------------------------------------
  testCount++;
  try {
    const coverageFailures: string[] = [];

    for (const doc of MASTER_READMES) {
      if (!fs.existsSync(doc.path)) continue;
      const content = fs.readFileSync(doc.path, 'utf8');

      const hasPhase12 = content.includes('Phase 12') || content.includes('PHASE 12');
      const hasPhase13 = content.includes('Phase 13') || content.includes('PHASE 13');
      const hasPhase14 = content.includes('Phase 14') || content.includes('PHASE 14');

      if (!hasPhase12 || !hasPhase13 || !hasPhase14) {
        coverageFailures.push(
          `${doc.label} thiếu giai đoạn: ${[!hasPhase12 && 'Phase 12', !hasPhase13 && 'Phase 13', !hasPhase14 && 'Phase 14'].filter(Boolean).join(', ')}`
        );
      }
    }

    if (coverageFailures.length === 0) {
      pass(
        'TEST 2: AUD-14.5.2 Toàn bộ 6 tệp Master README đồng bộ cập nhật đầy đủ lộ trình đến Phase 12, Phase 13 và Phase 14'
      );
    } else {
      failures++;
      fail('TEST 2: AUD-14.5.2 Một số tệp README chưa đồng bộ đầy đủ các giai đoạn mới', coverageFailures.join('; '));
    }
  } catch (err) {
    failures++;
    fail('TEST 2: Kiểm tra độ phủ tài liệu gặp lỗi', err);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Specific Phase 14 Features Documented (Purification, Zero Passwords, Sync)
  // ---------------------------------------------------------------------------
  testCount++;
  try {
    const apiReadmeVi = fs.readFileSync(path.join(apiRoot, 'README.md'), 'utf8');
    const apiReadmeEn = fs.readFileSync(path.join(apiRoot, 'README_en.md'), 'utf8');
    const testsReadmeVi = fs.readFileSync(path.join(apiRoot, 'tests/README.md'), 'utf8');

    const hasPurification =
      apiReadmeVi.includes('Superadmin') &&
      (apiReadmeVi.includes('Platform') || apiReadmeVi.includes('cô lập') || apiReadmeVi.includes('thanh lọc'));

    const hasZeroSecrets =
      apiReadmeVi.includes('mật khẩu tĩnh') ||
      apiReadmeVi.includes('Secret') ||
      apiReadmeVi.includes('Zero');

    const hasPhase14Scripts =
      testsReadmeVi.includes('test:phase14') &&
      testsReadmeVi.includes('test:phase14:all');

    if (hasPurification && hasZeroSecrets && hasPhase14Scripts) {
      pass(
        'TEST 3: AUD-14.5.3 Tài liệu mô tả chuẩn xác 3 trụ cột Phase 14: Superadmin Isolation, Zero Passwords & Test Matrix Scripts'
      );
    } else {
      failures++;
      fail('TEST 3: AUD-14.5.3 Tài liệu chưa phản ánh đầy đủ các trụ cột tính năng của Phase 14', {
        hasPurification,
        hasZeroSecrets,
        hasPhase14Scripts,
      });
    }
  } catch (err) {
    failures++;
    fail('TEST 3: Kiểm tra nội dung tính năng Phase 14 gặp lỗi', err);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: package.json Test Scripts Parity for Phase 14
  // ---------------------------------------------------------------------------
  testCount++;
  try {
    const pkgPath = path.join(apiRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const scripts = pkg.scripts || {};

    const requiredScripts = [
      'test:phase14:secrets',
      'test:phase14:isolation',
      'test:phase14:docs',
      'test:phase14',
      'test:phase14:all',
      'test:phase14:acceptance',
    ];

    const missingScripts = requiredScripts.filter((s) => !scripts[s]);

    if (missingScripts.length === 0) {
      pass('TEST 4: AUD-14.5.4 package.json đồng bộ 100% các script kiểm thử tự động Phase 14');
    } else {
      failures++;
      fail('TEST 4: AUD-14.5.4 package.json thiếu các script:', missingScripts.join(', '));
    }
  } catch (err) {
    failures++;
    fail('TEST 4: Kiểm tra package.json scripts gặp lỗi', err);
  }

  console.log(`\n  README Documentation Integrity Summary: ${testCount - failures}/${testCount} tests passed\n`);
  return { passed: failures === 0, count: testCount, failures };
}

if (require.main === module) {
  runReadmeDocumentationIntegrityTests().then((res) => {
    if (!res.passed) {
      process.exit(1);
    }
  });
}
