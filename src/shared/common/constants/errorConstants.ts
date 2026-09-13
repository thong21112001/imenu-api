/**
 * Danh muc ma loi chuan hoa he thong iMenu
 */
export const ErrCode = {
  // Authentication & Authorization
  E_UNAUTHORIZED: 'Unauthorized',
  E_FORBIDDEN: 'Forbidden',
  E_TOKEN_EXPIRED: 'TokenExpired',
  E_INVALID_TOKEN: 'InvalidToken',
  E_ROLE_INACTIVE: 'RoleInactive',
  E_NEED_HIGHER_ROLE: 'NeedHigherRole',

  // User & Staff
  E_USER_NOT_FOUND: 'UserNotFound',
  E_USER_EXISTED: 'UserExisted',
  E_USER_PHONE_EXISTED: 'PhoneUsed',
  E_USER_EMAIL_EXISTED: 'EmailUsed',
  E_USER_PASS_NOT_MATCH: 'UserPasswordNotMatch',

  // Restaurant & Branch
  E_RESTAURANT_NOT_FOUND: 'RestaurantNotFound',
  E_BRANCH_NOT_FOUND: 'BranchNotFound',

  // Tables & Zones
  E_TABLE_NOT_FOUND: 'TableNotFound',
  E_TABLE_ZONE_NOT_FOUND: 'TableZoneNotFound',
  E_INVALID_QR_TOKEN: 'InvalidQrToken',

  // Menu & Categories
  E_MENU_CATEGORY_NOT_FOUND: 'MenuCategoryNotFound',
  E_MENU_ITEM_NOT_FOUND: 'MenuItemNotFound',

  // Orders & Billing
  E_ORDER_NOT_FOUND: 'OrderNotFound',
  E_INVALID_ORDER_STATUS: 'InvalidOrderStatus',
  E_BILL_NOT_FOUND: 'BillNotFound',

  // Common & System
  E_NOT_FOUND: 'ResourceNotFound',
  E_VALIDATION_ERROR: 'ValidationError',
  E_INTERNAL_SERVER_ERROR: 'InternalServerError',
};
