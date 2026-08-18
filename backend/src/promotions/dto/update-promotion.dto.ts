import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PromotionRuleInputDto } from './promotion-rule-input.dto';

const PROMOTION_TYPES = ['BUY_X_GET_Y', 'PERCENTAGE', 'COMBO'] as const;

export class UpdatePromotionDto {
  @IsString()
  name: string;

  @IsIn(PROMOTION_TYPES)
  type: (typeof PROMOTION_TYPES)[number];

  @IsArray()
  @IsInt({ each: true })
  days_of_week: number[];

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string | null;

  @IsBoolean()
  active: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionRuleInputDto)
  rules: PromotionRuleInputDto[];
}
