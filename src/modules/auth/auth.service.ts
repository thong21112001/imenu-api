import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { comparePassword, hashPassword } from '../../shared/common/utils/password.util';
import { JwtPayload } from './interface/jwtPayload';
import { JwtConstants } from '../../shared/common/constants/envConstants';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findByUsername(username, true);
    if (user && user.password && (await comparePassword(pass, user.password))) {
      const userObj = user.toObject();
      delete userObj.password;
      return userObj;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    if (user.status === 'INACTIVE') {
      throw new UnauthorizedException('Tài khoản đã bị tạm ngưng hoạt động');
    }

    const payload: JwtPayload = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      roleId: (user.role as any)?._id ? user.role._id.toString() : user.role?.toString(),
      roleSlug: user.role?.slug || '',
      restaurantId: user.restaurantId ? user.restaurantId.toString() : undefined,
      branchId: user.branchId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: (JwtConstants.refreshExpiresIn as any) || '7d',
    });

    await this.usersService.updateLastLogin(user._id.toString());

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        restaurantId: user.restaurantId,
        branchId: user.branchId,
        branchName: user.branchName,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existing = await this.usersService.findByUsername(registerDto.username);
    if (existing) {
      throw new ConflictException('Tên đăng nhập đã tồn tại');
    }

    const existingEmail = await this.usersService.findByEmail(registerDto.email);
    if (existingEmail) {
      throw new ConflictException('Email đã được đăng ký');
    }

    const ownerRole = await this.rolesService.findBySlug('restaurant_admin');

    const createdUser = await this.usersService.create({
      username: registerDto.username,
      email: registerDto.email,
      password: registerDto.password,
      fullName: registerDto.fullName,
      phone: registerDto.phone,
      roleId: (ownerRole as any)._id.toString(),
    });

    return this.login({
      username: registerDto.username,
      password: registerDto.password,
    });
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const decoded = this.jwtService.verify<JwtPayload>(dto.refreshToken);
      const user = await this.usersService.findById(decoded.id);

      const payload: JwtPayload = {
        id: (user as any)._id.toString(),
        username: user.username,
        email: user.email,
        roleId: (user.role as any)?._id ? (user.role as any)._id.toString() : (user.role as any).toString(),
        roleSlug: (user.role as any)?.slug || '',
        restaurantId: user.restaurantId ? (user.restaurantId as any).toString() : undefined,
        branchId: user.branchId,
      };

      const accessToken = this.jwtService.sign(payload);
      return { accessToken };
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }
}
