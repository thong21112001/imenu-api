---
description: API contract rules covering DTOs, responses, pagination, errors, HTTP semantics, and Swagger documentation.
alwaysApply: true
---

# IMENU API - API CONTRACT RULES

## 1. API Compatibility

Existing API contracts are stable.

Preserve unless explicitly changed:
- endpoint paths
- HTTP methods
- DTO field names
- response field names
- authentication behavior
- pagination structure
- error structure

## 2. Response Format

Follow the existing implementation first.

If the established project format is:

```json
{
  "message": "Success",
  "data": {}
}
```

preserve it.

For pagination, if the established format is:

```json
{
  "total": 0,
  "page": 1,
  "limit": 10,
  "totalPages": 0,
  "data": []
}
```

preserve it.

Never invent a new response envelope for one endpoint.

## 3. DTOs

Use DTOs for external request input and where useful for documented response models.

## 4. Validation

Use appropriate `class-validator` decorators for malformed or invalid external input.

## 5. Errors

Use the project's global exception handling strategy. Do not return inconsistent custom error envelopes.

## 6. HTTP Status Codes

Use meaningful status codes:
- 200 OK
- 201 Created
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict
- 422 Unprocessable Entity
- 500 Internal Server Error

Follow existing project conventions where they differ.

## 7. Pagination

Pagination must be predictable and constrained. Do not allow unlimited result requests.

## 8. Search

Sanitize and constrain search parameters. Never expose arbitrary MongoDB query operators or regex behavior directly from clients.

## 9. Swagger

Public APIs SHOULD be documented with Swagger metadata:
- purpose
- request body
- DTO
- response
- authentication
- relevant status codes

Expected location:

```text
/api-docs
```

unless project configuration differs.

## 10. Authentication Documentation

Protected endpoints SHOULD clearly communicate JWT requirements in Swagger. Public endpoints should use the established public-route mechanism.

## 11. Breaking Changes

Breaking changes include:
- removing endpoints
- renaming fields
- changing field types
- changing authentication requirements
- changing status semantics
- changing pagination format

Require explicit user approval.

## 12. Backward Compatibility

Prefer additive changes over replacement changes whenever possible.
