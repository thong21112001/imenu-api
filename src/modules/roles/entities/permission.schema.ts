import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ActionType, ResourceType } from '../../../shared/common/constants/permission.const';

/**
 * Subdocument luu cap quyen: Resource (Module) va danh sach Action
 */
@Schema({ _id: false, versionKey: false })
export class PermissionSubdocument {
  @Prop({
    type: String,
    enum: Object.values(ResourceType),
    required: true,
    trim: true,
  })
  resource: ResourceType;

  @Prop({
    type: [String],
    default: [],
  })
  actions: (ActionType | string)[];
}

export const PermissionSchema = SchemaFactory.createForClass(PermissionSubdocument);
