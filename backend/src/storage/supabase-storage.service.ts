import { HttpException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import type { StoragePort, StorageUploadFile } from './storage.port';

const PRODUCT_IMAGES_BUCKET = 'product-images';

// Supabase Storage Image Transformations (el endpoint /render/image, que
// redimensiona al vuelo) es una feature de plan Pro+ — no disponible en free
// tier. Como alternativa que funciona en cualquier plan, la optimización se
// hace acá, una sola vez, al momento de subir la imagen: se reduce a un
// ancho razonable y se convierte a WebP calidad 80 antes de guardarla. Todo
// lo que lea `image_url` después recibe directo el archivo ya liviano, sin
// depender de transformación on-demand.
const MAX_WIDTH = 800;
const WEBP_QUALITY = 80;

// Concrete implementation of StoragePort: calls Supabase's Storage REST API
// directly with the service role key, without the @supabase/supabase-js SDK
// (same discipline as SupabaseAuthAdminService for Users). Swapping to a
// different S3-compatible provider later only means writing a new adapter.
@Injectable()
export class SupabaseStorageService implements StoragePort {
  private readonly baseUrl = `${process.env.SUPABASE_URL}/storage/v1`;

  private get headers(): Record<string, string> {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    return { apikey: key, Authorization: `Bearer ${key}` };
  }

  async uploadProductImage(file: StorageUploadFile): Promise<{ url: string }> {
    const optimized = await sharp(file.buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const fileName = `${Date.now()}.webp`;

    const res = await fetch(
      `${this.baseUrl}/object/${PRODUCT_IMAGES_BUCKET}/${fileName}`,
      {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'image/webp',
          'x-upsert': 'true',
        },
        // Node's fetch (undici) accepts a Buffer body at runtime; the DOM lib
        // types just don't model Buffer as a valid BodyInit.
        body: optimized as unknown as BodyInit,
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new HttpException(body || 'Error al subir la imagen', res.status);
    }

    return {
      url: `${process.env.SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${fileName}`,
    };
  }
}
