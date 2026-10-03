import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../entities/order.entity';
import { RoundStatus } from '../entities/order-round.schema';
import { OrderItemStatus } from '../entities/order-item.schema';

/**
 * Ma tran chuyen doi trang thai hop le cua Order
 */
const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  WaitingConfirmation: ['Preparing', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Served', 'Cancelled'],
  Ready: ['Served', 'Preparing', 'Cancelled'],
  Served: ['Preparing', 'PaymentRequested', 'Cancelled'],
  PaymentRequested: ['Paid', 'Served', 'Cancelled'],
  Paid: [], // Terminal State
  Cancelled: [], // Terminal State
};

/**
 * Ma tran chuyen doi trang thai hop le cua OrderRound
 */
const ALLOWED_ROUND_TRANSITIONS: Record<RoundStatus, RoundStatus[]> = {
  WaitingConfirmation: ['Confirmed', 'Cancelled'],
  Confirmed: [], // Terminal State
  Cancelled: [], // Terminal State
};

/**
 * Ma tran chuyen doi trang thai hop le cua OrderItem (KDS Single Source of Truth)
 */
const ALLOWED_ITEM_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
  WaitingConfirmation: ['Waiting', 'Cancelled'],
  Waiting: ['Cooking', 'Cancelled'],
  Cooking: ['Ready', 'Cancelled'],
  Ready: ['Served', 'Cancelled'],
  Served: ['Cancelled'],
  Cancelled: [], // Terminal State
};

export class OrderStateValidator {
  /**
   * Kiem tra tinh hop le khi chuyen trang thai Order
   */
  static validateOrderTransition(
    currentStatus: OrderStatus,
    targetStatus: OrderStatus,
  ): void {
    if (currentStatus === 'Paid' || currentStatus === 'Cancelled') {
      throw new BadRequestException(
        `Khong the thay doi trang thai cua don hang da ket thuc (${currentStatus})`,
      );
    }

    if (currentStatus === targetStatus) {
      return; // Giu nguyen trang thai thi hop le
    }

    const allowed = ALLOWED_ORDER_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Chuyen doi trang thai Order khong hop le: ${currentStatus} -> ${targetStatus}`,
      );
    }
  }

  /**
   * Kiem tra tinh hop le khi chuyen trang thai Round (Dot goi mon)
   */
  static validateRoundTransition(
    currentStatus: RoundStatus,
    targetStatus: RoundStatus,
  ): void {
    if (currentStatus === 'Confirmed' || currentStatus === 'Cancelled') {
      throw new BadRequestException(
        `Khong the thay doi trang thai dot goi da hoan tat (${currentStatus})`,
      );
    }

    if (currentStatus === targetStatus) {
      return;
    }

    const allowed = ALLOWED_ROUND_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Chuyen doi trang thai Round khong hop le: ${currentStatus} -> ${targetStatus}`,
      );
    }
  }

  /**
   * Kiem tra tinh hop le khi Bep/Thu ngan chuyen trang thai OrderItem
   */
  static validateItemTransition(
    currentStatus: OrderItemStatus,
    targetStatus: OrderItemStatus,
    isOrderPaid = false,
  ): void {
    if (isOrderPaid) {
      throw new BadRequestException(
        'Khong the thay doi trang thai mon an cua don hang da thanh toan (Paid)',
      );
    }

    if (currentStatus === 'Cancelled') {
      throw new BadRequestException(
        'Khong the thay doi trang thai cua mon an da bi huy (Cancelled)',
      );
    }

    if (currentStatus === targetStatus) {
      return;
    }

    const allowed = ALLOWED_ITEM_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Chuyen doi trang thai mon an khong hop le: ${currentStatus} -> ${targetStatus}`,
      );
    }
  }
}
