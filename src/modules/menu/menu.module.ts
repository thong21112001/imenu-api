import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MenuCategory, MenuCategorySchema } from './entities/menu-category.entity';
import { MenuItem, MenuItemSchema } from './entities/menu-item.entity';
import { CategoriesService } from './categories.service';
import { MenuItemsService } from './menu-items.service';
import { CategoriesController } from './categories.controller';
import { MenuItemsController } from './menu-items.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MenuCategory.name, schema: MenuCategorySchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
  ],
  controllers: [CategoriesController, MenuItemsController],
  providers: [CategoriesService, MenuItemsService],
  exports: [MongooseModule, CategoriesService, MenuItemsService],
})
export class MenuModule {}
