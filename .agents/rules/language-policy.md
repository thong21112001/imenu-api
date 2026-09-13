---
description: Language and AI communication policy for the imenu-api project.
alwaysApply: true
---

# IMENU API - LANGUAGE POLICY

## 1. Technical Language

Use precise software-engineering terminology for architecture, code conventions, constraints, and implementation plans.

## 2. Rule Keywords

Interpret:
- `MUST` = mandatory
- `MUST NOT` = prohibited
- `SHOULD` = strong recommendation unless justified otherwise
- `SHOULD NOT` = strong recommendation to avoid
- `MAY` = optional

## 3. User Requests

Understand user requests in Vietnamese or English. Always apply project rules regardless of the user's language.

## 4. Code Language

Use English for:
- class names
- methods
- variables
- DTOs
- interfaces
- enums
- constants
- file names
- technical code comments

Avoid Vietnamese identifiers.

Preferred:

```ts
getUserById()
```

Avoid:

```ts
layNguoiDungTheoId()
```

## 5. Comments

Comments should explain why something exists, especially non-obvious business, security, or architectural constraints. Avoid comments that merely restate code.

## 6. User-Facing Communication

Vietnamese may be used when the user communicates in Vietnamese. Standard technical terms may remain in English.
