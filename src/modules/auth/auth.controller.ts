import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const data = await this.authService.login(loginDto);
    return new OkResponse({ message: 'Đăng nhập thành công', data });
  }

  @Public()
  @ApiOperation({ summary: 'Đăng ký tài khoản chủ nhà hàng mới' })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const data = await this.authService.register(registerDto);
    return new OkResponse({ message: 'Đăng ký tài khoản thành công', data });
  }

  @Public()
  @ApiOperation({ summary: 'Làm mới Access Token bằng Refresh Token' })
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    const data = await this.authService.refreshToken(dto);
    return new OkResponse({ message: 'Làm mới token thành công', data });
  }

  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  @Get('me')
  async getProfile(@CurrentUser() user: JwtUser) {
    return new OkResponse({ data: user });
  }
}
