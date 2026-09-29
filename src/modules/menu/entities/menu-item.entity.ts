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

@Schema({ _id: false })
export class BranchPriceOverride {
  @Prop({ required: true, trim: true })
  branchId: string; // ID chi nhánh

  @Prop({ min: 0 })
  price?: number; // Giá bán riêng tại chi nhánh này (VNĐ)

  @Prop({ min: 0 })
  originalPrice?: number; // Giá deal / khuyến mãi riêng

  @Prop({ default: true })
  isAvailable: boolean; // Trạng thái còn/hết riêng của chi nhánh này
}

export const BranchPriceOverrideSchema = SchemaFactory.createForClass(BranchPriceOverride);

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
  price: number; // Don vi VND - Gia niem yet toan chuoi

  @Prop({ min: 0 })
  originalPrice?: number; // Gia goc toan chuoi (dung cho deal / giam gia)

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

  // ===== MULTI-BRANCH SUPPORT =====
  @Prop({ type: [String], default: [] })
  branchIds: string[]; // Danh sach chi nhanh ap dung (Rong = Ap dung tat ca chi nhanh)

  @Prop({ type: [BranchPriceOverrideSchema], default: [] })
  branchOverrides: BranchPriceOverride[]; // Tuy bien gia va trang thai con/het rieng theo chi nhanh

  // ===== SOFT DELETE & AUDIT =====
  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  deletedBy?: Types.ObjectId;
}

export type MenuItemDocument = MenuItem & Document;
export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);

MenuItemSchema.index({ restaurantId: 1, slug: 1 }, { unique: true });
MenuItemSchema.index({ restaurantId: 1, isDeleted: 1, isAvailable: 1 });
MenuItemSchema.index({ restaurantId: 1, isDeleted: 1, category: 1 });
MenuItemSchema.index({ restaurantId: 1, branchIds: 1 });

MenuItemSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

MenuItemSchema.virtual('categoryId').get(function () {
  const cat = (this as any).category;
  if (!cat) return null;
  return cat._id ? cat._id.toHexString() : cat.toString();
});

MenuItemSchema.set('toJSON', { virtuals: true });
MenuItemSchema.set('toObject', { virtuals: true });
