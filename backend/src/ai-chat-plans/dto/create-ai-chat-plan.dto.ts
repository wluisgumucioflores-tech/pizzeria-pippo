import { IsArray, IsIn, IsInt, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';
import { AI_CHAT_WRITE_DOMAINS } from '../constants/write-domains.constant';

export class CreateAiChatPlanDto {
  @IsString()
  @MinLength(1)
  name!: string;

  // Empty/omitted = no limit (unlimited plan).
  @IsOptional()
  @IsInt()
  @IsPositive()
  messages_per_day?: number | null;

  // Model (ai_models.id) used by businesses on this plan. No selector
  // in the business panel (Phase 1) — the superadmin sets it here.
  @IsOptional()
  @IsUUID()
  model_id?: string | null;

  // Write domains the orchestrator's agent is allowed to use for businesses on this
  // plan (e.g. "branches", "stock"). Empty/omitted = read-only for those domains.
  @IsOptional()
  @IsArray()
  @IsIn(AI_CHAT_WRITE_DOMAINS, { each: true })
  allowed_write_domains?: string[];
}
