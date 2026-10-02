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
   * Client chủ động join room cụ thể
   */
  @SubscribeMessage('join:restaurant')
  handleJoinRestaurant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { restaurantId: string; branchId?: string },
  ) {
    if (data?.restaurantId) {
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
    order: any;
    restaurantId: string;
    branchId?: string;
  }) {
    if (!payload?.restaurantId) return;
    const restRoom = `restaurant_${payload.restaurantId}`;
    this.server.to(restRoom).emit('order:item_status_updated', payload);
    this.logger.log(`Broadcast [order:item_status_updated] to ${restRoom} (Item: ${payload.itemId} -> ${payload.status})`);
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
}
