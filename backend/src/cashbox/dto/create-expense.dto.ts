import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CASH_EXPENSE_CATEGORIES, type CashExpenseCategory } from '../constants/cash-expense-categories';

export class CreateExpenseDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn(CASH_EXPENSE_CATEGORIES)
  category: CashExpenseCategory;

  @IsOptional()
  @IsString()
  note?: string;
}
