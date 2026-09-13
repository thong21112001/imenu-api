---
description: Backend architecture and project structure rules for imenu-api.
alwaysApply: true
---

# IMENU API - BACKEND ARCHITECTURE

## 1. Architecture Style

The project follows:

> Modular Architecture + Shared Kernel

- `shared/`: reusable infrastructure and cross-cutting concerns
- `modules/`: business/domain modules

Business modules MUST NOT unnecessarily depend on unrelated implementation details.

## 2. Preferred Directory Structure

```text
src/
├── shared/
│   ├── configs/
│   ├── common/
│   │   ├── constants/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── filters/
│   │   ├── dto/
│   │   └── utils/
│   └── loggers/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── roles/
│   ├── activity-log/
│   ├── restaurants/
│   ├── tables/
│   ├── menu/
│   ├── orders/
│   └── bills/
│
├── app.controller.ts
├── app.service.ts
├── app.module.ts
└── main.ts
```

Do not introduce unrelated top-level architectural layers without a clear reason.

## 3. Module Boundaries

Each business module SHOULD contain its own:
- controller
- service
- module
- DTOs
- entities/schemas
- interfaces/types
- module-specific utilities

Example:

```text
modules/users/
├── dto/
├── entities/
├── interfaces/
├── users.controller.ts
├── users.service.ts
└── users.module.ts
```

## 4. Controller Responsibility

Controllers MUST remain thin.

They handle:
- HTTP requests
- DTO input
- route/query/body parameters
- authenticated user context
- service invocation
- response return

Controllers MUST NOT contain complex business logic or direct database workflows.

## 5. Service Responsibility

Services own business logic, including:
- business validation
- database operations
- state transitions
- ownership checks
- entity creation/update
- reusable business operations

## 6. Shared Layer

Use `shared/` only for genuinely cross-cutting functionality:
- decorators
- guards
- filters
- constants
- common DTOs
- configuration
- logging
- generic utilities

Do not place business-specific logic in `shared/`.

## 7. Dependency Direction

Prefer:

```text
Controller
    ↓
Service
    ↓
Mongoose Model / Repository abstraction
    ↓
MongoDB
```

Avoid circular dependencies. Do not blindly use `forwardRef()` as the first solution.

## 8. Configuration

Centralize configuration. Do not scatter raw `process.env.*` access through business logic.

## 9. Root Module and Bootstrap

`app.module.ts` wires infrastructure and modules. No business logic.

`main.ts` handles bootstrap configuration such as CORS, Helmet, ValidationPipe, Swagger, Morgan, and global setup. No business logic.

## 10. New Module Rule

Before creating a module, determine:
1. Whether existing functionality already covers it.
2. Whether it is a new business domain.
3. Whether it needs independent persistence.
4. Whether it exposes its own API.
5. Whether it has independent authorization rules.

## 11. Naming

Use:
- files: `kebab-case`
- classes: `PascalCase`
- variables/functions: `camelCase`
- code identifiers: English

Do not introduce multiple naming conventions.
