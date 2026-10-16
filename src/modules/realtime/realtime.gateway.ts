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
        // Hardening AUD-7.4: Khách vãng lai CHỈ tham gia room bàn riêng và room public thực đơn
        client.join(`public_menu_${restId}`);
        client.join(`table_${tableId}`);
        this.logger.log(`Guest [${client.id}] joined table room table_${tableId} and public_menu_${restId}`);
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
      // 1. Hardening AUD-7.4: Chỉ nhân viên/quản lý có JWT hợp lệ mới được join phòng restaurant_${restId}
      if (!client.data?.user) {
        this.logger.warn(`[Security] Unauthorized guest join:restaurant attempt: Guests cannot join staff restaurant room`);
        return { success: false, message: 'Unauthorized: Guests cannot join staff restaurant room' };
      }

      const userRestId = client.data.user.restaurantId || client.data.user.user?.restaurantId;
      const isSuperAdmin = client.data.user.role === 'SUPER_ADMIN' || client.data.user.user?.role === 'SUPER_ADMIN';
      if (!isSuperAdmin && userRestId && userRestId !== data.restaurantId) {
        this.logger.warn(`[Security] Unauthorized join:restaurant attempt: User from [${userRestId}] tried to join [${data.restaurantId}]`);
        return { success: false, message: 'Unauthorized: Restaurant mismatch' };
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
        if (client.data?.user) {
          client.join(`restaurant_${data.restaurantId}`);
        } else {
          // Hardening AUD-7.4: Khách vãng lai chỉ join room public_menu
          client.join(`public_menu_${data.restaurantId}`);
        }
      }
      return { success: true, message: `Joined ${room}` };
    }
    return { success: false, message: 'Missing tableId' };
  }

  /**
   * Chuyển đổi chi nhánh làm việc (Sub-phase 10.2: Hỗ trợ HQ switch branch & cô lập chi nhánh con)
   */
  @SubscribeMessage('switch:branch')
  handleSwitchBranch(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      restaurantId?: string;
      fromBranchId?: string;
      toBranchId?: string;
      branchId?: string;
    },
  ) {
    if (!client.data?.user) {
      this.logger.warn(`[Security] Unauthorized switch:branch attempt: Unauthenticated socket [${client.id}]`);
      return { success: false, message: 'Unauthorized: Missing user authentication' };
    }

    const user = client.data.user.user || client.data.user;
    const isSuperAdmin = user.role === 'SUPER_ADMIN' || client.data.user.role === 'SUPER_ADMIN';
    const isMainBranch = Boolean(user.isMainBranch || client.data.user.isMainBranch);
    const userBranchId = user.branchId || client.data.user.branchId;
    const targetBranchId = data.toBranchId || data.branchId;

    // Phân lập chi nhánh: Nhân viên chi nhánh con không được phép chuyển sang chi nhánh khác
    if (!isSuperAdmin && !isMainBranch && userBranchId) {
      if (targetBranchId && targetBranchId !== userBranchId) {
        this.logger.warn(
          `[Security] Forbidden switch:branch attempt: Staff from branch [${userBranchId}] tried to switch to [${targetBranchId}]`,
        );
        return { success: false, message: 'Forbidden: Branch isolation' };
      }
    }

    const restId = data.restaurantId || user.restaurantId || client.data.user.restaurantId;
    if (!restId) {
      return { success: false, message: 'Missing restaurantId' };
    }

    // 1. Rời các phòng branch cũ của nhà hàng đó
    const prefix = `restaurant_${restId}_branch_`;
    for (const room of client.rooms) {
      if (room.startsWith(prefix)) {
        client.leave(room);
        this.logger.log(`Client [${client.id}] left old branch room: ${room}`);
      }
    }
    if (data.fromBranchId) {
      client.leave(`restaurant_${restId}_branch_${data.fromBranchId}`);
    }

    // 2. Gia nhập phòng chi nhánh mới nếu có
    if (targetBranchId) {
      const newRoom = `restaurant_${restId}_branch_${targetBranchId}`;
      client.join(newRoom);
      this.logger.log(`Client [${client.id}] switched to branch room: ${newRoom}`);
      return { success: true, message: `Switched to ${newRoom}`, branchId: targetBranchId };
    }

    return { success: true, message: `Cleared branch rooms for restaurant ${restId}` };
  }

  /**
   * Client chủ động rời phòng nhà hàng
   */
  @SubscribeMessage('leave:restaurant')
  handleLeaveRestaurant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { restaurantId: string },
  ) {
    if (!data?.restaurantId) return { success: false, message: 'Missing restaurantId' };
    const restRoom = `restaurant_${data.restaurantId}`;
    client.leave(restRoom);
    const prefix = `restaurant_${data.restaurantId}_branch_`;
    for (const room of client.rooms) {
      if (room.startsWith(prefix)) {
        client.leave(room);
      }
    }
    this.logger.log(`Client [${client.id}] left restaurant [${data.restaurantId}]`);
    return { success: true, message: `Left restaurant ${data.restaurantId}` };
  }

  /**
   * Client chủ động rời phòng bàn
   */
  @SubscribeMessage('leave:table')
  handleLeaveTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string },
  ) {
    if (data?.tableId) {
      const room = `table_${data.tableId}`;
      client.leave(room);
      this.logger.log(`Client [${client.id}] left table room [${room}]`);
      return { success: true, message: `Left table room ${room}` };
    }
    return { success: false, message: 'Missing tableId' };
  }

  /**
   * Ping kiểm tra tình trạng kết nối realtime và danh sách phòng client đang tham gia
   */
  @SubscribeMessage('ping:health')
  handlePingHealth(@ConnectedSocket() client: Socket) {
    return {
      status: 'ok',
      timestamp: Date.now(),
      socketId: client.id,
      rooms: Array.from(client.rooms),
    };
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

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('table:status_updated', payload);
    }
    const tableId = payload.table?._id || payload.table?.id;
    if (tableId) {
      this.server.to(`table_${tableId}`).emit('table:status_updated', payload);
    }
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

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('order:payment_completed', payload);
    }

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
    const publicMenuRoom = `public_menu_${payload.restaurantId}`;
    this.server.to(restRoom).emit('menu:availability_changed', payload);
    this.server.to(publicMenuRoom).emit('menu:availability_changed', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('menu:availability_changed', payload);
    }
    this.logger.log(
      `Broadcast [menu:availability_changed] to ${restRoom} & ${publicMenuRoom} (Item: ${payload.menuItemId} -> ${payload.effectiveIsAvailable ? 'AVAILABLE' : 'OUT_OF_STOCK'})`,
    );
  }

  /**
   * Lắng nghe sự kiện Khách gọi nhân viên phục vụ bàn (Sub-phase 10.1 & 10.2)
   */
  @OnEvent('table.call_staff')
  handleTableCallStaffEvent(payload: {
    notificationId?: string;
    tableId: string;
    tableName: string;
    tableCode?: string;
    branchId?: string;
    restaurantId: string;
    reason: string;
    note?: string;
    createdAt?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('table:call_staff', payload);
    this.server.to(restRoom).emit('CALL_STAFF', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('table:call_staff', payload);
      this.server.to(branchRoom).emit('CALL_STAFF', payload);
    }

    if (payload.tableId) {
      this.server.to(`table_${payload.tableId}`).emit('table:call_staff', payload);
    }

    this.logger.log(
      `Broadcast [table:call_staff] to ${restRoom} (Table: ${payload.tableName}, Reason: "${payload.reason}")`,
    );
  }

  /**
   * Lắng nghe sự kiện Nhân viên xác nhận tiếp nhận hỗ trợ bàn (Sub-phase 10.1 & 10.2)
   */
  @OnEvent('table.call_acknowledged')
  handleTableCallAcknowledgedEvent(payload: {
    tableId: string;
    tableName?: string;
    tableCode?: string;
    branchId?: string;
    restaurantId: string;
    acknowledgedBy: string;
    acknowledgedAt: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('table:call_acknowledged', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('table:call_acknowledged', payload);
    }

    if (payload.tableId) {
      this.server.to(`table_${payload.tableId}`).emit('table:call_acknowledged', payload);
    }

    this.logger.log(
      `Broadcast [table:call_acknowledged] to ${restRoom} and table_${payload.tableId} (Staff: ${payload.acknowledgedBy})`,
    );
  }

  /**
   * Lắng nghe sự kiện Cập nhật mã QR bàn (Thu hồi / Cấp lại QR) (Sub-phase 10.1 & 10.2)
   */
  @OnEvent('table.qr_updated')
  handleTableQrUpdatedEvent(payload: {
    tableId: string;
    qrStatus: string;
    qrToken?: string;
    restaurantId: string;
    branchId?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('table:qr_updated', payload);

    if (payload.branchId) {
      const branchRoom = `restaurant_${payload.restaurantId}_branch_${payload.branchId}`;
      this.server.to(branchRoom).emit('table:qr_updated', payload);
    }

    if (payload.tableId) {
      this.server.to(`table_${payload.tableId}`).emit('table:qr_updated', payload);
    }

    this.logger.log(
      `Broadcast [table:qr_updated] to ${restRoom} and table_${payload.tableId} (Status: ${payload.qrStatus})`,
    );
  }
}
