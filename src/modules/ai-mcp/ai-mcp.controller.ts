import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { McpRegistryService } from './mcp-registry.service';
import { ExecuteMcpToolDto } from './dto/execute-mcp-tool.dto';
import { JwtAuthGuard } from '../../shared/common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../shared/common/guards/super-admin.guard';
import { CurrentUser } from '../../shared/common/decorators/current-user.decorator';
import { JwtUser } from '../auth/interface/jwtUser';

/**
 * AiMcpController (Sub-phase 18.1)
 *
 * Cung cấp giao diện HTTP API chuẩn hóa để Superadmin và AI Agents tương tác với MCP Core.
 * Bảo vệ nghiêm ngặt bằng cặp Guard: JwtAuthGuard & SuperAdminGuard.
 */
@ApiTags('AI MCP (SuperAdmin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('platform/mcp')
export class AiMcpController {
  constructor(private readonly mcpRegistryService: McpRegistryService) {}

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

