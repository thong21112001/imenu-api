/**
 * Danh sach cac module tai nguyen trong he thong iMenu (Mapping 1:1 tu UI)
 */
export enum ResourceType {
  DASHBOARD = 'DASHBOARD',     // Dashboard tong quan & KPI
  TABLE = 'TABLE',             // So do ban & khu vuc
  POS = 'POS',                 // Ban hang tai quay POS
  KITCHEN = 'KITCHEN',         // Man hinh bep KDS
  MENU = 'MENU',               // Thuc don, danh muc & mon an
  QR_CODE = 'QR_CODE',         // Quan ly & tao ma QR ban
  BILL = 'BILL',               // Hoa don & thanh toan
  REPORT = 'REPORT',           // Bao cao doanh thu & thong ke
  STAFF = 'STAFF',             // Nhan vien & phan quyen
  SETTING = 'SETTING',         // Cai dat nha hang & chi nhanh
  BRANCH = 'BRANCH',           // Quan ly chi nhanh
  ROLE = 'ROLE',               // Quan ly vai tro
  ACTIVITY_LOG = 'ACTIVITY_LOG',// Nhat ky kiem toan he thong
}

/**
 * Danh sach hanh dong co the thuc hien
 */
export enum ActionType {
  VIEW = 'VIEW',       // Xem danh sach / chi tiet
  CREATE = 'CREATE',   // Them moi
  UPDATE = 'UPDATE',   // Chinh sua / Cap nhat
  DELETE = 'DELETE',   // Xoa
  PRINT = 'PRINT',     // In an (Hoa don, QR)
  CONFIRM = 'CONFIRM', // Xac nhan / Xu ly trang thai
  EXPORT = 'EXPORT',   // Xuat du lieu (Excel/PDF)
}

/**
 * Danh muc quyen chuan tuong ung truc tiep voi UI iMenu
 */
export const IMENU_PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: { id: 'perm-dash-view', resource: ResourceType.DASHBOARD, action: ActionType.VIEW, name: 'Xem Dashboard tong quan' },

  // Ban & Khu vuc
  TABLE_VIEW: { id: 'perm-table-view', resource: ResourceType.TABLE, action: ActionType.VIEW, name: 'Xem so do ban & khu vuc' },
  TABLE_EDIT: { id: 'perm-table-edit', resource: ResourceType.TABLE, action: ActionType.UPDATE, name: 'Chinh sua so do ban & khu vuc' },

  // POS Ban hang
  POS_VIEW: { id: 'perm-pos-view', resource: ResourceType.POS, action: ActionType.VIEW, name: 'Xem man hinh POS' },
  POS_CREATE: { id: 'perm-pos-create', resource: ResourceType.POS, action: ActionType.CREATE, name: 'Tao don hang tai quay POS' },
  POS_ORDER: { id: 'perm-pos-order', resource: ResourceType.POS, action: ActionType.CREATE, name: 'Tao don goi mon tai ban' },
  POS_PAY: { id: 'perm-pos-pay', resource: ResourceType.POS, action: ActionType.CONFIRM, name: 'Xu ly thanh toan don hang' },
  POS_TABLE: { id: 'perm-pos-table', resource: ResourceType.TABLE, action: ActionType.UPDATE, name: 'Quan ly so do ban & khu vuc' },

  // Bep KDS
  KITCHEN_VIEW: { id: 'perm-kds-view', resource: ResourceType.KITCHEN, action: ActionType.VIEW, name: 'Xem man hinh bep KDS' },
  KITCHEN_COOK: { id: 'perm-kds-cook', resource: ResourceType.KITCHEN, action: ActionType.UPDATE, name: 'Cap nhat tien do nau mon' },
  KITCHEN_OUT: { id: 'perm-kds-out', resource: ResourceType.KITCHEN, action: ActionType.UPDATE, name: 'Bao het mon truc tiep tu khu vuc bep' },

  // Thuc don
  MENU_VIEW: { id: 'perm-menu-view', resource: ResourceType.MENU, action: ActionType.VIEW, name: 'Xem danh sach thuc don' },
  MENU_CREATE: { id: 'perm-menu-create', resource: ResourceType.MENU, action: ActionType.CREATE, name: 'Them mon an moi' },
  MENU_STATUS: { id: 'perm-menu-status', resource: ResourceType.MENU, action: ActionType.UPDATE, name: 'Bat/Tat trang thai Con/Het' },
  MENU_CATEGORY: { id: 'perm-menu-category', resource: ResourceType.MENU, action: ActionType.UPDATE, name: 'Quan ly danh muc thuc don' },
  MENU_EDIT: { id: 'perm-menu-edit', resource: ResourceType.MENU, action: ActionType.UPDATE, name: 'Them, sua, xoa mon & danh muc' },

  // Ma QR
  QR_VIEW: { id: 'perm-qr-view', resource: ResourceType.QR_CODE, action: ActionType.VIEW, name: 'Xem danh sach ma QR ban' },
  QR_GENERATE: { id: 'perm-qr-generate', resource: ResourceType.QR_CODE, action: ActionType.CREATE, name: 'Tao moi & in ma QR ban' },
  QR_PRINT: { id: 'perm-qr-print', resource: ResourceType.QR_CODE, action: ActionType.PRINT, name: 'In an ma QR & Standee' },

  // Hoa don
  BILL_VIEW: { id: 'perm-bill-view', resource: ResourceType.BILL, action: ActionType.VIEW, name: 'Xem danh sach hoa don' },
  BILL_PRINT: { id: 'perm-bill-print', resource: ResourceType.BILL, action: ActionType.PRINT, name: 'In lai hoa don' },

  // Bao cao
  REPORT_VIEW: { id: 'perm-rep-view', resource: ResourceType.REPORT, action: ActionType.VIEW, name: 'Xem bao cao doanh thu' },
  REPORT_EXPORT: { id: 'perm-rep-export', resource: ResourceType.REPORT, action: ActionType.EXPORT, name: 'Xuat file bao cao doanh thu' },
  REPORT_CONSOLIDATED: { id: 'perm-rep-consolidated', resource: ResourceType.REPORT, action: ActionType.CONFIRM, name: 'Xem bao cao doanh thu chuoi hop nhat' },

  // Nhan vien & Phan quyen
  STAFF_VIEW: { id: 'perm-staff-view', resource: ResourceType.STAFF, action: ActionType.VIEW, name: 'Xem danh sach nhan vien' },
  STAFF_EDIT: { id: 'perm-staff-edit', resource: ResourceType.STAFF, action: ActionType.UPDATE, name: 'Them, sua nhan vien & phan quyen' },
  STAFF_MANAGE: { id: 'perm-staff-manage', resource: ResourceType.STAFF, action: ActionType.UPDATE, name: 'Quan ly nhan vien chi nhanh' },
  STAFF_TRANSFER: { id: 'perm-staff-transfer', resource: ResourceType.STAFF, action: ActionType.CONFIRM, name: 'Dieu chuyen chi nhanh nhan vien' },
  ROLE_MANAGE: { id: 'perm-role-manage', resource: ResourceType.ROLE, action: ActionType.UPDATE, name: 'Quan ly vai tro & ma tran quyen' },

  // Chi nhanh (Branch)
  BRANCH_VIEW: { id: 'perm-branch-view', resource: ResourceType.BRANCH, action: ActionType.VIEW, name: 'Xem danh sach & chi tiet chi nhanh' },
  BRANCH_CREATE: { id: 'perm-branch-create', resource: ResourceType.BRANCH, action: ActionType.CREATE, name: 'Them chi nhanh moi' },
  BRANCH_EDIT: { id: 'perm-branch-edit', resource: ResourceType.BRANCH, action: ActionType.UPDATE, name: 'Chinh sua thong tin chi nhanh' },
  BRANCH_LIFECYCLE: { id: 'perm-branch-lifecycle', resource: ResourceType.BRANCH, action: ActionType.CONFIRM, name: 'Dong / mo / ngung hoat dong chi nhanh' },

  // Cai dat
  SETTING_VIEW: { id: 'perm-set-view', resource: ResourceType.SETTING, action: ActionType.VIEW, name: 'Xem cai dat nha hang' },
  SETTING_EDIT: { id: 'perm-set-edit', resource: ResourceType.SETTING, action: ActionType.UPDATE, name: 'Chinh sua cai dat nha hang' },
  SETTING_MANAGE: { id: 'perm-settings', resource: ResourceType.SETTING, action: ActionType.UPDATE, name: 'Cau hinh he thong & cai dat nha hang' },
};

export const ALL_SYSTEM_PERMISSION_IDS: string[] = Array.from(
  new Set(Object.values(IMENU_PERMISSIONS).map((p) => p.id)),
);
