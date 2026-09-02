import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AI_MODEL_PROVIDERS } from '@pippo/shared';

const PROVIDER_VALUES = Object.keys(AI_MODEL_PROVIDERS);

export class CreateAiModelDto {
  // A protocol, not a brand — see packages/shared/src/constants/ai-model-providers.ts.
  @IsIn(PROVIDER_VALUES)
  provider!: string;

  @IsString()
  @MinLength(1)
  model_id!: string;

  @IsString()
  @MinLength(1)
  label!: string;

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
