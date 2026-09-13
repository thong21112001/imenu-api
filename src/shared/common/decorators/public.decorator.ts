import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator @Public() cho phep bo qua xac thuc JWT Guard
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
