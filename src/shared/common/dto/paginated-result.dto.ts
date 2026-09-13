export interface PaginationResponse<T> {
  message: string;
  total: number;
  limit: number;
  page: number;
  totalPages: number;
  data: T[];
}

/**
 * Helper ham tao ket qua phan trang dong nhat
 */
export function createPaginationResponse<T>(
  data: T[],
  total: number,
  page: number = 1,
  limit: number = 20,
): PaginationResponse<T> {
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    message: 'Thanh cong',
    total,
    limit,
    page,
    totalPages,
    data,
  };
}
