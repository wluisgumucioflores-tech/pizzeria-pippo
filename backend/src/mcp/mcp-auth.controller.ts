import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { McpAuthService } from './mcp-auth.service';
import { ExchangeTokenDto } from './dto/exchange-token.dto';
import { OpenApiDocumentHolder } from './openapi-document.holder';

@Controller('mcp')
export class McpAuthController {
  constructor(
    private readonly mcpAuthService: McpAuthService,
    private readonly openApiDocumentHolder: OpenApiDocumentHolder,
  ) {}

  // No guard — the caller has no JWT yet, this is what gets it one (same
  // convention as AuthController.login).
  @Post('token')
  exchange(@Body() dto: ExchangeTokenDto) {
    return this.mcpAuthService.exchangeToken(dto.apiKey);
  }

  // Gated by the same JwtAuthGuard every other endpoint uses, not by
  // NODE_ENV — unlike the browsable /api-docs HTML, this works identically
  // in prod and dev, since mcp-saas needs it from a deployed backend too.
  @Get('openapi.json')
  @UseGuards(JwtAuthGuard)
  getOpenApiDocument() {
    return this.openApiDocumentHolder.getDocument();
  }
}
