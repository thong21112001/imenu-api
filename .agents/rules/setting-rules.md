---
description: Master rules for the imenu-api backend project. Defines rule priority, mandatory behavior, architecture boundaries, safety requirements, and how all other agent rules must be applied.
alwaysApply: true
---

# IMENU API - MASTER AGENT RULES

## 1. Purpose

These rules define the mandatory engineering standards for the `imenu-api` backend project.

The AI Agent MUST follow these rules whenever it:
- analyzes the repository
- creates, modifies, or deletes files
- refactors code
- creates modules or APIs
- changes database schemas
- changes authentication or authorization
- changes API contracts
- adds dependencies
- writes tests
- debugs or verifies the application

Primary objective:

> Preserve architectural consistency, business logic, API contracts, security, maintainability, and backward compatibility.

## 2. Rule Priority

Apply rules in this order:

1. User's explicit request
2. Safety, security, and permission rules
3. This `setting-rules.md`
4. `backend-architecture.md`
5. `nestjs-development.md`
6. `database-mongoose.md`
7. `api-contract.md`
8. `security-and-permissions.md`
9. `testing-and-verification.md`
10. `language-policy.md`
11. `agent-workflow.md`

When rules conflict, apply the higher-priority rule. If the conflict affects architecture, security, data integrity, or API compatibility, ask the user before proceeding.

## 3. Core Engineering Principles

The Agent MUST:
- Prefer existing project patterns over introducing new patterns.
- Reuse existing utilities, decorators, guards, services, DTOs, and helpers when applicable.
- Avoid unnecessary abstractions and dependencies.
- Keep modules isolated and cohesive.
- Keep business logic inside services/domain layers rather than controllers.
- Keep controllers thin.
- Preserve existing API response structures and DTO field names unless explicitly requested otherwise.
- Preserve authentication and authorization behavior.
- Prefer backward-compatible changes.
- Minimize modification scope.

The Agent MUST NOT perform large-scale refactoring merely because another architecture looks cleaner.

## 4. Repository Inspection Before Implementation

Before a non-trivial change, inspect:
1. Existing project structure.
2. Relevant modules.
3. Controllers and services.
4. DTOs and schemas.
5. Guards/decorators/interceptors/filters.
6. Shared utilities.
7. API response conventions.
8. Package dependencies.
9. Existing tests.

Never assume a file or abstraction does not exist without checking.

## 5. Existing Architecture Is the Source of Truth

Existing working source code has higher authority than assumptions from documentation.

When documentation and source code disagree:
- inspect the actual implementation
- preserve existing working behavior unless the user explicitly requests a change
- explain material discrepancies

## 6. Technology Baseline

The backend baseline is:
- NestJS
- Express
- TypeScript
- MongoDB
- Mongoose
- Passport JWT
- `@nestjs/jwt`
- `@nestjs/passport`
- `bcryptjs`
- `class-validator`
- `class-transformer`
- `@nestjs/swagger`
- EventEmitter2
- Winston
- Morgan
- Helmet

Do not replace these with alternative frameworks/ORMs/ODMs unless explicitly requested.

## 7. Change Authorization

Potentially destructive or breaking changes require explicit authorization, including:
- dropping collections/databases
- removing or renaming persistent fields
- changing authentication behavior
- changing permission semantics
- removing endpoints
- changing response structures
- changing production secrets
- destructive data operations

## 8. Environment Variables

The Agent MUST NOT:
- expose `.env` values
- print secrets
- commit secrets
- modify `.env` without explicit authorization
- replace production credentials

The Agent MAY update `.env.example` when necessary.

## 9. Dependency Management

Before adding a dependency:
1. Check whether functionality already exists.
2. Check whether an existing dependency can solve it.
3. Prefer established project libraries.
4. Add a new dependency only when justified.

After dependency changes, update `package.json`/lockfile as appropriate and verify the build.

## 10. Implementation Workflow

For non-trivial tasks:
1. Understand the request.
2. Inspect relevant code.
3. Identify applicable rules.
4. Identify dependencies and side effects.
5. Implement the minimal correct solution.
6. Run formatting/lint/build/tests where available.
7. Verify API/database/security behavior.
8. Report changed files and verification results.

## 11. Final Response Requirements

Report:
### Changed
Files changed and purpose.

### Behavior
Resulting behavior.

### Verification
Commands/tests actually executed.

### Risks
Remaining risks, assumptions, or unverified dependencies.

Never claim a test passed if it was not actually executed.
