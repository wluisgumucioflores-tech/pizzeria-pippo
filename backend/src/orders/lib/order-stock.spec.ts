import { computeStockDeductions } from './order-stock';
import type { RecipeRow, StockItem, StockControlFlags } from './order-stock';

const pizzaRecipe: RecipeRow[] = [
  { ingredient_id: 'masa', quantity: 1, apply_condition: 'always', is_shared_use: false },
  { ingredient_id: 'queso', quantity: 200, apply_condition: 'always', is_shared_use: false },
  { ingredient_id: 'caja', quantity: 1, apply_condition: 'takeaway', is_shared_use: true },
];

const ALL_ON: StockControlFlags = { resale: true, insumos: true, madeUnit: false };

function makeItem(overrides: Partial<StockItem> = {}): StockItem {
  return { variant_id: 'v-haw', qty_physical: 1, product_type: 'made', ...overrides };
}

describe('computeStockDeductions — made products', () => {
  it('deducts the full recipe multiplied by physical qty', () => {
    const result = computeStockDeductions([makeItem({ qty_physical: 2 })], { 'v-haw': pizzaRecipe }, 'dine_in', ALL_ON);
    expect(result.ingredient_deductions).toEqual(
      expect.arrayContaining([
        { ingredient_id: 'masa', quantity: 2 },
        { ingredient_id: 'queso', quantity: 400 },
      ]),
    );
    expect(result.resale_deductions).toHaveLength(0);
  });

  it('respects apply_condition: takeaway-only ingredients skip dine_in orders', () => {
    const dineIn = computeStockDeductions([makeItem()], { 'v-haw': pizzaRecipe }, 'dine_in', ALL_ON);
    expect(dineIn.ingredient_deductions.find((d) => d.ingredient_id === 'caja')).toBeUndefined();

    const takeaway = computeStockDeductions([makeItem()], { 'v-haw': pizzaRecipe }, 'takeaway', ALL_ON);
    expect(takeaway.ingredient_deductions).toContainEqual({ ingredient_id: 'caja', quantity: 1 });
  });

  it('aggregates the same ingredient across items', () => {
    const result = computeStockDeductions(
      [makeItem(), makeItem({ variant_id: 'v-pep' })],
      { 'v-haw': pizzaRecipe, 'v-pep': [{ ingredient_id: 'queso', quantity: 150, apply_condition: 'always', is_shared_use: false }] },
      'dine_in',
      ALL_ON,
    );
    expect(result.ingredient_deductions).toContainEqual({ ingredient_id: 'queso', quantity: 350 });
  });

  it('uses flavor recipes weighted by proportion for mixed pizzas', () => {
    const result = computeStockDeductions(
      [
        makeItem({
          variant_id: 'v-mixta',
          flavors: [
            { variant_id: 'v-haw', proportion: 0.5 },
            { variant_id: 'v-pep', proportion: 0.5 },
          ],
        }),
      ],
      {
        'v-haw': [{ ingredient_id: 'pina', quantity: 100, apply_condition: 'always', is_shared_use: false }],
        'v-pep': [{ ingredient_id: 'pepperoni', quantity: 80, apply_condition: 'always', is_shared_use: false }],
      },
      'dine_in',
      ALL_ON,
    );
    expect(result.ingredient_deductions).toContainEqual({ ingredient_id: 'pina', quantity: 50 });
    expect(result.ingredient_deductions).toContainEqual({ ingredient_id: 'pepperoni', quantity: 40 });
  });

  it('returns nothing for variants without recipes', () => {
    const result = computeStockDeductions([makeItem()], {}, 'dine_in', ALL_ON);
    expect(result.ingredient_deductions).toHaveLength(0);
  });

  // Reproduces bug 05 (bugs/open/05-stock-mitad-mitad-receta-incompleta.md):
  // a mixed-flavor pizza where only one of the two flavor variants has the
  // shared-use ingredient's recipe (the other is "orphaned", missing it entirely).
  it('deducts a shared-use ingredient once whole, even if only one flavor variant carries its recipe', () => {
    const result = computeStockDeductions(
      [
        makeItem({
          variant_id: 'v-familiar-a',
          flavors: [
            { variant_id: 'v-familiar-a', proportion: 0.5 },
            { variant_id: 'v-familiar-b', proportion: 0.5 },
          ],
        }),
      ],
      {
        'v-familiar-a': [{ ingredient_id: 'caja-familiar', quantity: 1, apply_condition: 'takeaway', is_shared_use: true }],
        'v-familiar-b': [], // sabor huérfano: sin receta cargada, como en producción
      },
      'takeaway',
      ALL_ON,
    );
    expect(result.ingredient_deductions).toContainEqual({ ingredient_id: 'caja-familiar', quantity: 1 });
  });

  it('still prorates non-shared ingredients per flavor when a shared ingredient is also present', () => {
    const result = computeStockDeductions(
      [
        makeItem({
          variant_id: 'v-familiar-a',
          flavors: [
            { variant_id: 'v-familiar-a', proportion: 0.5 },
            { variant_id: 'v-familiar-b', proportion: 0.5 },
          ],
        }),
      ],
      {
        'v-familiar-a': [
          { ingredient_id: 'caja-familiar', quantity: 1, apply_condition: 'always', is_shared_use: true },
          { ingredient_id: 'queso', quantity: 200, apply_condition: 'always', is_shared_use: false },
        ],
        'v-familiar-b': [{ ingredient_id: 'queso', quantity: 200, apply_condition: 'always', is_shared_use: false }],
      },
      'takeaway',
      ALL_ON,
    );
    expect(result.ingredient_deductions).toContainEqual({ ingredient_id: 'caja-familiar', quantity: 1 });
    expect(result.ingredient_deductions).toContainEqual({ ingredient_id: 'queso', quantity: 200 });
  });

  it('deducts shared-use ingredients independently per item (no cross-item dedupe)', () => {
    const result = computeStockDeductions(
      [
        makeItem({
          variant_id: 'v-familiar-a',
          flavors: [{ variant_id: 'v-familiar-a', proportion: 1 }],
        }),
        makeItem({
          variant_id: 'v-familiar-a',
          flavors: [
            { variant_id: 'v-familiar-a', proportion: 0.5 },
            { variant_id: 'v-familiar-b', proportion: 0.5 },
          ],
        }),
      ],
      {
        'v-familiar-a': [{ ingredient_id: 'caja-familiar', quantity: 1, apply_condition: 'always', is_shared_use: true }],
        'v-familiar-b': [],
      },
      'takeaway',
      ALL_ON,
    );
    expect(result.ingredient_deductions).toContainEqual({ ingredient_id: 'caja-familiar', quantity: 2 });
  });

  it('flags a flavor variant with zero recipes as incomplete, without blocking the deduction', () => {
    const result = computeStockDeductions(
      [
        makeItem({
          variant_id: 'v-familiar-a',
          flavors: [
            { variant_id: 'v-familiar-a', proportion: 0.5 },
            { variant_id: 'v-familiar-b', proportion: 0.5 },
          ],
        }),
      ],
      {
        'v-familiar-a': [{ ingredient_id: 'caja-familiar', quantity: 1, apply_condition: 'always', is_shared_use: true }],
        'v-familiar-b': [],
      },
      'takeaway',
      ALL_ON,
    );
    expect(result.incomplete_recipe_variant_ids).toEqual(['v-familiar-b']);
    expect(result.ingredient_deductions).toContainEqual({ ingredient_id: 'caja-familiar', quantity: 1 });
  });

  it('does not flag anything when every flavor variant has at least one recipe', () => {
    const result = computeStockDeductions(
      [
        makeItem({
          variant_id: 'v-mixta',
          flavors: [
            { variant_id: 'v-haw', proportion: 0.5 },
            { variant_id: 'v-pep', proportion: 0.5 },
          ],
        }),
      ],
      {
        'v-haw': [{ ingredient_id: 'pina', quantity: 100, apply_condition: 'always', is_shared_use: false }],
        'v-pep': [{ ingredient_id: 'pepperoni', quantity: 80, apply_condition: 'always', is_shared_use: false }],
      },
      'dine_in',
      ALL_ON,
    );
    expect(result.incomplete_recipe_variant_ids).toEqual([]);
  });
});

describe('computeStockDeductions — resale products', () => {
  it('deducts physical units per variant without touching ingredients', () => {
    const result = computeStockDeductions(
      [
        makeItem({ variant_id: 'v-coca', product_type: 'resale', qty_physical: 3 }),
        makeItem({ variant_id: 'v-coca', product_type: 'resale', qty_physical: 1 }),
      ],
      {},
      'dine_in',
      ALL_ON,
    );
    expect(result.resale_deductions).toEqual([{ variant_id: 'v-coca', quantity: 4 }]);
    expect(result.ingredient_deductions).toHaveLength(0);
  });

  it('deducts nothing when the "Reventa" switch is off, since resale has no recipe to fall back to', () => {
    const result = computeStockDeductions(
      [makeItem({ variant_id: 'v-coca', product_type: 'resale', qty_physical: 3 })],
      {},
      'dine_in',
      { ...ALL_ON, resale: false },
    );
    expect(result.resale_deductions).toHaveLength(0);
    expect(result.ingredient_deductions).toHaveLength(0);
  });
});

describe('computeStockDeductions — made products, business-wide inventory switches', () => {
  it('with "Elaboración propia por unidad" on, deducts a physical unit from branch stock, ignoring any configured recipe', () => {
    const result = computeStockDeductions(
      [makeItem({ variant_id: 'v-alfajor', qty_physical: 2 })],
      { 'v-alfajor': pizzaRecipe },
      'dine_in',
      { ...ALL_ON, madeUnit: true },
    );
    expect(result.resale_deductions).toEqual([{ variant_id: 'v-alfajor', quantity: 2 }]);
    expect(result.ingredient_deductions).toHaveLength(0);
  });

  it('with "Elaboración propia por unidad" off (default) and "Insumos" on, falls back to the ingredient recipe', () => {
    const result = computeStockDeductions([makeItem({ variant_id: 'v-haw' })], { 'v-haw': pizzaRecipe }, 'dine_in', ALL_ON);
    expect(result.resale_deductions).toHaveLength(0);
    expect(result.ingredient_deductions.length).toBeGreaterThan(0);
  });

  it('with "Insumos" off, deducts nothing for made products (no unit tracking, no recipe)', () => {
    const result = computeStockDeductions(
      [makeItem({ variant_id: 'v-haw' })],
      { 'v-haw': pizzaRecipe },
      'dine_in',
      { ...ALL_ON, insumos: false },
    );
    expect(result.resale_deductions).toHaveLength(0);
    expect(result.ingredient_deductions).toHaveLength(0);
  });

  it('"Elaboración propia por unidad" takes priority over "Insumos" when both are on', () => {
    const result = computeStockDeductions(
      [makeItem({ variant_id: 'v-alfajor' })],
      { 'v-alfajor': pizzaRecipe },
      'dine_in',
      { resale: true, insumos: true, madeUnit: true },
    );
    expect(result.resale_deductions).toEqual([{ variant_id: 'v-alfajor', quantity: 1 }]);
    expect(result.ingredient_deductions).toHaveLength(0);
  });
});
