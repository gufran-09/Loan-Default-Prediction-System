import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Generate apple-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'apple-icon.png'));
  console.log('Generated public/apple-icon.png (180x180)');

  // 2. Generate icon-light-32x32.png
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'icon-light-32x32.png'));
  console.log('Generated public/icon-light-32x32.png (32x32)');

  // 3. Generate icon-dark-32x32.png
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'icon-dark-32x32.png'));
  console.log('Generated public/icon-dark-32x32.png (32x32)');

  // 4. Generate favicon.ico (32x32 png container compatible with modern browsers)
  const icoBuffer = await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(__dirname, '..', 'app', 'favicon.ico'), icoBuffer);
  console.log('Generated public/favicon.ico & app/favicon.ico');

  // 5. Copy icon.svg to app/icon.svg for Next.js App Router metadata conventions
  fs.copyFileSync(svgPath, path.join(__dirname, '..', 'app', 'icon.svg'));
  console.log('Copied to app/icon.svg');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
