---
description: Mandatory workflow for AI agents working on imenu-api tasks.
alwaysApply: true
---

# IMENU API - AI AGENT WORKFLOW

## 1. Understand Before Editing

Before modifying code, determine:
- what the user wants
- which module owns the functionality
- related existing files
- shared infrastructure involved
- authentication impact
- authorization impact
- database impact
- API contract impact

## 2. Inspect Existing Patterns

Search the repository for similar implementations before creating new code.

Examples:
- new controller → inspect existing controllers
- new service → inspect existing services
- new schema → inspect Mongoose schemas
- new permission → inspect permission constants and existing decorators
- authenticated endpoint → inspect JWT guards/decorators/public-route handling

## 3. Minimal Change Principle

Implement the smallest change that correctly satisfies the requirement.

Do not:
- modify unrelated files
- perform unrelated refactoring
- rename APIs without authorization
- reorganize the entire project for stylistic reasons

## 4. Before Creating New Code

Ask:
```text
Does this already exist?
Can an existing utility be reused?
Can an existing service be extended?
Can an existing DTO be reused?
Can an existing decorator be reused?
Can an existing schema be reused?
```

Only create new abstractions when necessary.

## 5. Database Changes

Before changing a schema:
1. Identify existing fields.
2. Identify indexes.
3. Identify references.
4. Identify consumers.
5. Determine backward compatibility.
6. Determine migration/seed implications.

Never casually remove or rename persistent fields.

## 6. API Changes

Before changing an endpoint:
1. Inspect controller.
2. Inspect DTOs.
3. Inspect service.
4. Inspect response format.
5. Inspect authentication.
6. Inspect permissions.
7. Inspect Swagger metadata.

Preserve the contract unless a breaking change is explicitly requested.

## 7. Security Changes

Treat changes involving JWT, passwords, roles, permissions, restaurantId, branchId, authentication, or authorization as security-sensitive.

Inspect all relevant guards and decorators before implementation.

## 8. Implementation

Modify only necessary files. Follow established conventions. Keep controllers thin, business logic in services, external input validated, and tenant boundaries enforced.

## 9. Verification

After implementation:

```bash
npm run build
```

Run relevant tests when available.

For API changes, verify successful, invalid, unauthorized, forbidden, and tenant-isolation scenarios where applicable.

## 10. Final Review

Before reporting completion, verify:
- no unrelated files changed
- no secrets exposed
- `.env` not modified without permission
- no accidental API contract change
- no permission bypass
- no tenant isolation bypass
- no destructive database command
- no TypeScript errors
- no unnecessary dependency

## 11. Completion Standard

A task is complete only when:

```text
Requirement understood
+
Correct implementation
+
Architecture preserved
+
Security preserved
+
API compatibility preserved
+
Verification performed
```
