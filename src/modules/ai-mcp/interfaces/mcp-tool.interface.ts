/**
 * mcp-tool.interface.ts
 *
 * Định nghĩa cấu trúc chuẩn hóa cho Model Context Protocol (MCP) Tools trong iMenu.
 * Tuân thủ chuẩn MCP Core specification: metadata, schema định dạng JSON Schema,
 * và cờ phân quyền scope/isReadOnly nhằm bảo vệ an toàn hệ thống.
 */

export type McpToolScope = 'PLATFORM' | 'RESTAURANT' | 'BRANCH';

export interface McpToolPropertySchema {
  type: string;
  description?: string;
  enum?: (string | number | boolean)[];
  default?: any;
  minimum?: number;
  maximum?: number;
}

export interface McpToolInputSchema {
  type: 'object';
  properties?: Record<string, McpToolPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface McpToolMetadata {
  name: string;
  description: string;
  scope: McpToolScope;
  isReadOnly: boolean;
  inputSchema: McpToolInputSchema;
}

export interface McpToolDefinition<TInput = any, TOutput = any> extends McpToolMetadata {
  handler: (args: TInput, context?: any) => Promise<TOutput>;
}

export interface McpExecutionResponse<T = any> {
  tool: string;
  scope: McpToolScope;
  isReadOnly: boolean;
  data: T;
  executedAt: string;
}

