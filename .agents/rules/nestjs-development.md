---
description: NestJS implementation conventions for controllers, services, modules, guards, pipes, interceptors, providers, and dependency injection.
alwaysApply: true
---

# IMENU API - NESTJS DEVELOPMENT RULES

## 1. NestJS First

Use NestJS-native mechanisms whenever appropriate:
- Modules
- Controllers
- Providers
- Services
- Guards
- Interceptors
- Pipes
- Filters
- Decorators
- Dependency Injection

Do not bypass NestJS architecture unnecessarily.

## 2. Dependency Injection

Use constructor injection:

```ts
constructor(
  private readonly usersService: UsersService,
) {}
```

Do not manually construct injectable services unless there is a specific infrastructure reason.

## 3. Modules

Business domains SHOULD have dedicated NestJS modules.

Explicitly declare imports, controllers, providers, and exports. Export only providers genuinely required by other modules.

## 4. Controllers

Use standard HTTP semantics:
- GET: read
- POST: create/action
- PATCH: partial update
- PUT: full replacement where intended
- DELETE: delete

Do not introduce custom HTTP behavior unnecessarily.

## 5. DTO Validation

External input SHOULD pass through DTOs using `class-validator` and `class-transformer`.

The global validation configuration should remain consistent with the existing project, typically including:

```ts
whitelist: true
transform: true
```

Do not silently accept arbitrary request fields.

## 6. Guards

Authentication and authorization belong in guards.

Prefer the established flow:

```text
JwtAuthGuard
    ↓
PermissionsGuard
    ↓
Controller
```

Do not duplicate JWT validation manually in controllers.

## 7. Decorators

Reuse established decorators such as:

```ts
@Public()
@CurrentUser()
@CurrentRestaurant()
@RequirePermissions(...)
```

Do not create duplicate decorators for the same purpose.

## 8. Interceptors

Use interceptors for cross-cutting concerns such as:
- audit logging
- request/response transformation
- timing
- metrics

Audit logging must not unnecessarily block the primary request.

## 9. Exception Filters

Use the global exception filter for consistent error handling. Do not invent ad-hoc error formats.

## 10. Providers

Providers should have focused responsibilities. Avoid giant services handling unrelated domains.

## 11. Async Operations

Prefer `async/await`. Do not mix callback and promise styles unnecessarily.

## 12. TypeScript

Prefer strong typing. Avoid `any` unless justified. Prefer `unknown` at genuinely unknown boundaries.

Do not use `@ts-ignore` or `@ts-nocheck` unless explicitly authorized and documented.

## 13. Error Handling

Do not silently swallow errors.

## 14. Business State Transitions

Entities such as orders, bills, tables, and payments may have explicit lifecycles. Invalid state transitions must be rejected when the domain defines them.

## 15. Avoid Premature Abstraction

Do not create generic base controllers, generic CRUD frameworks, generic repositories, excessive interfaces, or unnecessary factories unless the project already uses them or the abstraction solves a demonstrated problem.
