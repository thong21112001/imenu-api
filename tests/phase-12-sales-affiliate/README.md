# PHASE 12 TEST SUITE: SALES & AFFILIATE PARTNER ECOSYSTEM

## Tổng quan
Bộ test tự động cho Phase 12 kiểm thử toàn diện hệ thống Đối tác kinh doanh & CTV (Sales & Affiliate Partner Ecosystem), bao gồm mã/link giới thiệu, khởi tạo nhà hàng có hỗ trợ, sổ cái hoa hồng 4 tầng, và các chốt chặn concurrency/anti-spam/isolation.

## Cấu trúc Test Suites & Cổng mạng (Ports)

| Suite | File | Port | Số Test Cases | Nội dung kiểm thử |
|-------|------|------|---------------|-------------------|
| **P12-01** | `referral-link-and-code.test.ts` | **3133** | 6 | Xác thực mã giới thiệu public, gửi đơn ứng tuyển CTV, chốt chặn chống spam 24h (`AUD-12.6`), chống tự giới thiệu (`AUD-12.5`), gắn attribution khi đăng ký, tính bất biến của attribution (`AUD-12.3`). |
| **P12-02** | `sales-create-restaurant.test.ts` | **3134** | 5 | Khởi tạo nhà hàng có hỗ trợ (`POST /api/sales/restaurants`), tự động cấp phát 12 bàn demo + 4 món ăn mẫu, cô lập dữ liệu giữa các Sales Rep (`AUD-12.4`), chặn Sales Rep truy cập nghiệp vụ nội bộ (`AUD-12.4`), đăng nhập chủ quán mới. |
| **P12-03** | `commission-engine.test.ts` | **3135** | 9 | Hoa hồng Setup 50%, hoa hồng Gia hạn 20%, chặn trùng mã giao dịch, thưởng kích hoạt 250k khi đủ 5 hóa đơn, đua race condition CAS 10 luồng song song (`AUD-12.1`, `AUD-12.2`), thưởng quản lý đội ngũ 250k cho Sales tuyến trên, chặn nhận thưởng đội ngũ nhiều lần từ 1 CTV, cập nhật STK ngân hàng, truy vấn sổ cái hoa hồng. |
| **P12-SDK**| `packages/utils/tests/sdk-contract.test.ts` | N/A | 47 | Kiểm tra SDK Contract của API Client frontend cho toàn bộ endpoints Sales & Referrals (SDK-39 đến SDK-45). |

## Lệnh thực thi

### 1. Developer Run (Chạy nhanh từng suite hoặc toàn bộ)
```bash
npm run test:phase12:referral
npm run test:phase12:restaurant
npm run test:phase12:commission
npm run test:phase12:all
```

### 2. Final Acceptance Run (Cổng đóng giai đoạn chính thức)
```bash
npm run test:phase12:acceptance
```
Chế độ này thực thi tuần tự toàn bộ các suite bắt buộc, dừng ngay lập tức nếu có bất kỳ lỗi nào, và xuất bảng tổng kết chi tiết.
