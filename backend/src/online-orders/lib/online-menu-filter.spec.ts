import {
  filterVisibleProducts,
  isProductVisibleOnline,
  type MenuVisibilityConfig,
} from './online-menu-filter';

const PIZZA = { id: 'p-pizza', categoryId: 'cat-pizzas' };
const SODA = { id: 'p-soda', categoryId: 'cat-bebidas' };
const SIN_CATEGORIA = { id: 'p-suelto', categoryId: null };

const config = (
  over: Partial<MenuVisibilityConfig> = {},
): MenuVisibilityConfig => ({
  mode: 'all',
  categoryIds: [],
  productIds: [],
  ...over,
});

describe('online-menu-filter', () => {
  describe('modo all', () => {
    it('muestra todo, incluso productos sin categoría', () => {
      const c = config({ mode: 'all' });
      expect(isProductVisibleOnline(PIZZA, c)).toBe(true);
      expect(isProductVisibleOnline(SIN_CATEGORIA, c)).toBe(true);
    });

    it('ignora las listas de ids guardadas de un modo anterior', () => {
      const c = config({
        mode: 'all',
        categoryIds: ['cat-pizzas'],
        productIds: [],
      });
      expect(isProductVisibleOnline(SODA, c)).toBe(true);
    });
  });

  describe('modo categories', () => {
    it('muestra solo los productos de las categorías elegidas', () => {
      const c = config({ mode: 'categories', categoryIds: ['cat-pizzas'] });
      expect(isProductVisibleOnline(PIZZA, c)).toBe(true);
      expect(isProductVisibleOnline(SODA, c)).toBe(false);
    });

    // Un producto sin categoría no puede "matchear" una selección de
    // categorías — si no, aparecería en el menú sin que el admin lo eligiera.
    it('nunca muestra un producto sin categoría', () => {
      const c = config({ mode: 'categories', categoryIds: ['cat-pizzas'] });
      expect(isProductVisibleOnline(SIN_CATEGORIA, c)).toBe(false);
    });

    it('sin categorías elegidas no muestra nada', () => {
      const c = config({ mode: 'categories', categoryIds: [] });
      expect(isProductVisibleOnline(PIZZA, c)).toBe(false);
    });
  });

  describe('modo products', () => {
    it('muestra solo los productos tildados, sin importar su categoría', () => {
      const c = config({
        mode: 'products',
        productIds: ['p-soda', 'p-suelto'],
      });
      expect(isProductVisibleOnline(SODA, c)).toBe(true);
      expect(isProductVisibleOnline(SIN_CATEGORIA, c)).toBe(true);
      expect(isProductVisibleOnline(PIZZA, c)).toBe(false);
    });

    it('sin productos elegidos no muestra nada', () => {
      expect(isProductVisibleOnline(PIZZA, config({ mode: 'products' }))).toBe(
        false,
      );
    });
  });

  // Si algún día se agrega un modo nuevo y se olvida acá, el menú público
  // debe quedar VACÍO, nunca exponer el catálogo entero por descuido.
  it('un modo desconocido falla cerrado (esconde todo)', () => {
    const c = {
      ...config(),
      mode: 'modo-futuro',
    } as unknown as MenuVisibilityConfig;
    expect(isProductVisibleOnline(PIZZA, c)).toBe(false);
  });

  it('filterVisibleProducts conserva el orden y solo saca los ocultos', () => {
    const result = filterVisibleProducts(
      [PIZZA, SODA, SIN_CATEGORIA],
      config({ mode: 'products', productIds: ['p-suelto', 'p-pizza'] }),
    );
    expect(result).toEqual([PIZZA, SIN_CATEGORIA]);
  });
});
