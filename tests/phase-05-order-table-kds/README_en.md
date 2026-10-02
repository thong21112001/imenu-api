# Integration Test Phase 5: Order Management, Floor Plan & Realtime KDS WebSocket

Comprehensive automated integration test suite for Phase 5 of the **iMenu API** system, covering: Table Zones & Floor Plan Management, Table Operations (Occupancy, Transfer Table, Merge Tables), Order Placement via POS (Price & Item Snapshot), WebSocket Realtime Synchronization to Kitchen Display System (`order:created`, `order:item_status_updated`, `table:status_updated`, `order:payment_completed`), Order Checkout (VietQR & Cash), 5-Role RBAC Matrix enforcement, and Multi-Tenant Isolation.

---

## 📋 18 Test Cases Overview

| No. | Case Code | Tested Workflow | Technical Expectation | Status |
|:---:|:---|:---|:---|:---:|
| 1 | `TC-P5-01` | Create new Table Zone | Table zone created successfully, HTTP 201 Created | ✅ PASS |
| 2 | `TC-P5-02` | Create tables within zone | B01, B02, B03 created with `Available` status, HTTP 201 Created | ✅ PASS |
| 3 | `TC-P5-03` | Unique table code constraint | Duplicate code B01 rejected with HTTP 409 Conflict | ✅ PASS |
| 4 | `TC-P5-04` | List tables with populated zones | Query tables list, zone documents populated correctly, HTTP 200 OK | ✅ PASS |
| 5 | `TC-P5-05` | Cashier places POS Order | Order created with DB price snapshots; Table B01 becomes `Occupied` | ✅ PASS |
| 6 | `TC-P5-06` | WebSocket Event `order:created` | Kitchen KDS client receives realtime event in restaurant room | ✅ PASS |
| 7 | `TC-P5-07` | Waiter adds items to open table | Additional items appended, totals updated, HTTP 200 OK | ✅ PASS |
| 8 | `TC-P5-08` | KDS updates item to Cooking | Dish item marked `Cooking`, order status becomes `Preparing` | ✅ PASS |
| 9 | `TC-P5-09` | KDS updates item to Ready | Dish item marked `Ready`, ready chime event broadcast | ✅ PASS |
| 10 | `TC-P5-10` | Transfer Table (B01 -> B02) | Order moved to B02 (`Occupied`); B01 released to `Available` | ✅ PASS |
| 11 | `TC-P5-11` | Merge Tables | Items merged into target table; secondary tables released | ✅ PASS |
| 12 | `TC-P5-12` | RBAC: Waiter blocked from payment | Waiter cannot process checkout, HTTP 403 Forbidden | ✅ PASS |
| 13 | `TC-P5-13` | RBAC: Kitchen blocked from tables | Kitchen staff cannot create/edit tables, HTTP 403 Forbidden | ✅ PASS |
| 14 | `TC-P5-14` | Cashier checkout via VietQR | Order marked `Paid`; Table released to `Available` | ✅ PASS |
| 15 | `TC-P5-15` | Prevent deleting occupied table | Deleting table with active guests rejected, HTTP 400 Bad Request | ✅ PASS |
| 16 | `TC-P5-16` | Multi-Tenant Data Isolation | Restaurant B cannot access Restaurant A orders/tables (404/403) | ✅ PASS |
| 17 | `TC-P5-17` | Demo account seamless trial | Demo cashier account creates order & updates status without demo block | ✅ PASS |
| 18 | `TC-P5-18` | Auto-seed default floor plan | `POST /tables/seed-default` creates 4 zones and 12 tables | ✅ PASS |

---

## 🚀 Execution Commands

```bash
cd imenu-api
npm run test:phase5
```
