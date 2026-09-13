import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { MenuCategory } from './menu-category.entity';

@Schema({ _id: false })
export class MenuItemOptionValue {
  @Prop({ required: true, trim: true })
  id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, default: 0 })
  priceDelta: number; // vi du: +10,000 cho Size L
}

@Schema({ _id: false })
export class MenuItemOptionGroup {
  @Prop({ required: true, trim: true })
  id: string;

  @Prop({ required: true, trim: true })
  name: string; // Kích cỡ, Lượng đường, Topping...

  @Prop({ default: false })
  required: boolean;

  @Prop({ default: false })
  multiple: boolean;

  @Prop({ type: [MenuItemOptionValue], default: [] })
  values: MenuItemOptionValue[];
}

@Schema({ timestamps: true, collection: 'menu_items' })
export class MenuItem {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: MenuCategory.name, required: true, autopopulate: true })
  category: MenuCategory;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, min: 0 })
  price: number; // Don vi VND

  @Prop({ min: 0 })
  originalPrice?: number;

  @Prop({ default: '' })
  imageUrl: string;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ default: false })
  isPopular: boolean;

  @Prop({ default: false })
  isNewItem: boolean;

  @Prop({ type: [MenuItemOptionGroup], default: [] })
  options: MenuItemOptionGroup[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;
}

export type MenuItemDocument = MenuItem & Document;
export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);

MenuItemSchema.index({ restaurantId: 1, slug: 1 }, { unique: true });
MenuItemSchema.index({ restaurantId: 1, category: 1, isAvailable: 1 });
