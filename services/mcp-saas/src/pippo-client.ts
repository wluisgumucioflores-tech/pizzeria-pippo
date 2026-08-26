// Wraps the key -> JWT exchange with the Pippo backend (POST /mcp/token)
// and caches the resulting short-lived token in memory for the lifetime of
// this instance (one per cached tenant session, see index.ts), re-exchanging
// whenever the cached token is close to expiry or the backend answers 401.
export class PippoClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async fetchOpenApiSpec(): Promise<unknown> {
    const token = await this.getBearerToken();
    const res = await fetch(`${this.baseUrl}/mcp/openapi.json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`No se pudo obtener el spec de OpenAPI (${res.status})`);
    }
    return res.json();
  }

  async getBearerToken(): Promise<string> {
    // 30s of slack so a token doesn't expire mid-flight between this check
    // and the caller actually using it.
    if (this.token && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.token;
    }
    return this.exchangeToken();
  }

  // Called by the tool executor on a 401 — forces a fresh exchange instead
  // of trusting the cached (apparently still-valid) token.
  async refreshToken(): Promise<string> {
    return this.exchangeToken();
  }

  private async exchangeToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/mcp/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey }),
    });
    if (!res.ok) {
      throw new Error(`API key inválido o revocado (${res.status})`);
    }
    const data = (await res.json()) as { access_token: string };
    this.token = data.access_token;
    // Matches AGENT_JWT_TTL_SECONDS in backend/src/mcp/mcp-auth.service.ts.
    this.tokenExpiresAt = Date.now() + 5 * 60 * 1000;
    return this.token;
  }
}
