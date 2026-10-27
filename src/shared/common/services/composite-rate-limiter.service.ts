import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

@Injectable()
export class CompositeRateLimiterService {
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes lock

  private cleanKey(key: string): string {
    return key.trim().toLowerCase();
  }

  /**
   * Kiểm tra trước khi thực hiện hành động (VD: Đăng nhập)
   * Nếu cặp (IP, Email) đang bị khóa -> ném 429 Too Many Requests
   */
  checkRateLimit(ip: string, identifier: string): void {
    const key = `login:${this.cleanKey(ip)}:${this.cleanKey(identifier)}`;
    const record = this.attempts.get(key);
    if (!record) return;

    const now = Date.now();

    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Quá nhiều lần đăng nhập không thành công cho tài khoản này từ IP của bạn. Vui lòng thử lại sau ${remainingSeconds} giây.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Nếu thời gian window đã qua mà chưa bị khóa thì reset
    if (now - record.firstAttemptAt > this.WINDOW_MS) {
      this.attempts.delete(key);
    }
  }

  /**
   * Ghi nhận 1 lần thất bại (VD: Mật khẩu sai)
   */
  recordFailure(ip: string, identifier: string): void {
    const key = `login:${this.cleanKey(ip)}:${this.cleanKey(identifier)}`;
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now - record.firstAttemptAt > this.WINDOW_MS) {
      this.attempts.set(key, {
        count: 1,
        firstAttemptAt: now,
      });
      return;
    }

    record.count += 1;
    if (record.count >= this.MAX_ATTEMPTS) {
      record.lockedUntil = now + this.LOCK_DURATION_MS;
    }
  }

  /**
   * Xóa bộ đếm khi đăng nhập thành công
   */
  resetAttempts(ip: string, identifier: string): void {
    const key = `login:${this.cleanKey(ip)}:${this.cleanKey(identifier)}`;
    this.attempts.delete(key);
  }

  /**
   * Kiểm tra giới hạn tần suất cho các endpoint công khai (QR, Đặt món, Đánh giá, Gọi nhân viên)
   * Mặc định: tối đa 60 requests / phút từ 1 IP cho mỗi action
   */
  checkPublicRateLimit(ip: string, action: string, maxRequests = 60, windowMs = 60000): void {
    const key = `public:${this.cleanKey(action)}:${this.cleanKey(ip || 'unknown')}`;
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now - record.firstAttemptAt > windowMs) {
      this.attempts.set(key, { count: 1, firstAttemptAt: now });
      return;
    }

    record.count += 1;
    if (record.count > maxRequests) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Bạn đang gửi quá nhiều yêu cầu. Vui lòng thử lại sau giây lát.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
