import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // 1. Trích xuất Token từ handshake auth hoặc headers hoặc query
      let token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization ||
        (client.handshake.query?.token as string);

      if (token && typeof token === 'string') {
        token = token.replace(/^Bearer\s+/i, '');
        try {
          const decoded = this.jwtService.verify(token);
          client.data.user = decoded;

          const restaurantId = decoded.restaurantId || decoded.user?.restaurantId;
          const branchId = decoded.branchId || decoded.user?.branchId;

          if (restaurantId) {
            const restRoom = `restaurant_${restaurantId}`;
            client.join(restRoom);
            this.logger.log(`Client [${client.id}] joined room ${restRoom}`);

            if (branchId) {
              const branchRoom = `restaurant_${restaurantId}_branch_${branchId}`;
              client.join(branchRoom);
              this.logger.log(`Client [${client.id}] joined branch room ${branchRoom}`);
            }
          }
        } catch (jwtErr: any) {
          this.logger.warn(`Client [${client.id}] token verify failed: ${jwtErr.message}`);
        }
      }

      // 2. Khách quét mã QR tại bàn (hỗ trợ query tableId & restaurantId)
      const tableId = client.handshake.query?.tableId as string;
      const restId = client.handshake.query?.restaurantId as string;

      if (tableId && restId) {
        client.join(`restaurant_${restId}`);
        client.join(`table_${tableId}`);
        this.logger.log(`Guest [${client.id}] joined table room table_${tableId}`);
      }

      this.logger.log(`Socket client connected: ${client.id}`);
    } catch (err: any) {
      this.logger.error(`Error handling socket connection: ${err.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket client disconnected: ${client.id}`);
  }

  /**
   * Client chủ động join room cụ thể (Hardened: Kiểm tra quyền hạn và tenant isolation)
   */
  @SubscribeMessage('join:restaurant')
  handleJoinRestaurant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { restaurantId: string; branchId?: string },
  ) {
    if (data?.restaurantId) {
      // 1. Kiểm tra xác thực staff / admin nếu có JWT trong session
      if (client.data?.user) {
        const userRestId = client.data.user.restaurantId || client.data.user.user?.restaurantId;
        const isSuperAdmin = client.data.user.role === 'SUPER_ADMIN' || client.data.user.user?.role === 'SUPER_ADMIN';
        if (!isSuperAdmin && userRestId && userRestId !== data.restaurantId) {
          this.logger.warn(`[Security] Unauthorized join:restaurant attempt: User from [${userRestId}] tried to join [${data.restaurantId}]`);
          return { success: false, message: 'Unauthorized: Restaurant mismatch' };
        }
      } else {
        // 2. Với khách vãng lai, bắt buộc query handshake (nếu có) phải khớp restaurantId của bàn đã quét
        const queryRestId = client.handshake.query?.restaurantId as string;
        if (queryRestId && queryRestId !== data.restaurantId) {
          this.logger.warn(`[Security] Unauthorized guest join:restaurant attempt: Handshake rest [${queryRestId}] != requested [${data.restaurantId}]`);
          return { success: false, message: 'Unauthorized: Missing or invalid guest restaurant context' };
        }
      }

      const room = `restaurant_${data.restaurantId}`;
      client.join(room);
      if (data.branchId) {
        client.join(`restaurant_${data.restaurantId}_branch_${data.branchId}`);
      }
      return { success: true, message: `Joined ${room}` };
    }
    return { success: false, message: 'Missing restaurantId' };
  }

  @SubscribeMessage('join:table')
  handleJoinTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; restaurantId?: string },
  ) {
    if (data?.tableId) {
      // Hardened: Kiểm tra quyền bàn
      if (client.data?.user) {
        const userRestId = client.data.user.restaurantId || client.data.user.user?.restaurantId;
        const isSuperAdmin = client.data.user.role === 'SUPER_ADMIN' || client.data.user.user?.role === 'SUPER_ADMIN';
        if (!isSuperAdmin && userRestId && data.restaurantId && userRestId !== data.restaurantId) {
          this.logger.warn(`[Security] Unauthorized join:table attempt: User [${userRestId}] tried to join table in [${data.restaurantId}]`);
          return { success: false, message: 'Unauthorized: Restaurant mismatch' };
        }
      } else {
        // Khách vãng lai: Handshake tableId (nếu có) phải khớp tableId được yêu cầu
        const queryTableId = client.handshake.query?.tableId as string;
        if (queryTableId && queryTableId !== data.tableId) {
          this.logger.warn(`[Security] Unauthorized guest join:table attempt: Handshake table [${queryTableId}] != requested [${data.tableId}]`);
          return { success: false, message: 'Unauthorized: Table mismatch' };
        }
      }

      const room = `table_${data.tableId}`;
      client.join(room);
      if (data.restaurantId) {
        client.join(`restaurant_${data.restaurantId}`);
      }
      return { success: true, message: `Joined ${room}` };
    }
    return { success: false, message: 'Missing tableId' };
  }

  /**
   * Lắng nghe sự kiện Order Created từ hệ thống -> Phát sóng cho KDS & POS
   */
  @OnEvent('order.created')
  handleOrderCreatedEvent(payload: { order: any; restaurantId: string; branchId?: string }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:created', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:created', payload);
    }
    this.logger.log(`Broadcast [order:created] to ${restRoom} (Order: ${payload.order?.orderCode})`);
  }

  /**
   * Lắng nghe sự kiện Dish Item Status Updated (Nấu / Xong món / Hủy món)
   */
  @OnEvent('order.item_status_updated')
  handleOrderItemStatusUpdatedEvent(payload: {
    orderId: string;
    itemId: string;
    status: string;
    previousStatus?: string;
    order: any;
    restaurantId: string;
    branchId?: string;
    tableId?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:item_status_updated', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:item_status_updated', payload);
    }

    const tableId =
      payload.tableId ||
      payload.order?.tableId?._id ||
      payload.order?.tableId;
    if (tableId) {
      this.server.to(`table_${tableId}`).emit('order:item_status_updated', payload);
    }

    this.logger.log(
      `Broadcast [order:item_status_updated] to ${restRoom} (Item: ${payload.itemId} -> ${payload.status})`,
    );
  }

  /**
   * Lắng nghe sự kiện Table Status Updated (Mở bàn, chuyển bàn, bàn đổi màu)
   */
  @OnEvent('table.status_updated')
  handleTableStatusUpdatedEvent(payload: {
    table: any;
    restaurantId: string;
    branchId?: string;
    previousTable?: any;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('table:status_updated', payload);
    this.logger.log(`Broadcast [table:status_updated] to ${restRoom} (Table: ${payload.table?.name} -> ${payload.table?.status})`);
  }

  /**
   * Lắng nghe sự kiện Payment Completed (Hoàn tất thanh toán, đóng vé KDS, trả bàn)
   */
  @OnEvent('order.payment_completed')
  handleOrderPaymentCompletedEvent(payload: {
    order: any;
    tableId: string;
    restaurantId: string;
    branchId?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:payment_completed', payload);

    if (payload.tableId) {
      this.server.to(`table_${payload.tableId}`).emit('order:payment_completed', payload);
    }
    this.logger.log(`Broadcast [order:payment_completed] to ${restRoom} (Order: ${payload.order?.orderCode})`);
  }

  /**
   * Lắng nghe sự kiện Round mới được thêm vào đơn hàng (Sub-phase 6.8)
   */
  @OnEvent('order.round_added')
  handleOrderRoundAddedEvent(payload: {
    order: any;
    restaurantId: string;
    branchId?: string;
    roundNumber: number;
    isCustomer?: boolean;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:round_added', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:round_added', payload);
    }
    const tableId = payload.order?.tableId?._id || payload.order?.tableId;
    if (tableId) {
      this.server.to(`table_${tableId}`).emit('order:round_added', payload);
    }
    this.logger.log(`Broadcast [order:round_added] to ${restRoom} (Order: ${payload.order?.orderCode}, Round: ${payload.roundNumber})`);
  }

  /**
   * Lắng nghe sự kiện Round được thu ngân duyệt (Sub-phase 6.8)
   */
  @OnEvent('order.round_confirmed')
  handleOrderRoundConfirmedEvent(payload: {
    order: any;
    restaurantId: string;
    branchId?: string;
    roundNumber: number;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:round_confirmed', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:round_confirmed', payload);
    }
    const tableId = payload.order?.tableId?._id || payload.order?.tableId;
    if (tableId) {
      this.server.to(`table_${tableId}`).emit('order:round_confirmed', payload);
    }
    this.logger.log(`Broadcast [order:round_confirmed] to ${restRoom} (Order: ${payload.order?.orderCode}, Round: ${payload.roundNumber})`);
  }

  /**
   * Lắng nghe sự kiện Round bị hủy/từ chối (Sub-phase 6.8)
   */
  @OnEvent('order.round_cancelled')
  handleOrderRoundCancelledEvent(payload: {
    order: any;
    restaurantId: string;
    branchId?: string;
    roundNumber: number;
    reason?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:round_cancelled', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:round_cancelled', payload);
    }
    const tableId = payload.order?.tableId?._id || payload.order?.tableId;
    if (tableId) {
      this.server.to(`table_${tableId}`).emit('order:round_cancelled', payload);
    }
    this.logger.log(`Broadcast [order:round_cancelled] to ${restRoom} (Order: ${payload.order?.orderCode}, Round: ${payload.roundNumber})`);
  }

  /**
   * Lắng nghe sự kiện khách/nhân viên yêu cầu thanh toán (Sub-phase 6.8)
   */
  @OnEvent('order.payment_requested')
  handleOrderPaymentRequestedEvent(payload: {
    order: any;
    restaurantId: string;
    branchId?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:payment_requested', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:payment_requested', payload);
    }
    const tableId = payload.order?.tableId?._id || payload.order?.tableId;
    if (tableId) {
      this.server.to(`table_${tableId}`).emit('order:payment_requested', payload);
    }
    this.logger.log(`Broadcast [order:payment_requested] to ${restRoom} (Order: ${payload.order?.orderCode})`);
  }

  /**
   * Lắng nghe sự kiện cập nhật đơn hàng tổng quát (Sub-phase 6.8)
   */
  @OnEvent('order.updated')
  handleOrderUpdatedEvent(payload: {
    order: any;
    restaurantId: string;
    branchId?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:updated', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:updated', payload);
    }
    const tableId = payload.order?.tableId?._id || payload.order?.tableId;
    if (tableId) {
      this.server.to(`table_${tableId}`).emit('order:updated', payload);
    }
  }

  /**
   * Lắng nghe sự kiện Order được xác nhận (WaitingConfirmation -> Preparing)
   */
  @OnEvent('order.confirmed')
  handleOrderConfirmedEvent(payload: {
    order: any;
    restaurantId: string;
    branchId?: string;
    tableId?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:confirmed', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:confirmed', payload);
    }
    const tableId = payload.tableId || payload.order?.tableId?._id || payload.order?.tableId;
    if (tableId) {
      this.server.to(`table_${tableId}`).emit('order:confirmed', payload);
    }
    this.logger.log(`Broadcast [order:confirmed] to ${restRoom} (Order: ${payload.order?.orderCode})`);
  }

  /**
   * Lắng nghe sự kiện Hủy đơn hàng (Order Cancelled)
   */
  @OnEvent('order.cancelled')
  handleOrderCancelledEvent(payload: {
    order: any;
    restaurantId: string;
    branchId?: string;
    tableId?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:cancelled', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:cancelled', payload);
    }
    const tableId = payload.tableId || payload.order?.tableId?._id || payload.order?.tableId;
    if (tableId) {
      this.server.to(`table_${tableId}`).emit('order:cancelled', payload);
    }
    this.logger.log(`Broadcast [order:cancelled] to ${restRoom} (Order: ${payload.order?.orderCode})`);
  }

  /**
   * Lắng nghe sự kiện Hủy món đơn lẻ (OrderItem Cancelled)
   */
  @OnEvent('order.item_cancelled')
  handleOrderItemCancelledEvent(payload: {
    orderId: string;
    itemId: string;
    reason?: string;
    order: any;
    restaurantId: string;
    branchId?: string;
    tableId?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:item_cancelled', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:item_cancelled', payload);
    }
    const tableId = payload.tableId || payload.order?.tableId?._id || payload.order?.tableId;
    if (tableId) {
      this.server.to(`table_${tableId}`).emit('order:item_cancelled', payload);
    }
    this.logger.log(`Broadcast [order:item_cancelled] to ${restRoom} (Item: ${payload.itemId})`);
  }

  /**
   * Lắng nghe sự kiện Thay đổi trạng thái Còn/Hết món (Menu Item Availability Changed)
   */
  @OnEvent('menu.availability_changed')
  handleMenuAvailabilityChangedEvent(payload: {
    menuItemId: string;
    item: any;
    isAvailable: boolean;
    effectiveIsAvailable: boolean;
    restaurantId: string;
    branchId?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('menu:availability_changed', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('menu:availability_changed', payload);
    }
    this.logger.log(
      `Broadcast [menu:availability_changed] to ${restRoom} (Item: ${payload.menuItemId} -> ${payload.effectiveIsAvailable ? 'AVAILABLE' : 'OUT_OF_STOCK'})`,
    );
  }
}
