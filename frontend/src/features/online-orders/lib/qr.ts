import QRCode from "qrcode";

// 512px so the downloaded PNG survives being printed and taped to a table.
// Anything smaller looks fine on screen and pixelates on paper.
export const QR_IMAGE_SIZE = 512;

// Error correction "M" is the usual balance: it tolerates a scuffed or partly
// covered sticker without making the code noticeably denser.
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: QR_IMAGE_SIZE,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}
