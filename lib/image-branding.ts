import sharp from "sharp";

export async function applyOfficialLogo(
  generatedImage: Uint8Array,
  logoData?: string,
) {
  if (!logoData) {
    return { data: generatedImage, mimeType: "image/png" };
  }

  const source = Buffer.from(generatedImage);
  const metadata = await sharp(source).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) throw new Error("Generated image dimensions are invalid");

  const shortSide = Math.min(width, height);
  const badgeWidth = Math.round(shortSide * 0.23);
  const badgeHeight = Math.round(shortSide * 0.135);
  const outerMargin = Math.round(shortSide * 0.035);
  const innerPaddingX = Math.round(badgeWidth * 0.1);
  const innerPaddingY = Math.round(badgeHeight * 0.13);
  const radius = Math.round(badgeHeight * 0.28);
  const left = width - badgeWidth - outerMargin;
  const top = outerMargin;

  const badge = Buffer.from(
    `<svg width="${badgeWidth}" height="${badgeHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${badgeWidth - 2}" height="${badgeHeight - 2}" rx="${radius}" fill="#ffffff" stroke="#e2d7e8" stroke-width="2"/>
    </svg>`,
  );
  const logo = await sharp(Buffer.from(logoData, "base64"))
    .resize({
      width: badgeWidth - innerPaddingX * 2,
      height: badgeHeight - innerPaddingY * 2,
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  const data = await sharp(source)
    .composite([
      { input: badge, left, top },
      {
        input: logo,
        left: left + innerPaddingX,
        top: top + innerPaddingY,
      },
    ])
    .png()
    .toBuffer();

  return { data: new Uint8Array(data), mimeType: "image/png" };
}
