import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MenuCategory, MenuCategorySchema } from './entities/menu-category.entity';
import { MenuItem, MenuItemSchema } from './entities/menu-item.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MenuCategory.name, schema: MenuCategorySchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MenuModule {}
