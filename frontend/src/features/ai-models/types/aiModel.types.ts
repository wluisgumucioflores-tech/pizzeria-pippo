export interface AiModel {
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

export interface CreateAiModelInput {
  provider: string;
  model_id: string;
  label: string;
  base_url?: string;
  api_key?: string;
  is_local?: boolean;
  is_active?: boolean;
  is_default?: boolean;
}

export interface UpdateAiModelInput {
  provider?: string;
  model_id?: string;
  label?: string;
  base_url?: string;
  api_key?: string;
  is_local?: boolean;
  is_active?: boolean;
  is_default?: boolean;
}
