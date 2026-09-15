import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Restaurant, RestaurantSchema } from './entities/restaurant.entity';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

import { Order, OrderSchema } from '../orders/entities/order.entity';
import { User, UserSchema } from '../users/entities/user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [RestaurantsController, BranchesController],
  providers: [RestaurantsService, BranchesService],
  exports: [MongooseModule, RestaurantsService, BranchesService],
})
export class RestaurantsModule {}
