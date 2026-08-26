export interface McpKey {
  id: string;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface CreateMcpKeyResult {
  key: McpKey;
  apiKey: string;
}
