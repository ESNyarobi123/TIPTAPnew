import QRCode from 'qrcode';

export type RenderQrSvgOptions = {
  size?: number;
  margin?: number;
  foreground?: string;
  background?: string;
};

export async function renderQrSvg(
  value: string,
  {
    size = 280,
    margin = 1,
    foreground = '#111827',
    background = '#FFFFFFFF',
  }: RenderQrSvgOptions = {},
) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return QRCode.toString(trimmed, {
    type: 'svg',
    width: size,
    margin,
    errorCorrectionLevel: 'M',
    color: {
      dark: foreground,
      light: background,
    },
  });
}
