export interface AiModelResult {
  id: string;
  provider: string;
  model_id: string;
  label: string;
  base_url: string | null;
  has_api_key: boolean;
  is_local: boolean;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}
