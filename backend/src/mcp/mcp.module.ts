import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PasswordModule } from '../auth/password/password.module';
import { McpKeysController } from './mcp-keys.controller';
import { McpKeysService } from './mcp-keys.service';
import { McpAuthController } from './mcp-auth.controller';
import { McpAuthService } from './mcp-auth.service';
import { OpenApiDocumentHolder } from './openapi-document.holder';

@Module({
  imports: [AuthModule, PasswordModule],
  controllers: [McpKeysController, McpAuthController],
  providers: [McpKeysService, McpAuthService, OpenApiDocumentHolder],
  exports: [OpenApiDocumentHolder],
})
export class McpModule {}
