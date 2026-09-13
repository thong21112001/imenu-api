---
description: Security, JWT authentication, RBAC, tenant isolation, secrets, password handling, and permission rules.
alwaysApply: true
---

# IMENU API - SECURITY AND PERMISSIONS

## 1. Security Is Mandatory

Security takes precedence over convenience.

Never weaken:
- authentication
- authorization
- tenant isolation
- password security
- secret management
- input validation

## 2. JWT Authentication

The project uses Passport JWT.

Protected endpoints MUST rely on the established authentication mechanism. Do not manually parse Bearer tokens in every controller.

## 3. Public Endpoints

Endpoints that intentionally bypass authentication MUST use the established mechanism, such as:

```ts
@Public()
```

Do not bypass authentication globally.

## 4. RBAC

Authorization follows:

```text
Resource + Action
```

using the established permission mechanism, such as:

```ts
@RequirePermissions(resource, action)
```

## 5. Permission Resources

Established resources include:

```text
DASHBOARD
TABLE
POS
KITCHEN
MENU
QR_CODE
BILL
REPORT
STAFF
SETTING
```

Actions include:

```text
VIEW
CREATE
UPDATE
DELETE
PRINT
CONFIRM
EXPORT
```

Do not invent duplicate identifiers.

## 6. Super/System Admin

Preserve the existing system-admin permission bypass behavior. Do not modify it casually.

## 7. Role Activity

If the authorization model includes a role activity state such as `isRoleActive`, do not ignore it.

## 8. Tenant Isolation

Do not trust client-provided tenant identifiers. Validate tenant context against the authenticated user.

Prefer tenant-scoped queries such as:

```text
resourceId + restaurantId/branchId
```

where appropriate.

## 9. Passwords

Passwords MUST:
- be hashed before persistence
- use the established `bcryptjs` mechanism
- never be logged
- never be returned in normal API responses

## 10. Tokens and Secrets

Never:
- log access/refresh tokens
- expose JWT secrets
- expose database credentials
- store plaintext secrets when the design requires hashing

## 11. Environment Files

Never:
- commit `.env`
- expose `.env`
- copy secrets into `.env.example`
- print `.env`
- modify production secrets without explicit authorization

## 12. Input Security

Validate:
- IDs
- enums
- pagination
- unexpected fields
- query parameters

Never pass arbitrary user input directly into MongoDB queries.

## 13. Logging Security

Logs MUST NOT contain passwords, JWT secrets, refresh tokens, authorization headers, database credentials, or unnecessary sensitive personal data.

## 14. CORS and Helmet

Keep CORS and Helmet configuration explicit and deliberate. Do not disable security middleware merely to bypass development problems.

## 15. Authorization Before Data Access

Where possible, enforce tenant ownership inside the data query itself rather than fetching arbitrary resources first and checking ownership afterward.
