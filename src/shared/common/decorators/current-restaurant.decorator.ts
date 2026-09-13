import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator @CurrentRestaurant() lay restaurantId hien tai cua user
 */
export const CurrentRestaurant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.restaurantId;
  },
);
