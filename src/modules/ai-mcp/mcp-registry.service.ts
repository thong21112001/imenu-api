import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  McpExecutionResponse,
  McpToolDefinition,
  McpToolMetadata,
  McpToolScope,
} from './interfaces/mcp-tool.interface';

/**
 * McpRegistryService (Sub-phase 18.1)
 *
 * Trung tâm đăng ký, quản lý metadata và điều phối thực thi các công cụ Model Context Protocol (MCP).
 * Tích hợp kiểm soát phân quyền chặt chẽ:
 * - Phase 18 chỉ kích hoạt và cho phép thực thi các Tools thuộc scope: 'PLATFORM'.
 * - Cưỡng chế quy tắc Read-Only (isReadOnly === true) cho toàn bộ 4 công cụ nền tảng.
 */
@Injectable()
export class McpRegistryService {
  private readonly logger = new Logger(McpRegistryService.name);
  private readonly tools = new Map<string, McpToolDefinition>();

  /**
   * Đăng ký một MCP Tool vào Registry
   */
  registerTool(tool: McpToolDefinition): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new BadRequestException('MCP Tool bắt buộc phải có trường "name" dạng chuỗi hợp lệ');
    }

    if (!['PLATFORM', 'RESTAURANT', 'BRANCH'].includes(tool.scope)) {
      throw new BadRequestException(`Scope "${tool.scope}" không hợp lệ. Hỗ trợ: PLATFORM, RESTAURANT, BRANCH`);
    }

    if (typeof tool.handler !== 'function') {
      throw new BadRequestException(`MCP Tool "${tool.name}" bắt buộc phải có hàm handler thực thi`);
    }

    if (!tool.inputSchema || tool.inputSchema.type !== 'object') {
      throw new BadRequestException(`MCP Tool "${tool.name}" phải có inputSchema chuẩn type: 'object'`);
    }

    this.tools.set(tool.name, tool);
    this.logger.log(
      `[MCP Registry] Đã đăng ký tool: "${tool.name}" | Scope: ${tool.scope} | ReadOnly: ${tool.isReadOnly}`,
    );
  }

  /**
   * Đăng ký danh sách nhiều MCP Tools
   */
  registerTools(tools: McpToolDefinition[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Lấy danh sách metadata của các MCP Tools đã đăng ký.
   * Tại Phase 18, mặc định và cưỡng chế chỉ kích hoạt các công cụ có scope === 'PLATFORM'.
   */
  getTools(requestedScope?: McpToolScope): McpToolMetadata[] {
    const list: McpToolMetadata[] = [];

    for (const tool of this.tools.values()) {
      // Phase 18: Chỉ kích hoạt scope PLATFORM
      if (tool.scope !== 'PLATFORM') {
        continue;
      }

      if (requestedScope && tool.scope !== requestedScope) {
        continue;
      }

      list.push({
        name: tool.name,
        description: tool.description,
        scope: tool.scope,
        isReadOnly: tool.isReadOnly,
        inputSchema: tool.inputSchema,
      });
    }

    return list;
  }

  /**
   * Lấy chi tiết định nghĩa của 1 tool theo tên
   */
  getTool(name: string): McpToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Kiểm tra xem một tool có tồn tại trong Registry hay không
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Điều phối thực thi an toàn một MCP Tool
   */
  async executeTool<TInput = any, TOutput = any>(
    name: string,
    args: TInput = {} as TInput,
    context?: any,
  ): Promise<McpExecutionResponse<TOutput>> {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new NotFoundException(`Công cụ MCP "${name}" không tồn tại trong hệ thống`);
    }

    // KHÓA AN TOÀN PHASE 18: Chỉ cho phép gọi các Tools có scope === 'PLATFORM'
    if (tool.scope !== 'PLATFORM') {
      throw new ForbiddenException(
        `Từ chối thực thi: Ở Phase 18, chỉ các công cụ MCP thuộc phạm vi PLATFORM mới được kích hoạt (Công cụ "${name}" có scope "${tool.scope}")`,
      );
    }

    // KHÓA AN TOÀN READ-ONLY: Sub-phase 18.1 cưỡng chế chỉ đọc
    if (!tool.isReadOnly) {
      throw new ForbiddenException(
        `Từ chối thực thi: Công cụ MCP "${name}" không phải là công cụ chỉ đọc (isReadOnly !== true)`,
      );
    }

    // Kiểm tra các trường bắt buộc theo inputSchema.required
    if (tool.inputSchema.required && Array.isArray(tool.inputSchema.required)) {
      const missingFields = tool.inputSchema.required.filter(
        (field) => args === undefined || args === null || (args as any)[field] === undefined,
      );
      if (missingFields.length > 0) {
        throw new BadRequestException(
          `Thiếu tham số bắt buộc cho công cụ "${name}": ${missingFields.join(', ')}`,
        );
      }
    }

    try {
      this.logger.log(`[MCP Registry] Đang thực thi tool "${name}" với args: ${JSON.stringify(args)}`);
      const output = await tool.handler(args, context);

      return {
        tool: tool.name,
        scope: tool.scope,
        isReadOnly: tool.isReadOnly,
        data: output,
        executedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      this.logger.error(`[MCP Registry] Lỗi khi thực thi tool "${name}": ${err?.message || err}`);
      throw err;
    }
  }
}

