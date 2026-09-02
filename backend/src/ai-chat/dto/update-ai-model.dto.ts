import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AI_MODEL_PROVIDERS } from '@pippo/shared';

const PROVIDER_VALUES = Object.keys(AI_MODEL_PROVIDERS);

export class UpdateAiModelDto {
  // A protocol, not a brand — see packages/shared/src/constants/ai-model-providers.ts.
  @IsOptional()
  @IsIn(PROVIDER_VALUES)
  provider?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  model_id?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsString()
  base_url?: string;

  @IsOptional()
  @IsString()
  api_key?: string;

  @IsOptional()
  @IsBoolean()
  is_local?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
