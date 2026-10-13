# ĐẶC TẢ KIẾN TRÚC TƯƠNG THÍCH MÁY IN NHIỆT HÓA ĐƠN 80MM (ESC/POS)
## PHASE 8 ARCHITECTURAL SPECIFICATION & HARDWARE INTEGRATION BOUNDARIES

> **Dự án:** Hệ sinh thái quản lý nhà hàng F&B All-in-One iMenu  
> **Phân hệ lập đặc tả:** Sub-phase 6.9 (Tài liệu kiến trúc chuẩn bị cho Phase 8: Payment & Bill)  
> **Vai trò:** Principal Software Architect & Technical Lead  
> **Trạng thái:** **SPECIFICATION COMPLETE — ARCHITECTURE BLUEPRINT ONLY (NO HARDWARE CODE IN PHASE 6.9)**  
> **Thời điểm công bố:** 2026-10-13  

---

## 1. MỤC ĐÍCH TÀI LIỆU

Tài liệu này đóng vai trò là ranh giới kiến trúc và bản đặc tả kỹ thuật chuẩn bị cho việc tích hợp máy in hóa đơn nhiệt phần cứng (Hardware Thermal Printer khổ 80mm/58mm) trong **Phase 8: Payment & Bill**.

Theo quyết định đã khóa của Product Owner tại Sub-phase 6.9:
- **Tuyệt đối KHÔNG triển khai driver phần cứng, WebUSB/WebSerial transport, raw ESC/POS binary builder, socket in hoặc print daemon trong Sub-phase 6.9.**
- Mọi nghiên cứu và phân tích được ghi nhận ở cấp độ kiến trúc để đảm bảo tính sẵn sàng mở rộng mà không làm ô nhiễm mã nguồn của Phase 6.

---

## 2. HIỆN TRẠNG IN ẤN TRONG MÃ NGUỒN (CURRENT IMPLEMENTATION BASELINE)

### 2.1. Điểm kích hoạt in (Print Entry Points)
- **Vị trí 1 (Bills Management):** Nút *"In Hóa Đơn 80mm Ngay"* kích hoạt hàm `handlePrintReceipt` tại `apps/imenu-admin/src/app/bills/page.tsx` (dòng 126).
- **Vị trí 2 (QR Codes Standee):** Nút *"In mã QR Standee / Sticker"* tại `apps/imenu-admin/src/app/qr-codes/page.tsx` (dòng 517).

### 2.2. Cơ chế in ấn hiện tại
- Hệ thống sử dụng lệnh tiêu chuẩn của trình duyệt: `window.print()`.
- Giao diện hóa đơn được định kiểu trực tiếp bằng Tailwind CSS kết hợp CSS Media Query:
  ```css
  @media print {
    body * { visibility: hidden; }
    .print-receipt-container, .print-receipt-container * { visibility: visible; }
    .print-receipt-container { position: absolute; left: 0; top: 0; width: 76mm; }
  }
  ```
- **Hạn chế kỹ thuật:**
  - Bắt buộc phải hiện hộp thoại in của trình duyệt (Browser Print Dialog) và yêu cầu người dùng nhấn "Print" hoặc "Enter".
  - Không thể tự động cắt giấy (Auto-cut), không thể mở két tiền tự động (Open Cash Drawer qua xung điện rj11 pin 2/5).
  - Phụ thuộc vào driver máy in đã được cài đặt trên hệ điều hành máy khách và cấu hình khổ giấy khổ 80mm không có lề (Margin: None).

---

## 3. PHÂN TÁCH TẦNG DỰNG VÀ TẦNG GIAO VẬN (SEPARATION OF RENDERING & TRANSPORT)

Kiến trúc in nhiệt chuyên nghiệp của iMenu trong Phase 8 sẽ phân tách thành 3 tầng độc lập:

```text
+-------------------------------------------------------------------------------+
|                           1. TẦNG NGHIỆP VỤ & DỮ LIỆU                         |
|      Domain Order Entity, Restaurant Config, Staff Profile, VietQR Payload    |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       2. TẦNG ĐỊNH DẠNG HÓA ĐƠN TRUNG GIAN                    |
|                        ReceiptData Model (Device-Agnostic)                     |
|           Chuẩn hóa font, căn lề, ngắt dòng, bảng món, tổng kết thuế/phí      |
+-------------------------------------------------------------------------------+
                                        |
                    +-------------------+-------------------+
                    |                                       |
                    v                                       v
+---------------------------------------+   +-----------------------------------+
|      A. TẦNG BROWSER PRINT ADAPTER    |   |    B. TẦNG ESC/POS COMMAND BUILDER|
|         (@media print / HTML DOM)     |   |   (Byte Array / Buffer Serializer)|
+---------------------------------------+   +-----------------------------------+
                    |                                       |
                    v                                       +-------------------+
            Máy in ảo / PDF OS                              |                   |
                                                            v                   v
                                                    +---------------+   +---------------+
                                                    | WebUSB/Serial |   | Local Gateway |
                                                    | (Desktop POS) |   | (LAN / IP:9100|
                                                    +---------------+   +---------------+
```

---

## 4. HỢP ĐỒNG DỮ LIỆU HÓA ĐƠN BẤT BIẾN (STABLE RECEIPT DATA CONTRACT)

Trong Phase 8, package `@imenu/types` sẽ bổ sung interface chuẩn `ReceiptData` độc lập với DOM:

```typescript
export interface ReceiptItemLine {
  name: string;              // Tên món (tối đa 24 ký tự trên 1 dòng khổ 80mm)
  quantity: number;          // Số lượng
  unitPrice: number;         // Đơn giá snapshot
  amount: number;            // Thành tiền dòng
  selectedOptionsNote?: string; // Tùy chọn đi kèm: "Phần lớn, Ít cay"
  note?: string;             // Ghi chú đặc biệt
}

export interface ReceiptData {
  header: {
    restaurantName: string;
    brandTagline?: string;
    branchName: string;
    address: string;
    hotline: string;
    wifiSsid?: string;
    wifiPassword?: string;
  };
  metadata: {
    receiptType: 'PRE_BILL' | 'FINAL_BILL';
    orderCode: string;
    tableName: string;
    cashierName: string;
    createdAt: string | Date;
    paidAt?: string | Date;
  };
  items: ReceiptItemLine[];
  financials: {
    subTotal: number;
    discountAmount: number;
    taxableAmount: number;
    serviceFee: number;
    vatPercent: number;
    vatAmount: number;
    totalAmount: number;
    paymentMethod?: 'Cash' | 'VietQR' | 'Card' | 'Transfer';
    cashGiven?: number;
    cashChange?: number;
  };
  paymentQr?: {
    vietQrPayloadUrl: string; // URL sinh mã VietQR Napas 247
    accountNo: string;
    bankName: string;
    accountName: string;
  };
  footer: {
    thankYouMessage: string;
    softwareCredit: string;
  };
}
```

---

## 5. ĐẶC TẢ TẬP LỆNH MÃ HÓA ESC/POS (ESC/POS COMMAND ENCODING)

Bộ giải mã nhị phân `EscPosEncoder` trong Phase 8 sẽ biên dịch `ReceiptData` thành mảng `Uint8Array` theo tiêu chuẩn ESC/POS:

| Thao tác | Mã ESC/POS (Hex) | Ý nghĩa kỹ thuật |
| :--- | :--- | :--- |
| **Initialize** | `1B 40` (`ESC @`) | Reset toàn bộ trạng thái máy in về mặc định |
| **Align Left** | `1B 61 00` (`ESC a 0`) | Căn lề trái (áp dụng cho danh mục món ăn) |
| **Align Center**| `1B 61 01` (`ESC a 1`) | Căn giữa (áp dụng cho Header, Tên nhà hàng, VietQR, Footer) |
| **Bold On/Off**| `1B 45 01` / `1B 45 00` | Bật / tắt in đậm |
| **Double Height**| `1D 21 01` (`GS ! 1`) | Phóng to chiều cao chữ (áp dụng cho Tổng tiền, Tên quán) |
| **Line Feed** | `0A` (`LF`) | Đẩy dòng |
| **Feed & Cut** | `1D 56 42 00` (`GS V B 0`) | Đẩy giấy qua lưỡi dao và thực hiện cắt đứt 1 phần (Partial Cut) |
| **Kick Drawer**| `1B 70 00 19 FA` | Kích xung điện chân 2 mở két đựng tiền thu ngân tự động |
| **Print QR Code**| `1D 28 6B ...` (`GS ( k`) | Sử dụng module mã hóa 2D barcode in mã VietQR trực tiếp |

---

## 6. RANH GIỚI GIAO VẬN VÀ THIẾT BỊ VẬT LÝ (TRANSPORT ADAPTER BOUNDARIES)

Phase 8 sẽ đánh giá và hỗ trợ 2 cơ chế kết nối thiết bị phần cứng:

### 6.1. Phương án A: WebUSB / WebSerial Adapter (Dành cho PC Thu ngân kết nối trực tiếp cáp USB)
- **Ưu điểm:** Không cần cài đặt bất kỳ phần mềm nền nào trên máy tính; trình duyệt Chrome tự giao tiếp với chip USB của máy in (thường là chip Silicon Labs CP210x, CH340 hoặc Prolific).
- **Cơ chế:**
  ```javascript
  // Phase 8 Planned Flow
  const device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x0fe6 }] }); // ID của Xprinter/Epson
  await device.open();
  await device.selectConfiguration(1);
  await device.claimInterface(0);
  await device.transferOut(endpointNumber, escPosBuffer);
  ```
- **Rào cản:** Bắt buộc giao thức HTTPS hoặc localhost; người dùng phải bấm cấp quyền thiết bị trong lần đầu tiên.

### 6.2. Phương án B: Local Print Gateway Daemon / LAN Socket Adapter (Dành cho chuỗi hoặc iPad/Tablet)
- **Ưu điểm:** Khắc phục việc iPad/Tablet hoặc điện thoại không thể cắm dây USB vào máy in.
- **Cơ chế:**
  - Máy in được cắm dây mạng LAN IP tĩnh (VD: `192.168.1.200:9100`).
  - Trình duyệt POS gửi lệnh in qua WebSocket tới một tiến trình daemon siêu nhẹ chạy tại quầy (Local Daemon Node.js / Go) hoặc gửi raw socket trực tiếp nếu mạng nội bộ cho phép.

---

## 7. CÁC RÀO CẢN VÀ THÁCH THỨC TIẾNG VIỆT CẦN GIẢI QUYẾT Ở PHASE 8

1. **Bộ mã ký tự tiếng Việt (Vietnamese Encoding):** Các máy in hóa đơn ESC/POS giá rẻ tại Việt Nam thường không hỗ trợ UTF-8 nguyên bản trên ROM mà chỉ hỗ trợ bảng mã mở rộng Code Page 858 hoặc TCVN3 (ABC).
   - *Giải pháp cho Phase 8:* Cung cấp 2 chế độ:
     1) In tiếng Việt không dấu (Loại bỏ dấu bằng `slugify` / Unicode normalization) — 100% máy in đọc được.
     2) In tiếng Việt có dấu dạng đồ họa Bitmap (Raster Bit Image Mode `GS v 0`) — Cho chất lượng sắc nét trên mọi loại máy in.
2. **Kích thước độ rộng dòng:**
   - Khổ 80mm: Độ rộng tiêu chuẩn là 48 ký tự font A (12x24) hoặc 64 ký tự font B (9x17).
   - Khổ 58mm: Độ rộng tiêu chuẩn là 32 ký tự font A.

---

## 8. KẾT LUẬN VÀ CHUYỂN GIAO CHO PHASE 8

Tài liệu này xác nhận:
- Toàn bộ cơ sở lý thuyết và hợp đồng dữ liệu cho máy in nhiệt đã được chuẩn hóa.
- **Không có bất kỳ sự thay đổi mã nguồn nào đối với runtime của Sub-phase 6.9.**
- Phase 8 sẽ tiếp quản toàn bộ đặc tả này để triển khai module `ReceiptPrinterService` và các adapter thiết bị tương ứng.
