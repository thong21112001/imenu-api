---
description: MongoDB and Mongoose rules for schema design, indexes, queries, references, embedded documents, and data integrity.
alwaysApply: true
---

# IMENU API - MONGODB / MONGOOSE RULES

## 1. Database Standard

The project uses MongoDB + Mongoose + `@nestjs/mongoose`.

Do not introduce PostgreSQL, Prisma, TypeORM, Sequelize, or another database abstraction unless explicitly requested.

## 2. Schema Design

Mongoose schemas MUST clearly define:
- field types
- required fields
- defaults
- enums
- indexes where necessary
- references
- timestamps where appropriate

## 3. Embedded Documents

Use embedded subdocuments for tightly coupled data or historical snapshots.

Examples:
- order item snapshots
- selected options
- option values
- bill line items

Historical order/bill information must not unexpectedly change when the source menu item changes.

## 4. References

Use references for independently managed entities, such as:
- User → Role
- User → Restaurant
- User → Branch
- Order → Restaurant
- Order → Table

Do not embed large independently managed entities without a domain reason.

## 5. Indexes

Consider indexes for:
- frequently queried fields
- unique identifiers
- tenant isolation fields
- authentication fields
- timestamps used for sorting/filtering
- QR tokens
- slugs
- references

Avoid blindly indexing every field.

## 6. Unique Constraints

When uniqueness is required, enforce it at the database/index level where appropriate. Application-only existence checks are insufficient under concurrency.

## 7. Tenant Isolation

Tenant-owned queries MUST apply the appropriate tenant boundary, such as `restaurantId` and/or `branchId`.

A Restaurant A user MUST NOT access Restaurant B resources.

## 8. Query Safety

Avoid unbounded queries. Prefer pagination, explicit limits, indexed filters, controlled sorting, and projections where useful.

Never expose arbitrary MongoDB operators directly through HTTP input.

## 9. Pagination

Use the project's standard pagination DTO and response format. Always enforce reasonable limits.

## 10. Populate

Use `populate()` only when required. Avoid deeply nested population chains. Prefer projection/aggregation when justified while preserving response compatibility.

## 11. Updates

Prefer targeted partial updates. Ensure `$set`, `$unset`, `$push`, `$pull`, and `$addToSet` do not overwrite unrelated fields.

## 12. Destructive Operations

Without explicit authorization, NEVER execute:
- `dropDatabase`
- `dropCollection`
- `deleteMany({})`
- unsafe `updateMany(...)`
- production reset scripts
- production seed resets

Always verify destructive filters.

## 13. Seed Data

System seed data should be deterministic and idempotent where possible.

Expected system roles include:

```text
SYSTEM_ADMIN
RESTAURANT_ADMIN
RESTAURANT_MANAGER
CASHIER
KITCHEN
WAITER
```

Do not create duplicates on repeated startup.

## 14. Historical Data

Orders/bills that store item name, price, options, and quantity should preserve those values as historical snapshots when required by the domain.

Do not replace historical snapshots with live menu references unless explicitly required.
