import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterRestaurantDto } from './dto/register-restaurant.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../shared/common/decorators/public.decorator';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { OkResponse } from '../../shared/common/dto/okResponse';
import { JwtUser } from './interface/jwtUser';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiOperation({ summary: 'Đăng nhập vào hệ thống iMenu' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const data = await this.authService.login(loginDto);
    return new OkResponse({ message: 'Đăng nhập thành công', data });
  }

  @Public()
  @ApiOperation({ summary: 'Đăng ký nhà hàng mới kèm tài khoản chủ quán' })
  @Post('register')
  async register(@Body() registerDto: RegisterRestaurantDto) {
    const data = await this.authService.register(registerDto);
    return new OkResponse({ message: 'Đăng ký nhà hàng thành công', data });
  }

  @Public()
  @ApiOperation({ summary: 'Làm mới Access Token bằng Refresh Token' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    const data = await this.authService.refreshToken(dto);
    return new OkResponse({ message: 'Làm mới token thành công', data });
  }

  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống' })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@CurrentUser() user: JwtUser) {
    const data = await this.authService.logout(user);
    return new OkResponse({ message: 'Đăng xuất thành công', data });
  }

  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản và quyền hạn hiện tại' })
  @Get('me')
  async getProfile(@CurrentUser() user: JwtUser) {
    const data = await this.authService.getProfile(user);
    return new OkResponse({ message: 'Lấy thông tin tài khoản thành công', data });
  }
}
