export interface EffectiveBankAccount {
  bankId: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  template?: string;
  resolvedFrom: 'BRANCH' | 'RESTAURANT';
}

export function resolveEffectiveBankAccount(
  restaurant: any,
  branchId?: string,
): EffectiveBankAccount | null {
  if (!restaurant) return null;

  // 1. Uu tien tai khoan cau hinh rieng tai Chi nhanh
  if (branchId && Array.isArray(restaurant.branches)) {
    const branch = restaurant.branches.find(
      (b: any) =>
        (b._id ? b._id.toString() : b.id ? b.id.toString() : '') === branchId.toString(),
    );
    if (
      branch &&
      branch.bankAccount &&
      branch.bankAccount.accountNo &&
      branch.bankAccount.accountNo.trim() !== '' &&
      branch.bankAccount.bankId &&
      branch.bankAccount.bankId.trim() !== ''
    ) {
      return {
        bankId: branch.bankAccount.bankId.trim(),
        bankName: branch.bankAccount.bankName || branch.bankAccount.bankId.trim(),
        accountNo: branch.bankAccount.accountNo.trim(),
        accountName: branch.bankAccount.accountName || restaurant.name,
        template: branch.bankAccount.template || 'compact2',
        resolvedFrom: 'BRANCH',
      };
    }
  }

  // 2. Fallback: Tai khoan mac dinh cua Nha hang tong
  if (
    restaurant.bankAccount &&
    restaurant.bankAccount.accountNo &&
    restaurant.bankAccount.accountNo.trim() !== '' &&
    restaurant.bankAccount.bankId &&
    restaurant.bankAccount.bankId.trim() !== ''
  ) {
    return {
      bankId: restaurant.bankAccount.bankId.trim(),
      bankName: restaurant.bankAccount.bankName || restaurant.bankAccount.bankId.trim(),
      accountNo: restaurant.bankAccount.accountNo.trim(),
      accountName: restaurant.bankAccount.accountName || restaurant.name,
      template: restaurant.bankAccount.template || 'compact2',
      resolvedFrom: 'RESTAURANT',
    };
  }

  return null;
}

export function generateVietQRMemo(orderCode: string): string {
  const cleanCode = (orderCode || '').replace(/[^a-zA-Z0-9-]/g, '').trim();
  return cleanCode ? `IMENU ${cleanCode}` : 'IMENU THANH TOAN';
}

export function generateVietQRUrl(options: {
  bankId: string;
  accountNo: string;
  template?: string;
  amount: number;
  memo: string;
  accountName?: string;
}): string {
  const {
    bankId,
    accountNo,
    template = 'compact2',
    amount = 0,
    memo,
    accountName = '',
  } = options;

  const encodedMemo = encodeURIComponent(memo);
  const encodedName = encodeURIComponent(accountName);

  return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${Math.round(
    amount,
  )}&addInfo=${encodedMemo}&accountName=${encodedName}`;
}

export function maskBankAccount(accountNo?: string): string {
  if (!accountNo) return '';
  const trimmed = accountNo.trim();
  if (trimmed.length <= 4) {
    return `***${trimmed}`;
  }
  const last4 = trimmed.slice(-4);
  return `***${last4}`;
}
