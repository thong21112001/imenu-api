import 'dotenv/config';
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/imenu-db-test';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';

const TEST_PORT = 3129;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let app: INestApplication;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function pass(name: string, detail?: string) {
  console.log(`  ${colors.green}✔ PASS:${colors.reset} ${name}${detail ? ` (${detail})` : ''}`);
}

function fail(name: string, error: any) {
  console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${name}`);
  console.error(`    ${colors.red}${error?.stack || error?.message || (typeof error === 'object' ? JSON.stringify(error) : error)}${colors.reset}`);
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  Phase 11 Suite 1: Customer Review Submission & Atomic CAS (Port ${TEST_PORT})   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  try {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(TEST_PORT);

    const connection: Connection = app.get(getConnectionToken());
    const timestamp = Date.now();

    // 1. Setup Test Restaurant & Owner
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        restaurant: {
          name: `P11 Review Test ${timestamp}`,
          phone: '0901112233',
          address: '111 Hai Bà Trưng, Q1, TP.HCM',
        },
        owner: {
          fullName: 'P11 Review Tester',
          phone: '0901112233',
          email: `p11review.${timestamp}@imenu.vn`,
          password: 'Password@123',
        },
      }),
    });

    const restaurantId = regRes.data?.data?.restaurant?.id || regRes.data?.data?.restaurant?._id;
    const ownerToken = regRes.data?.data?.accessToken;

    const restDoc = await connection.collection('restaurants').findOne({ _id: new Types.ObjectId(restaurantId) });
    const branchId = restDoc!.branches[0]._id.toString();
    const restaurantSlug = restDoc!.slug;

    // 2. Setup Category & Menu Items
    const catRes = await request('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Món Chính P11',
        branchIds: [branchId],
      }),
    });
    const categoryId = catRes.data?.data?._id || catRes.data?.data?.id;

    const itemRes = await request('/menu-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Bò Bít Tết Thượng Hạng',
        price: 250000,
        categoryId,
        isAvailable: true,
      }),
    });
    const menuItemId = itemRes.data?.data?._id || itemRes.data?.data?.id;

    // 3. Setup Table Zone
    const zoneRes = await request('/table-zones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Sảnh Chính P11',
        branchId,
      }),
    });
    const zoneId = zoneRes.data?.data?._id || zoneRes.data?.data?.id;

    // Helper to create dedicated table for test isolation
    async function createDedicatedTable(code: string) {
      const tRes = await request('/tables', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          branchId,
          zoneId,
          name: `Bàn ${code}`,
          code,
          capacity: 4,
        }),
      });
      return {
        tableId: tRes.data?.data?._id || tRes.data?.data?.id,
        tableCode: code,
        qrToken: tRes.data?.data?.qrToken,
      };
    }

    // Helper to create & confirm order
    async function createTestOrder(tCode: string, qToken: string) {
      const createRes = await request('/orders/customer', {
        method: 'POST',
        headers: { 'idempotency-key': `idem_${Date.now()}_${Math.random()}` },
        body: JSON.stringify({
          restaurantSlug,
          tableCode: tCode,
          qrToken: qToken,
          items: [{ menuItemId, quantity: 2 }],
        }),
      });

      const ord = createRes.data?.data;
      const oId = ord?._id || ord?.id;
      if (oId) {
        // Staff/Admin confirms the order so it moves to Confirmed
        await request(`/orders/${oId}/confirm`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${ownerToken}` },
        });
        const updated = await connection.collection('orders').findOne({ _id: new Types.ObjectId(oId) });
        return {
          ...ord,
          ...updated,
          id: oId,
          _id: oId,
        };
      }
      return ord;
    }

    // ========================================================================
    // TEST CASES: CUSTOMER REVIEW LIFECYCLE
    // ========================================================================

    // TC-11.1-01: Order status guard (AUD-11.2) - Review rejected when status is Confirmed
    try {
      const table1 = await createDedicatedTable(`TC01_${timestamp}`);
      const order1 = await createTestOrder(table1.tableCode, table1.qrToken);
      const o1Id = (order1._id || order1.id).toString();

      const revRes = await request('/reviews/customer', {
        method: 'POST',
        body: JSON.stringify({
          orderId: o1Id,
          overallRating: 5,
          comment: 'Chưa gọi thanh toán nhưng muốn đánh giá sớm',
          restaurantSlug,
          tableCode: table1.tableCode,
          qrToken: table1.qrToken,
        }),
      });

      if (revRes.status === 400) {
        pass('TC-11.1-01: Chặn gửi đánh giá khi đơn chưa gọi thanh toán (AUD-11.2)', revRes.data?.message);
        passed++;
      } else {
        throw new Error(`Kỳ vọng 400 Bad Request nhưng nhận ${revRes.status}: ${JSON.stringify(revRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.1-01: Order status guard thất bại', err);
      failed++;
    }

    // TC-11.1-02: Review submission during PaymentRequested status
    let order2Id = '';
    let review2Id = '';
    let table2Ref: any;
    try {
      table2Ref = await createDedicatedTable(`TC02_${timestamp}`);
      const order2 = await createTestOrder(table2Ref.tableCode, table2Ref.qrToken);
      order2Id = (order2._id || order2.id).toString();

      // Request payment
      const payReqRes = await request(`/orders/customer/${order2Id}/request-payment`, {
        method: 'POST',
        body: JSON.stringify({
          restaurantSlug,
          tableCode: table2Ref.tableCode,
          qrToken: table2Ref.qrToken,
          paymentMethod: 'VietQR',
        }),
      });

      if (payReqRes.status !== 200 && payReqRes.status !== 201) {
        throw new Error(`Yêu cầu thanh toán thất bại: ${JSON.stringify(payReqRes.data)}`);
      }

      // Submit review
      const revRes = await request('/reviews/customer', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order2Id,
          overallRating: 5,
          foodRating: 5,
          serviceRating: 4,
          ambianceRating: 5,
          quickTags: ['Món ăn ngon', 'Không gian sạch sẽ'],
          comment: 'Bò bít tết rất mềm và ngon miệng!',
          customerName: 'Anh Minh',
          customerPhone: '0912345678',
          restaurantSlug,
          tableCode: table2Ref.tableCode,
          qrToken: table2Ref.qrToken,
        }),
      });

      if (revRes.status === 201 && revRes.data?.data?.overallRating === 5) {
        review2Id = (revRes.data?.data?._id || revRes.data?.data?.id).toString();
        pass('TC-11.1-02: Gửi đánh giá thành công khi đơn ở trạng thái PaymentRequested', `Review ID: ${review2Id}`);
        passed++;
      } else {
        throw new Error(`Kỳ vọng 201 Created nhưng nhận ${revRes.status}: ${JSON.stringify(revRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.1-02: Submit review during PaymentRequested thất bại', err);
      failed++;
    }

    // TC-11.1-03: Order entity verification (isReviewed: true, reviewId set)
    try {
      const orderInDb = await connection.collection('orders').findOne({ _id: new Types.ObjectId(order2Id) });
      if (orderInDb?.isReviewed === true && orderInDb?.reviewId?.toString() === review2Id) {
        pass('TC-11.1-03: Order được cập nhật cờ isReviewed=true và liên kết reviewId chính xác');
        passed++;
      } else {
        throw new Error(`Order DB cờ không khớp: isReviewed=${orderInDb?.isReviewed}, reviewId=${orderInDb?.reviewId}`);
      }
    } catch (err: any) {
      fail('TC-11.1-03: Kiểm tra cờ Order thất bại', err);
      failed++;
    }

    // TC-11.1-04: Submitting review again for already-reviewed order -> 409 Conflict
    try {
      const dupRes = await request('/reviews/customer', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order2Id,
          overallRating: 4,
          comment: 'Đánh giá lần 2 cố tình trùng lặp',
          restaurantSlug,
          tableCode: table2Ref.tableCode,
          qrToken: table2Ref.qrToken,
        }),
      });

      if (dupRes.status === 409) {
        pass('TC-11.1-04: Chặn đánh giá trùng lặp trả về 409 Conflict', dupRes.data?.message);
        passed++;
      } else {
        throw new Error(`Kỳ vọng 409 Conflict nhưng nhận ${dupRes.status}: ${JSON.stringify(dupRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.1-04: Duplicate review prevention thất bại', err);
      failed++;
    }

    // TC-11.1-05: Race condition & Atomic CAS claim (AUD-11.1) - 10 concurrent review submissions
    try {
      const table5 = await createDedicatedTable(`TC05_${timestamp}`);
      const orderRace = await createTestOrder(table5.tableCode, table5.qrToken);
      const orderRaceId = (orderRace._id || orderRace.id).toString();

      // Request payment
      await request(`/orders/customer/${orderRaceId}/request-payment`, {
        method: 'POST',
        body: JSON.stringify({
          restaurantSlug,
          tableCode: table5.tableCode,
          qrToken: table5.qrToken,
          paymentMethod: 'Cash',
        }),
      });

      // Fire 10 concurrent review requests
      const concurrentRequests = Array.from({ length: 10 }).map((_, idx) =>
        request('/reviews/customer', {
          method: 'POST',
          body: JSON.stringify({
            orderId: orderRaceId,
            overallRating: (idx % 5) + 1,
            comment: `Concurrent review attempt #${idx + 1}`,
            restaurantSlug,
            tableCode: table5.tableCode,
            qrToken: table5.qrToken,
          }),
        }),
      );

      const results = await Promise.all(concurrentRequests);
      const successCount = results.filter((r) => r.status === 201).length;
      const conflictCount = results.filter((r) => r.status === 409).length;

      if (successCount === 1 && conflictCount === 9) {
        pass('TC-11.1-05: Atomic CAS claim thành công: 1 thành công (201), 9 bị chặn (409) dưới tải 10 req đồng thời (AUD-11.1)');
        passed++;
      } else {
        throw new Error(`Race condition thất bại: success=${successCount}, conflict=${conflictCount}`);
      }
    } catch (err: any) {
      fail('TC-11.1-05: Atomic CAS race condition thất bại', err);
      failed++;
    }

    // TC-11.1-06: Submission during Paid status
    try {
      const table6 = await createDedicatedTable(`TC06_${timestamp}`);
      const orderPaid = await createTestOrder(table6.tableCode, table6.qrToken);
      const orderPaidId = (orderPaid._id || orderPaid.id).toString();

      // Admin completes payment
      await request(`/orders/${orderPaidId}/complete-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ paymentMethod: 'Cash' }),
      });

      // Submit review post-payment
      const revRes = await request('/reviews/customer', {
        method: 'POST',
        body: JSON.stringify({
          orderId: orderPaidId,
          overallRating: 5,
          comment: 'Đánh giá sau khi thanh toán xong thành công!',
          restaurantSlug,
          tableCode: table6.tableCode,
          qrToken: table6.qrToken,
        }),
      });

      if (revRes.status === 201) {
        pass('TC-11.1-06: Cho phép gửi đánh giá sau khi đơn đã hoàn tất thanh toán (status=Paid)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 201 Created nhưng nhận ${revRes.status}: ${JSON.stringify(revRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.1-06: Post-payment review submission thất bại', err);
      failed++;
    }

    // TC-11.1-07: Anti-IDOR table mismatch (AUD-11.3)
    try {
      const table7A = await createDedicatedTable(`TC07A_${timestamp}`);
      const table7B = await createDedicatedTable(`TC07B_${timestamp}`);

      const orderB = await createTestOrder(table7B.tableCode, table7B.qrToken);
      const orderBId = (orderB._id || orderB.id).toString();

      // Request payment for Table B
      await request(`/orders/customer/${orderBId}/request-payment`, {
        method: 'POST',
        body: JSON.stringify({
          restaurantSlug,
          tableCode: table7B.tableCode,
          qrToken: table7B.qrToken,
          paymentMethod: 'VietQR',
        }),
      });

      // Attacker at Table A attempts to review Table B's order
      const idorRes = await request('/reviews/customer', {
        method: 'POST',
        body: JSON.stringify({
          orderId: orderBId,
          overallRating: 1,
          comment: 'Tấn công IDOR đánh giá phá hoại',
          restaurantSlug,
          tableCode: table7A.tableCode,
          qrToken: table7A.qrToken, // Using Table A's token!
        }),
      });

      if (idorRes.status === 404 || idorRes.status === 403) {
        pass('TC-11.1-07: Anti-IDOR: Chặn quét mã bàn A gửi review cho đơn bàn B trả về 404/403 (AUD-11.3)', idorRes.data?.message);
        passed++;
      } else {
        throw new Error(`Kỳ vọng 404 hoặc 403 nhưng nhận ${idorRes.status}: ${JSON.stringify(idorRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.1-07: Anti-IDOR guard thất bại', err);
      failed++;
    }

    // TC-11.1-08: Validation guard rating out of bounds (AUD-11.6)
    try {
      const table8 = await createDedicatedTable(`TC08_${timestamp}`);
      const orderVal = await createTestOrder(table8.tableCode, table8.qrToken);
      const orderValId = (orderVal._id || orderVal.id).toString();

      await request(`/orders/customer/${orderValId}/request-payment`, {
        method: 'POST',
        body: JSON.stringify({
          restaurantSlug,
          tableCode: table8.tableCode,
          qrToken: table8.qrToken,
          paymentMethod: 'VietQR',
        }),
      });

      const invalidRatingRes = await request('/reviews/customer', {
        method: 'POST',
        body: JSON.stringify({
          orderId: orderValId,
          overallRating: 6, // Invalid rating > 5
          comment: 'Điểm 6 sao không hợp lệ',
          restaurantSlug,
          tableCode: table8.tableCode,
          qrToken: table8.qrToken,
        }),
      });

      if (invalidRatingRes.status === 400) {
        pass('TC-11.1-08: Validation Guard: Chặn rating > 5 trả về 400 Bad Request (AUD-11.6)');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 400 Bad Request nhưng nhận ${invalidRatingRes.status}`);
      }
    } catch (err: any) {
      fail('TC-11.1-08: Rating validation guard thất bại', err);
      failed++;
    }

    // TC-11.1-09: Validation guard comment length > 500 characters
    try {
      const table9 = await createDedicatedTable(`TC09_${timestamp}`);
      const orderVal = await createTestOrder(table9.tableCode, table9.qrToken);
      const orderValId = (orderVal._id || orderVal.id).toString();

      await request(`/orders/customer/${orderValId}/request-payment`, {
        method: 'POST',
        body: JSON.stringify({
          restaurantSlug,
          tableCode: table9.tableCode,
          qrToken: table9.qrToken,
          paymentMethod: 'VietQR',
        }),
      });

      const longComment = 'A'.repeat(501);
      const invalidCommentRes = await request('/reviews/customer', {
        method: 'POST',
        body: JSON.stringify({
          orderId: orderValId,
          overallRating: 5,
          comment: longComment,
          restaurantSlug,
          tableCode: table9.tableCode,
          qrToken: table9.qrToken,
        }),
      });

      if (invalidCommentRes.status === 400) {
        pass('TC-11.1-09: Validation Guard: Chặn comment > 500 ký tự trả về 400 Bad Request');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 400 Bad Request nhưng nhận ${invalidCommentRes.status}`);
      }
    } catch (err: any) {
      fail('TC-11.1-09: Comment length validation guard thất bại', err);
      failed++;
    }

    // TC-11.1-10: Read review by order endpoint with valid credentials
    try {
      const getRevRes = await request(
        `/reviews/customer/by-order/${order2Id}?restaurantSlug=${restaurantSlug}&tableCode=${table2Ref.tableCode}&qrToken=${table2Ref.qrToken}`,
      );

      if (getRevRes.status === 200 && (getRevRes.data?.data?._id === review2Id || getRevRes.data?.data?.id === review2Id)) {
        pass('TC-11.1-10: Khách hàng đọc lại đánh giá của đơn hàng thành công qua GET /reviews/customer/by-order/:id');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 200 OK với reviewId=${review2Id} nhưng nhận ${getRevRes.status}: ${JSON.stringify(getRevRes.data)}`);
      }
    } catch (err: any) {
      fail('TC-11.1-10: Read review by order thất bại', err);
      failed++;
    }

    // TC-11.1-11: Read review by order with mismatched table credentials -> 404 or 403
    try {
      const otherTable = await createDedicatedTable(`TC11_${timestamp}`);
      const getRevRes = await request(
        `/reviews/customer/by-order/${order2Id}?restaurantSlug=${restaurantSlug}&tableCode=${otherTable.tableCode}&qrToken=${otherTable.qrToken}`,
      );

      if (getRevRes.status === 404 || getRevRes.status === 403) {
        pass('TC-11.1-11: Chặn bàn khác đọc trộm nội dung đánh giá của đơn bàn khác trả về 404/403');
        passed++;
      } else {
        throw new Error(`Kỳ vọng 404 hoặc 403 nhưng nhận ${getRevRes.status}`);
      }
    } catch (err: any) {
      fail('TC-11.1-11: Anti-leak read review by order thất bại', err);
      failed++;
    }

  } catch (globalErr: any) {
    console.error('Lỗi khởi tạo test suite:', globalErr);
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Kết quả Phase 11 Suite 1: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
