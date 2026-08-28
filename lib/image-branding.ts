import sharp from "sharp";

async function transparentLogo(logoData: string) {
  const input = await sharp(Buffer.from(logoData, "base64"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = input.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const distanceFromWhite = Math.max(
      255 - pixels[i],
      255 - pixels[i + 1],
      255 - pixels[i + 2],
    );
    if (distanceFromWhite <= 10) pixels[i + 3] = 0;
    else if (distanceFromWhite < 26)
      pixels[i + 3] = Math.round(
        pixels[i + 3] * ((distanceFromWhite - 10) / 16),
      );
  }
  return sharp(pixels, {
    raw: {
      width: input.info.width,
      height: input.info.height,
      channels: 4,
    },
  })
    .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

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
  const clearWidth = Math.round(shortSide * 0.205);
  const clearHeight = Math.round(shortSide * 0.22);
  const clearRight = Math.round(shortSide * 0.035);
  const clearTop = Math.round(shortSide * 0.032);
  const logoWidth = Math.round(shortSide * 0.17);
  const logoHeight = Math.round(shortSide * 0.12);
  const logoRight = Math.round(shortSide * 0.055);
  const logoTop = Math.round(shortSide * 0.05);
  const clearLeft = width - clearWidth - clearRight;
  const logoLeft = width - logoWidth - logoRight;

  const cleanArea = Buffer.from(
    `<svg width="${clearWidth}" height="${clearHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${clearWidth}" height="${clearHeight}" fill="#ffffff"/>
    </svg>`,
  );
  const logo = await sharp(await transparentLogo(logoData))
    .resize({
      width: logoWidth,
      height: logoHeight,
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  const data = await sharp(source)
    .composite([
      { input: cleanArea, left: clearLeft, top: clearTop },
      { input: logo, left: logoLeft, top: logoTop },
    ])
    .png()
    .toBuffer();

  return { data: new Uint8Array(data), mimeType: "image/png" };
}
