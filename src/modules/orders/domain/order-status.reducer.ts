import { OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.schema';

/**
 * Deterministic reducer suy luan trang thai tong the cua Order tu danh sach OrderItems
 * Single Source of Truth cho trang thai che bien mon va don hang
 */
export function calculateOrderStatus(
  items: OrderItem[],
  currentStatus: OrderStatus,
): OrderStatus {
  // Cac trang thai ket thuc (Terminal States) khong tu dong quay nguoc tru khi co domain action rieng
  if (currentStatus === 'Paid' || currentStatus === 'Cancelled') {
    return currentStatus;
  }

  if (!items || items.length === 0) {
    return currentStatus;
  }

  // Loc cac mon khong bi huy
  const nonCancelled = items.filter((it) => it.status !== 'Cancelled');
  if (nonCancelled.length === 0) {
    // Neu toan bo mon deu bi huy -> Don hang bi huy
    return 'Cancelled';
  }

  // Loc cac mon da duoc xac nhan (loai bo mon con dang WaitingConfirmation cua dot goi moi)
  const confirmedItems = nonCancelled.filter(
    (it) => it.status !== 'WaitingConfirmation',
  );

  // Neu tat ca cac mon deu con o WaitingConfirmation -> Don hang o WaitingConfirmation
  if (confirmedItems.length === 0) {
    return 'WaitingConfirmation';
  }

  // Neu don dang o PaymentRequested va khong co mon moi can che bien -> Giu PaymentRequested
  if (currentStatus === 'PaymentRequested') {
    const hasUncooked = confirmedItems.some(
      (it) => it.status === 'Waiting' || it.status === 'Cooking',
    );
    if (!hasUncooked) {
      return 'PaymentRequested';
    }
  }

  const allServed = confirmedItems.every((it) => it.status === 'Served');
  if (allServed) {
    return 'Served';
  }

  const allReady = confirmedItems.every(
    (it) => it.status === 'Ready' || it.status === 'Served',
  );
  if (allReady) {
    return 'Ready';
  }

  // Neu con it nhat 1 mon la Waiting hoac Cooking -> Preparing
  return 'Preparing';
}
