import { HttpException } from '@nestjs/common';
import { SupabaseStorageService } from './supabase-storage.service';

const toBufferMock = jest
  .fn()
  .mockResolvedValue(Buffer.from('optimized-webp-bytes'));
const webpMock = jest.fn().mockReturnValue({ toBuffer: toBufferMock });
const resizeMock = jest.fn().mockReturnValue({ webp: webpMock });

jest.mock('sharp', () => jest.fn(() => ({ resize: resizeMock })));

describe('SupabaseStorageService', () => {
  const originalEnv = process.env;
  let service: SupabaseStorageService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    };
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    service = new SupabaseStorageService();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('redimensiona y convierte a WebP calidad 80 antes de subir al bucket product-images', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const result = await service.uploadProductImage({
      buffer: Buffer.from('fake-original-image'),
      originalName: 'pizza.png',
      mimeType: 'image/png',
    });

    expect(resizeMock).toHaveBeenCalledWith({
      width: 800,
      withoutEnlargement: true,
    });
    expect(webpMock).toHaveBeenCalledWith({ quality: 80 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^http:\/\/localhost:54321\/storage\/v1\/object\/product-images\/\d+\.webp$/,
      ),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'test-key',
          Authorization: 'Bearer test-key',
          'Content-Type': 'image/webp',
          'x-upsert': 'true',
        }),
        body: Buffer.from('optimized-webp-bytes'),
      }),
    );
    expect(result.url).toMatch(
      /^http:\/\/localhost:54321\/storage\/v1\/object\/public\/product-images\/\d+\.webp$/,
    );
  });

  it('lanza HttpException con el status real si Supabase Storage responde error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 413,
      text: async () => 'Payload too large',
    });

    await expect(
      service.uploadProductImage({
        buffer: Buffer.from('x'),
        originalName: 'a.png',
        mimeType: 'image/png',
      }),
    ).rejects.toThrow(HttpException);
  });
});
