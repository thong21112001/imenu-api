import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { McpRegistryService } from '../mcp-registry.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { ActivityAction, ActivityModule } from '../../activity-log/constants/audit-log.const';
import { AiQueryDto } from '../dto/ai-query.dto';
import { JwtUser } from '../../auth/interface/jwtUser';
import { ENV } from '../../../shared/configs/env.cnf';

export interface KpiCardItem {
  title: string;
  value: string | number;
  change?: string;
  status?: 'positive' | 'negative' | 'neutral' | 'warning';
}

export interface ActionLinkItem {
  label: string;
  url: string;
  type?: 'primary' | 'secondary';
}

export interface ToolExecutionRecord {
  tool: string;
  arguments: Record<string, any>;
  durationMs: number;
  success: boolean;
}

export interface AiOrchestratorResult {
  success: boolean;
  mode: 'DETERMINISTIC_FALLBACK' | 'LLM_GENERATED';
  provider: string;
  query: string;
  promptChipId?: string;
  summaryMarkdown: string;
  kpiCards: KpiCardItem[];
  toolCallsExecuted: ToolExecutionRecord[];
  actionLinks: ActionLinkItem[];
  responseTimeMs: number;
}

/**
 * AiOrchestratorService (Sub-phase 18.2)
 *
 * Điều phối thông minh các MCP Tools, cơ chế Fallback Deterministic 100% chuẩn xác
 * và tự động lưu vết Audit Trail cho SuperAdmin.
 */
@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    private readonly mcpRegistryService: McpRegistryService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  /**
   * Xử lý truy vấn thông minh từ SuperAdmin
   */
  async query(
    dto: AiQueryDto,
    caller: JwtUser,
    ipAddress = '127.0.0.1',
    userAgent = 'iMenu-Agent/1.0',
  ): Promise<AiOrchestratorResult> {
    const startTime = Date.now();

    // 1. Kiểm tra an toàn Prompt (độ dài và chống Prompt Injection)
    this.validatePromptSecurity(dto.prompt);

    // 2. Xác định danh sách MCP Tools cần gọi dựa theo promptChipId hoặc nội dung câu hỏi
    const toolNames = this.determineToolsToExecute(dto);

    // 3. Thực thi song song hoặc tuần tự các MCP Tools được chọn
    const toolExecutions: ToolExecutionRecord[] = [];
    const toolResults: Record<string, any> = {};

    for (const toolName of toolNames) {
      const toolStart = Date.now();
      try {
        const res = await this.mcpRegistryService.executeTool(
          toolName,
          {},
          { user: caller },
        );
        const durationMs = Date.now() - toolStart;
        toolExecutions.push({
          tool: toolName,
          arguments: {},
          durationMs,
          success: true,
        });
        toolResults[toolName] = res.data;
      } catch (err: any) {
        const durationMs = Date.now() - toolStart;
        this.logger.error(`Lỗi thực thi MCP Tool ${toolName}: ${err.message}`);
        toolExecutions.push({
          tool: toolName,
          arguments: {},
          durationMs,
          success: false,
        });
      }
    }

    // 4. Tổng hợp câu trả lời qua LLM hoặc Deterministic Fallback
    let resultPayload: {
      summaryMarkdown: string;
      kpiCards: KpiCardItem[];
      actionLinks: ActionLinkItem[];
      mode: 'DETERMINISTIC_FALLBACK' | 'LLM_GENERATED';
      provider: string;
    };

    const hasApiKey = Boolean(ENV.AI_API_KEY && ENV.AI_API_KEY.trim().length > 0);
    const isDeterministicProvider =
      !ENV.AI_MCP_PROVIDER || ENV.AI_MCP_PROVIDER === 'deterministic';

    if (hasApiKey && !isDeterministicProvider) {
      try {
        resultPayload = await this.synthesizeWithLlm(
          dto.prompt,
          toolResults,
          toolNames,
        );
      } catch (err: any) {
        this.logger.warn(
          `LLM call failed (${err.message}). Falling back to Deterministic Synthesizer.`,
        );
        resultPayload = this.synthesizeDeterministic(
          dto.prompt,
          dto.promptChipId,
          toolResults,
          toolNames,
        );
      }
    } else {
      resultPayload = this.synthesizeDeterministic(
        dto.prompt,
        dto.promptChipId,
        toolResults,
        toolNames,
      );
    }

    const responseTimeMs = Date.now() - startTime;

    // 5. Lưu vết Audit Trail vào Database thông qua ActivityLogService
    await this.logInsightQuery(
      caller,
      dto,
      toolExecutions,
      resultPayload.mode,
      responseTimeMs,
      ipAddress,
      userAgent,
    );

    return {
      success: true,
      mode: resultPayload.mode,
      provider: resultPayload.provider,
      query: dto.prompt,
      promptChipId: dto.promptChipId,
      summaryMarkdown: resultPayload.summaryMarkdown,
      kpiCards: resultPayload.kpiCards,
      toolCallsExecuted: toolExecutions,
      actionLinks: resultPayload.actionLinks,
      responseTimeMs,
    };
  }

  /**
   * Validate chống Prompt Injection và bảo vệ an toàn hệ thống
   */
  private validatePromptSecurity(prompt: string): void {
    if (!prompt || typeof prompt !== 'string') {
      throw new BadRequestException('Câu hỏi prompt không hợp lệ');
    }

    if (prompt.length > 1000) {
      throw new BadRequestException('Câu hỏi prompt không được vượt quá 1000 ký tự');
    }

    const injectionPatterns = [
      /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
      /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
      /system\s+prompt/i,
      /bypass\s+safety/i,
      /you\s+are\s+now\s+(in\s+)?dan\s+mode/i,
      /jailbreak/i,
      /<script[\s\S]*?>/i,
      /javascript:/i,
      /drop\s+table/i,
      /select\s+.*\s+from/i,
      /reveal\s+(api\s+key|secret|password|token)/i,
      /override\s+(system|guard|rule)/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(prompt)) {
        throw new BadRequestException(
          'Phát hiện nội dung truy vấn không an toàn hoặc chứa prompt injection nguy hiểm',
        );
      }
    }
  }

  /**
   * Xác định công cụ MCP cần gọi dựa vào promptChipId hoặc phân tích từ khóa trong Prompt
   */
  private determineToolsToExecute(dto: AiQueryDto): string[] {
    const chip = (dto.promptChipId || '').toUpperCase().trim();

    if (chip === 'REVENUE_OVERVIEW' || chip === 'REVENUE') {
      return ['get_platform_revenue_overview'];
    }
    if (chip === 'CHURN_RISK' || chip === 'CHURN') {
      return ['detect_restaurant_churn_risk'];
    }
    if (chip === 'COMMISSION_AUDIT' || chip === 'COMMISSION' || chip === 'SALES') {
      return ['audit_sales_commissions_anomalies'];
    }
    if (chip === 'UNDERPERFORMING_DIAGNOSE' || chip === 'DIAGNOSE' || chip === 'PERFORMANCE') {
      return ['diagnose_underperforming_restaurants'];
    }

    // Phân tích từ khóa trong prompt
    const p = dto.prompt.toLowerCase();

    // 1. Churn Risk
    if (
      p.includes('rời bỏ') ||
      p.includes('roi bo') ||
      p.includes('churn') ||
      p.includes('sắp hết hạn') ||
      p.includes('sap het han') ||
      p.includes('nguy cơ') ||
      p.includes('nguy co') ||
      p.includes('giảm đơn') ||
      p.includes('giam don')
    ) {
      return ['detect_restaurant_churn_risk'];
    }

    // 2. Sales Commission Anomalies
    if (
      p.includes('hoa hồng') ||
      p.includes('hoa hong') ||
      p.includes('commission') ||
      p.includes('sales rep') ||
      p.includes('bất thường') ||
      p.includes('bat thuong') ||
      p.includes('gian lận') ||
      p.includes('gian lan') ||
      p.includes('kiểm toán') ||
      p.includes('kiem toan')
    ) {
      return ['audit_sales_commissions_anomalies'];
    }

    // 3. Underperforming Diagnostics
    if (
      p.includes('hiệu suất kém') ||
      p.includes('hieu suat kem') ||
      p.includes('hủy món') ||
      p.includes('huy mon') ||
      p.includes('kds') ||
      p.includes('đánh giá thấp') ||
      p.includes('danh gia thap') ||
      p.includes('chẩn đoán') ||
      p.includes('chan doan') ||
      p.includes('điểm nghẽn') ||
      p.includes('diem nghen')
    ) {
      return ['diagnose_underperforming_restaurants'];
    }

    // 4. Revenue Overview (Default cho các truy vấn doanh thu, GMV, hoặc toàn sàn)
    if (
      p.includes('doanh thu') ||
      p.includes('doanh so') ||
      p.includes('gmv') ||
      p.includes('tăng trưởng') ||
      p.includes('tang truong') ||
      p.includes('gói cước') ||
      p.includes('subscription') ||
      p.includes('revenue') ||
      p.includes('toàn sàn') ||
      p.includes('nền tảng')
    ) {
      return ['get_platform_revenue_overview'];
    }

    // Mặc định gọi báo cáo doanh thu nếu không khớp từ khóa cụ thể
    return ['get_platform_revenue_overview'];
  }

  /**
   * Bộ tổng hợp Deterministic Rule-based Synthesizer (Hoạt động 100% không cần LLM ngoài)
   */
  private synthesizeDeterministic(
    query: string,
    promptChipId: string | undefined,
    toolResults: Record<string, any>,
    toolNames: string[],
  ): {
    summaryMarkdown: string;
    kpiCards: KpiCardItem[];
    actionLinks: ActionLinkItem[];
    mode: 'DETERMINISTIC_FALLBACK';
    provider: string;
  } {
    const kpiCards: KpiCardItem[] = [];
    const actionLinks: ActionLinkItem[] = [];
    const markdownSections: string[] = [];

    // Format tiền VND
    const formatVnd = (num: number) => {
      return (num || 0).toLocaleString('vi-VN') + ' đ';
    };

    // Tool 1: Revenue Overview
    if (toolResults['get_platform_revenue_overview']) {
      const data = toolResults['get_platform_revenue_overview'];
      const gmv = data.gmvTotal || 0;
      const subRev = data.subscriptionRevenue || 0;
      const gmvGrowth = data.growthRates?.gmvGrowthPercent ?? 0;
      const orders = data.orderStats?.completedOrders || 0;

      kpiCards.push(
        {
          title: 'Tổng GMV Nền Tảng',
          value: formatVnd(gmv),
          change: `${gmvGrowth >= 0 ? '+' : ''}${gmvGrowth}% so với kỳ trước`,
          status: gmvGrowth >= 0 ? 'positive' : 'negative',
        },
        {
          title: 'Doanh Thu Subscription',
          value: formatVnd(subRev),
          change: `${data.growthRates?.subscriptionGrowthPercent >= 0 ? '+' : ''}${data.growthRates?.subscriptionGrowthPercent || 0}%`,
          status: 'positive',
        },
        {
          title: 'Đơn Hàng Hoàn Tất',
          value: orders.toLocaleString('vi-VN'),
          change: `${data.orderStats?.totalOrders || 0} tổng đơn`,
          status: 'neutral',
        },
      );

      actionLinks.push(
        {
          label: 'Xem Báo Cáo Doanh Thu Nền Tảng',
          url: '/platform/revenues',
          type: 'primary',
        },
        {
          label: 'Quản Lý Danh Sách Nhà Hàng',
          url: '/platform/restaurants',
          type: 'secondary',
        },
      );

      const topList = Array.isArray(data.topRestaurants) && data.topRestaurants.length > 0
        ? data.topRestaurants
            .map(
              (r: any, idx: number) =>
                `${idx + 1}. **${r.name}** - GMV: ${formatVnd(r.gmv)} (${r.ordersCount} đơn)`,
            )
            .join('\n')
        : '_Chưa ghi nhận đơn hàng phát sinh GMV trong kỳ này._';

      markdownSections.push(`### 📊 Báo Cáo Tổng Quan Doanh Thu & GMV Nền Tảng

- **Tổng GMV phát sinh**: ${formatVnd(gmv)} (Tăng trưởng ${gmvGrowth}%).
- **Doanh thu gói cước Subscription SaaS**: ${formatVnd(subRev)}.
- **Tổng doanh thu nền tảng**: ${formatVnd(data.totalPlatformRevenue || gmv + subRev)}.
- **Số đơn hoàn tất**: ${orders} đơn (Giá trị đơn TB: ${formatVnd(data.orderStats?.avgOrderValue || 0)}).

#### 🏆 Top Nhà Hàng Đóng Góp GMV Cao Nhất:
${topList}

> 💡 **Khuyến nghị**: Tiếp tục khuyến khích các đối tác Top chuyển đổi sang gói Subscription chu kỳ dài để tối ưu dòng tiền.`);
    }

    // Tool 2: Detect Churn Risk
    if (toolResults['detect_restaurant_churn_risk']) {
      const data = toolResults['detect_restaurant_churn_risk'];
      const atRisk = data.atRiskCount || 0;
      const highRisk = data.highRiskCount || 0;
      const scanned = data.totalActiveRestaurantsScanned || 0;

      kpiCards.push(
        {
          title: 'Quán Có Nguy Cơ Rời Bỏ',
          value: `${atRisk} đối tác`,
          change: `${highRisk} nguy cơ cao`,
          status: atRisk > 0 ? 'warning' : 'positive',
        },
        {
          title: 'Nguy Cơ Cao (High Risk)',
          value: `${highRisk} quán`,
          change: 'Cần can thiệp gấp',
          status: highRisk > 0 ? 'negative' : 'positive',
        },
        {
          title: 'Số Quán Active Đã Quét',
          value: `${scanned} nhà hàng`,
          status: 'neutral',
        },
      );

      actionLinks.push({
        label: 'Chăm Sóc & Giữ Chân Nhà Hàng',
        url: data.actionUrl || '/platform/restaurants',
        type: 'primary',
      });

      const churnList = Array.isArray(data.churnRiskRestaurants) && data.churnRiskRestaurants.length > 0
        ? data.churnRiskRestaurants
            .slice(0, 5)
            .map(
              (r: any) =>
                `- **${r.name}** (${r.planType || 'BASIC'}) - Giảm đơn: **${r.orderDropPercent}%** | Hạn dùng còn: **${r.daysUntilExpiration} ngày** | Lý do: ${r.riskReasons?.join(', ')}`,
            )
            .join('\n')
        : '_Không có nhà hàng nào rơi vào ngưỡng cảnh báo rủi ro rời bỏ._';

      markdownSections.push(`### ⚠️ Cảnh Báo Nguy Cơ Rời Bỏ Nền Tảng (Restaurant Churn Risk)

Hệ thống đã quét **${scanned} nhà hàng** đang hoạt động và phát hiện **${atRisk} nhà hàng** có dấu hiệu giảm sút hoặc sắp hết hạn dịch vụ.

#### 🚨 Danh Sách Nhà Hàng Cần Can Thiệp Ngay:
${churnList}

> 💡 **Hành động đề xuất**: Đội ngũ CSKH và Chuyên viên Quản lý Vùng cần liên hệ hỗ trợ kỹ thuật hoặc tặng mã ưu đãi gia hạn đối với nhóm nguy cơ cao.`);
    }

    // Tool 3: Sales Commissions Anomalies
    if (toolResults['audit_sales_commissions_anomalies']) {
      const data = toolResults['audit_sales_commissions_anomalies'];
      const anomaliesCount = data.anomaliesCount || 0;
      const riskAmount = data.totalPotentialRiskAmount || 0;
      const scannedReps = data.scannedRepsCount || 0;

      kpiCards.push(
        {
          title: 'Bất Thường Hoa Hồng',
          value: `${anomaliesCount} trường hợp`,
          status: anomaliesCount > 0 ? 'negative' : 'positive',
        },
        {
          title: 'Giá Trị Rủi Ro Cần Giữ',
          value: formatVnd(riskAmount),
          change: 'Cần kiểm toán trước khi chi trả',
          status: riskAmount > 0 ? 'warning' : 'neutral',
        },
        {
          title: 'Sales Rep Đã Kiểm Toán',
          value: `${scannedReps} nhân viên`,
          status: 'neutral',
        },
      );

      actionLinks.push({
        label: 'Kiểm Toán & Giữ Bút Toán Hoa Hồng',
        url: data.actionUrl || '/platform/sales',
        type: 'primary',
      });

      const anomaliesList = Array.isArray(data.anomalies) && data.anomalies.length > 0
        ? data.anomalies
            .slice(0, 5)
            .map(
              (a: any) =>
                `- **${a.salesRepName}** (${a.salesRepEmail}): Loại bất thường: *${a.suspiciousType}* - Số bút toán: ${a.flaggedCommissionsCount} - Tiền tạm giữ: ${formatVnd(a.totalSuspiciousAmount)} (${a.details})`,
            )
            .join('\n')
        : '_Tất cả bút toán hoa hồng đều hợp lệ và tuân thủ chính sách._';

      markdownSections.push(`### 🔍 Báo Cáo Kiểm Toán Hoa Hồng Sales & Phát Hiện Bất Thường

Hệ thống đã kiểm toán **${scannedReps} Sales Rep** và phát hiện **${anomaliesCount} trường hợp bất thường** với tổng giá trị rủi ro **${formatVnd(riskAmount)}**.

#### 📋 Danh Sách Cần Hậu Kiểm:
${anomaliesList}

> 💡 **Khuyến nghị**: Tạm giữ chi trả hoa hồng đối với các hợp đồng phát sinh quán ảo chưa kích hoạt KDS hoặc không phát sinh đơn hàng thực tế.`);
    }

    // Tool 4: Underperforming Restaurants
    if (toolResults['diagnose_underperforming_restaurants']) {
      const data = toolResults['diagnose_underperforming_restaurants'];
      const totalDiagnosed = data.totalDiagnosed || 0;

      kpiCards.push({
        title: 'Quán Cần Tối Ưu Vận Hành',
        value: `${totalDiagnosed} nhà hàng`,
        status: totalDiagnosed > 0 ? 'warning' : 'positive',
      });

      actionLinks.push({
        label: 'Tối Ưu Vận Hành Nhà Hàng',
        url: data.actionUrl || '/platform/restaurants',
        type: 'secondary',
      });

      const diagList = Array.isArray(data.diagnostics) && data.diagnostics.length > 0
        ? data.diagnostics
            .slice(0, 5)
            .map(
              (d: any) =>
                `- **${d.name}**: GMV: ${formatVnd(d.gmv)} | Đánh giá TB: ${d.avgRating}⭐ | Tỷ lệ hủy đơn: ${d.cancellationRatePercent}%\n  - *Điểm nghẽn*: ${d.primaryBottlenecks?.join('; ') || 'Không ghi nhận'}\n  - *Đề xuất*: ${d.recommendations?.join('; ') || 'Theo dõi thêm'}`,
            )
            .join('\n')
        : '_Không có nhà hàng nào có tỷ lệ hủy đơn cao hoặc đánh giá tiêu cực trong kỳ._';

      markdownSections.push(`### 🛠️ Chẩn Đoán Nhà Hàng Hiệu Suất Kém & Điểm Nghẽn

#### 🔍 Chi Tiết Phân Tích:
${diagList}`);
    }

    // Deduplicate action links by url
    const uniqueLinks: ActionLinkItem[] = [];
    const seenUrls = new Set<string>();
    for (const link of actionLinks) {
      if (!seenUrls.has(link.url)) {
        seenUrls.add(link.url);
        uniqueLinks.push(link);
      }
    }

    return {
      summaryMarkdown:
        markdownSections.join('\n\n') ||
        '### ℹ️ Không tìm thấy dữ liệu thống kê phù hợp với yêu cầu của bạn.',
      kpiCards,
      actionLinks: uniqueLinks,
      mode: 'DETERMINISTIC_FALLBACK',
      provider: 'deterministic',
    };
  }

  /**
   * Gọi LLM qua Function Calling với Timeout 10s (Tự động fallback khi lỗi mạng)
   */
  private async synthesizeWithLlm(
    prompt: string,
    toolResults: Record<string, any>,
    toolNames: string[],
  ): Promise<{
    summaryMarkdown: string;
    kpiCards: KpiCardItem[];
    actionLinks: ActionLinkItem[];
    mode: 'LLM_GENERATED';
    provider: string;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s Timeout

    try {
      const provider = ENV.AI_MCP_PROVIDER || 'gemini';
      const model = ENV.AI_MODEL_NAME || 'gemini-1.5-flash';
      const apiKey = ENV.AI_API_KEY;

      const systemPrompt = `Bạn là Trợ lý AI Cấp cao (SuperAdmin Executive Assistant) của nền tảng quản lý ẩm thực và F&B iMenu.
Nhiệm vụ của bạn là đọc dữ liệu từ các MCP Tools nền tảng và trả về phân tích sâu sắc, ngắn gọn, có số liệu đối chứng.
Bạn PHẢI trả về định dạng JSON thuần túy theo schema sau:
{
  "summaryMarkdown": "string (Markdown chi tiết, có tiêu đề, bullet points, format VND)",
  "kpiCards": [
    { "title": "string", "value": "string", "change": "string", "status": "positive|negative|neutral|warning" }
  ],
  "actionLinks": [
    { "label": "string", "url": "string", "type": "primary|secondary" }
  ]
}`;

      const userContent = `Câu hỏi của SuperAdmin: "${prompt}"
Dữ liệu từ các MCP Tools đã thực thi:
${JSON.stringify(toolResults, null, 2)}`;

      let responseText = '';

      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`OpenAI API error: HTTP ${res.status}`);
        }
        const data = await res.json();
        responseText = data.choices?.[0]?.message?.content || '{}';
      } else {
        // Mặc định Gemini
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userContent}` }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Gemini API error: HTTP ${res.status}`);
        }
        const data = await res.json();
        responseText =
          data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      }

      const parsed = JSON.parse(responseText);

      return {
        summaryMarkdown: parsed.summaryMarkdown || 'Đã tổng hợp thông tin.',
        kpiCards: Array.isArray(parsed.kpiCards) ? parsed.kpiCards : [],
        actionLinks: Array.isArray(parsed.actionLinks) ? parsed.actionLinks : [],
        mode: 'LLM_GENERATED',
        provider,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Lưu vết Audit Trail của SuperAdmin MCP Insight Query vào Database
   */
  private async logInsightQuery(
    caller: JwtUser,
    dto: AiQueryDto,
    toolExecutions: ToolExecutionRecord[],
    mode: string,
    responseTimeMs: number,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    try {
      await this.activityLogService.handleActivityLog({
        userId: caller?.userId,
        userName: caller?.email || caller?.fullName || 'SuperAdmin',
        userRole: caller?.role ? String(caller.role) : 'SUPER_ADMIN',
        module: ActivityModule.SYSTEM,
        action: ActivityAction.SUPERADMIN_MCP_INSIGHT_QUERY,
        targetId: 'AI_MCP_ORCHESTRATOR',
        entityType: 'AiMcpQuery',
        description: `SuperAdmin truy vấn AI MCP Insights: "${dto.prompt.substring(0, 100)}"`,
        metadata: {
          prompt: dto.prompt,
          promptChipId: dto.promptChipId,
          toolsCalled: toolExecutions.map((t) => t.tool),
          toolCount: toolExecutions.length,
          mode,
          responseTimeMs,
        },
        ipAddress,
        userAgent,
        status: 'SUCCESS',
      });
    } catch (err: any) {
      this.logger.error(`Lỗi khi ghi Audit Log AI MCP query: ${err.message}`);
    }
  }
}
