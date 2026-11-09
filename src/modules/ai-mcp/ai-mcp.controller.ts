import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { McpRegistryService } from './mcp-registry.service';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { CompositeRateLimiterService } from '../../shared/common/services/composite-rate-limiter.service';
import { ExecuteMcpToolDto } from './dto/execute-mcp-tool.dto';
import { AiQueryDto } from './dto/ai-query.dto';
import { JwtAuthGuard } from '../../shared/common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../shared/common/guards/super-admin.guard';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { JwtUser } from '../auth/interface/jwtUser';
import { ENV } from '../../shared/configs/env.cnf';

/**
 * AiMcpController (Sub-phase 18.1 & 18.2)
 *
 * Cung cấp giao diện HTTP API chuẩn hóa cho Superadmin và AI Agents.
 * Hỗ trợ đồng thời 2 route prefix: 'platform/mcp' và 'platform/ai-mcp' để đảm bảo tính tương thích.
 * Được bảo vệ nghiêm ngặt bằng cặp Guard: JwtAuthGuard & SuperAdminGuard.
 */
@ApiTags('AI MCP (SuperAdmin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller(['platform/mcp', 'platform/ai-mcp'])
export class AiMcpController {
  constructor(
    private readonly mcpRegistryService: McpRegistryService,
    private readonly aiOrchestratorService: AiOrchestratorService,
    private readonly rateLimiterService: CompositeRateLimiterService,
  ) {}

  @ApiOperation({
    summary: 'Truy vấn thông minh AI MCP kết hợp Function Calling & Deterministic Fallback (Sub-phase 18.2)',
  })
  @Post('query')
  @HttpCode(HttpStatus.OK)
  async queryAi(
    @Body() dto: AiQueryDto,
    @CurrentUser() user: JwtUser,
    @Req() req: any,
  ) {
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'] || 'iMenu-Agent/1.0';
    const callerKey = user?.userId || clientIp;

    // Giới hạn tần suất gọi query AI (mặc định AI_RATE_LIMIT_PER_MIN / phút)
    this.rateLimiterService.checkPublicRateLimit(
      callerKey,
      'superadmin-ai-mcp-query',
      ENV.AI_RATE_LIMIT_PER_MIN,
      60000,
    );

    return this.aiOrchestratorService.query(dto, user, clientIp, userAgent);
  }

  @ApiOperation({
    summary: 'Danh sách các công cụ MCP chuẩn hóa của nền tảng (Read-only Platform Tools)',
  })
  @Get('tools')
  async listTools() {
    const tools = this.mcpRegistryService.getTools('PLATFORM');
    return {
      success: true,
      total: tools.length,
      data: tools,
    };
  }

  @ApiOperation({
    summary: 'Lấy chi tiết schema và metadata của một công cụ MCP theo tên',
  })
  @Get('tools/:name')
  async getToolDetails(@Param('name') name: string) {
    const tool = this.mcpRegistryService.getTool(name);
    if (!tool || tool.scope !== 'PLATFORM') {
      return {
        success: false,
        message: `Công cụ MCP "${name}" không tồn tại hoặc không thuộc quyền quản trị nền tảng`,
      };
    }

    return {
      success: true,
      data: {
        name: tool.name,
        description: tool.description,
        scope: tool.scope,
        isReadOnly: tool.isReadOnly,
        inputSchema: tool.inputSchema,
      },
    };
  }

  @ApiOperation({
    summary: 'Thực thi một công cụ MCP nền tảng được chỉ định (Read-Only)',
  })
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async executeTool(
    @Body() dto: ExecuteMcpToolDto,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.mcpRegistryService.executeTool(
      dto.tool,
      dto.arguments || {},
      { user },
    );

    return {
      success: true,
      ...result,
    };
  }
}
