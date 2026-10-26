import { resolveTrustProxyHops } from './trust-proxy';

describe('resolveTrustProxyHops', () => {
  it('devuelve el número de saltos configurado', () => {
    expect(resolveTrustProxyHops('1')).toBe(1);
    expect(resolveTrustProxyHops('2')).toBe(2);
    expect(resolveTrustProxyHops('0')).toBe(0);
  });

  it('tolera espacios alrededor', () => {
    expect(resolveTrustProxyHops(' 1 ')).toBe(1);
  });

  it('sin variable no confía en ningún proxy', () => {
    expect(resolveTrustProxyHops(undefined)).toBe(0);
    expect(resolveTrustProxyHops('')).toBe(0);
    expect(resolveTrustProxyHops('   ')).toBe(0);
  });

  // Este es el punto de todo el archivo: un valor basura tiene que degradar a
  // 0 (límite global, molesto pero seguro) y NUNCA a un número que haga
  // falsificable la IP del cliente.
  it('degrada a 0 ante cualquier valor inválido', () => {
    expect(resolveTrustProxyHops('true')).toBe(0);
    expect(resolveTrustProxyHops('yes')).toBe(0);
    expect(resolveTrustProxyHops('-1')).toBe(0);
    expect(resolveTrustProxyHops('abc')).toBe(0);
    expect(resolveTrustProxyHops('NaN')).toBe(0);
    expect(resolveTrustProxyHops('Infinity')).toBe(0);
  });

  // parseInt('2abc') daría 2 y parseInt('1.9') daría 1: los dos aceptarían en
  // silencio un valor mal tipeado, y acá un dígito de más o de menos cambia
  // qué dirección del header se considera la del cliente.
  it('no acepta un número con cola de basura ni un decimal', () => {
    expect(resolveTrustProxyHops('2abc')).toBe(0);
    expect(resolveTrustProxyHops('1.9')).toBe(0);
    expect(resolveTrustProxyHops('1,9')).toBe(0);
    expect(resolveTrustProxyHops('0x2')).toBe(0);
  });
});
