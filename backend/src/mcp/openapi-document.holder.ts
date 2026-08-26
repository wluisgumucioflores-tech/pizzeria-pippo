import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

// Set once from main.ts right after SwaggerModule.createDocument() — never
// regenerated or fetched, just the same in-memory object handed to whoever
// asks (GET /mcp/openapi.json).
@Injectable()
export class OpenApiDocumentHolder {
  private document: OpenAPIObject | null = null;

  setDocument(document: OpenAPIObject): void {
    this.document = document;
  }

  getDocument(): OpenAPIObject {
    if (!this.document) {
      throw new InternalServerErrorException('El documento OpenAPI todavía no fue inicializado');
    }
    return this.document;
  }
}
