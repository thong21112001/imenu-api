---
description: Testing, build verification, regression checks, and manual verification rules for imenu-api.
alwaysApply: true
---

# IMENU API - TESTING AND VERIFICATION

## 1. Verification Is Required

After meaningful changes, perform the strongest practical verification available.

For TypeScript source changes, when the environment permits:

```bash
npm run build
```

## 2. Dependency Changes

After dependency changes, run the project's package-manager install/update command and then:

```bash
npm run build
```

## 3. Tests

If tests exist, run relevant tests. Prefer:
1. targeted tests
2. module tests
3. full suite

Never claim tests passed if they were not executed.

## 4. Build Verification

Build verification should confirm compilation, imports, decorators, and generated output.

Build success does not guarantee runtime correctness.

## 5. Runtime Verification

When practical, verify the health endpoint according to the existing implementation, commonly:

```text
GET /health
```

## 6. Swagger Verification

For API changes, verify Swagger generation and the configured `/api-docs` endpoint.

## 7. Authentication Verification

For protected endpoints, verify:
- no token → 401
- invalid token → 401
- valid token without permission → 403
- valid token with permission → success

Follow actual project semantics.

## 8. Tenant Verification

Verify cross-tenant isolation:

```text
Restaurant A user → Restaurant A resource → allowed
Restaurant A user → Restaurant B resource → denied/not found
```

according to project semantics.

## 9. Validation Verification

Test:
- missing required fields
- invalid types
- invalid enums
- invalid MongoDB IDs
- unexpected fields
- invalid pagination

## 10. Database Verification

After schema changes:
- verify startup
- verify schema registration
- verify indexes where applicable
- verify CRUD operations
- verify compatibility with existing data

Never reset production data as a test shortcut.

## 11. Audit Log Verification

Mutating operations such as POST/PATCH/DELETE should trigger the established audit mechanism where applicable.

Audit logging should not unnecessarily block primary business operations.

## 12. Regression Testing

Changes to shared infrastructure such as guards, filters, decorators, DTO helpers, logging, database configuration, or authentication require broader regression verification.

## 13. Verification Report

Use:

```text
Build:
PASS / FAIL / NOT RUN

Tests:
PASS / FAIL / NOT RUN

Runtime:
PASS / FAIL / NOT RUN

Swagger:
PASS / FAIL / NOT RUN

Database:
PASS / FAIL / NOT RUN

Known Issues:
...
```

Never fabricate results.
