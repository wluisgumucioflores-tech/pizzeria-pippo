import {
  buildOrderMessage,
  buildWhatsAppLink,
  computeLineTotal,
  computeOrderTotal,
  expiresAtFrom,
  isActionable,
  isExpired,
  normalizeWhatsAppNumber,
  round2,
  type PricedLine,
} from './online-order.lib';

const line = (over: Partial<PricedLine> = {}): PricedLine => ({
  productName: 'Pizza Napolitana',
  variantName: 'Grande',
  qty: 1,
  unitPrice: 70,
  ...over,
});

describe('online-order.lib', () => {
  describe('totales', () => {
    it('multiplica precio por cantidad', () => {
      expect(computeLineTotal(line({ qty: 3, unitPrice: 25 }))).toBe(75);
    });

    it('suma todas las líneas', () => {
      expect(
        computeOrderTotal([
          line({ qty: 2, unitPrice: 70 }),
          line({ qty: 1, unitPrice: 15.5 }),
        ]),
      ).toBe(155.5);
    });

    // El caso clásico de float: 0.1 * 3 = 0.30000000000000004. Si esto se
    // escapa, el total guardado no coincide con la suma de las líneas y la
    // confirmación en la Fase 3 cobra un centavo de más o de menos.
    it('redondea a 2 decimales en lugar de arrastrar error de punto flotante', () => {
      expect(computeOrderTotal([line({ qty: 3, unitPrice: 0.1 })])).toBe(0.3);
      expect(round2(10.005)).toBe(10.01);
    });

    it('un carrito vacío da 0, no NaN', () => {
      expect(computeOrderTotal([])).toBe(0);
    });
  });

  describe('expiración', () => {
    const created = new Date('2026-10-26T12:00:00Z');

    it('suma los minutos configurados', () => {
      expect(expiresAtFrom(created, 30).toISOString()).toBe(
        '2026-10-26T12:30:00.000Z',
      );
    });

    it('un pending dentro de la ventana es accionable y no está vencido', () => {
      const order = {
        status: 'pending',
        expiresAt: expiresAtFrom(created, 30),
      };
      const now = new Date('2026-10-26T12:29:59Z');
      expect(isActionable(order, now)).toBe(true);
      expect(isExpired(order, now)).toBe(false);
    });

    // El borde exacto: el cajero aprieta Confirmar en el segundo en que vence.
    // Tiene que quedar NO accionable, no "a veces sí".
    it('en el instante exacto del vencimiento ya no es accionable', () => {
      const order = {
        status: 'pending',
        expiresAt: expiresAtFrom(created, 30),
      };
      const now = new Date('2026-10-26T12:30:00Z');
      expect(isActionable(order, now)).toBe(false);
      expect(isExpired(order, now)).toBe(true);
    });

    it('un pedido ya resuelto nunca vuelve a contar como vencido ni accionable', () => {
      const past = { expiresAt: created };
      const now = new Date('2026-10-26T23:00:00Z');
      for (const status of ['confirmed', 'rejected', 'expired']) {
        expect(isExpired({ ...past, status }, now)).toBe(false);
        expect(isActionable({ ...past, status }, now)).toBe(false);
      }
    });
  });

  describe('WhatsApp', () => {
    it('deja solo dígitos, como exige wa.me', () => {
      expect(normalizeWhatsAppNumber('+591 7000-0000')).toBe('59170000000');
    });

    it('arma el link con el mensaje url-encodeado', () => {
      const url = buildWhatsAppLink('+59170000000', 'hola mundo');
      expect(url).toBe('https://wa.me/59170000000?text=hola%20mundo');
    });

    // Sin número configurado la página pública tiene que poder esconder el
    // botón, no abrir un link roto.
    it('devuelve string vacío si el negocio no configuró número', () => {
      expect(buildWhatsAppLink('', 'hola')).toBe('');
      expect(buildWhatsAppLink('sin-digitos', 'hola')).toBe('');
    });

    it('incluye items, total, datos del cliente y referencia en el mensaje', () => {
      const message = buildOrderMessage({
        businessName: 'Pizzería Pippo',
        branchName: 'Centro',
        customerName: 'Juan Pérez',
        customerPhone: '+59171234567',
        lines: [
          line({ qty: 2, unitPrice: 70 }),
          line({ productName: 'Coca', variantName: '2L', unitPrice: 15 }),
        ],
        total: 155,
        reference: 'A1B2C3',
      });

      expect(message).toContain('Pizzería Pippo');
      expect(message).toContain('Sucursal: Centro');
      expect(message).toContain('#A1B2C3');
      expect(message).toContain('2x Pizza Napolitana Grande — 140.00 Bs');
      expect(message).toContain('1x Coca 2L — 15.00 Bs');
      expect(message).toContain('*Total: 155.00 Bs*');
      expect(message).toContain('Juan Pérez');
      expect(message).toContain('+59171234567');
    });

    it('omite la línea de nota si no hay nota', () => {
      const base = {
        businessName: 'B',
        branchName: 'S',
        customerName: 'C',
        customerPhone: '+591700',
        lines: [line()],
        total: 70,
        reference: 'REF123',
      };

      expect(buildOrderMessage(base)).not.toContain('Nota:');
      expect(buildOrderMessage({ ...base, notes: '   ' })).not.toContain(
        'Nota:',
      );
      expect(buildOrderMessage({ ...base, notes: 'sin cebolla' })).toContain(
        'Nota: sin cebolla',
      );
    });
  });
});
