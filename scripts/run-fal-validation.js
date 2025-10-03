import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VideoGenerationService } from '../src/services/videoGenerationService.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function findSampleImage(inputDir) {
  const files = fs.readdirSync(inputDir).filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i));
  if (!files.length) throw new Error(`No image files found in ${inputDir}`);
  // pick the first for determinism
  return path.join(inputDir, files.sort()[0]);
}

function moveWithMeta(resultPath, destDir) {
  ensureDir(destDir);
  const isVideo = resultPath.toLowerCase().endsWith('.mp4');
  const isPlaceholder = resultPath.toLowerCase().endsWith('_placeholder.jpg');

  let metaSrc = null;
  if (isVideo) {
    metaSrc = resultPath.replace(/\.mp4$/i, '.txt');
  } else if (isPlaceholder) {
    metaSrc = resultPath.replace(/_placeholder\.jpg$/i, '.txt');
  }

  const baseName = path.basename(resultPath);
  const destMain = path.join(destDir, baseName);
  fs.copyFileSync(resultPath, destMain);

  if (metaSrc && fs.existsSync(metaSrc)) {
    const metaDest = path.join(destDir, path.basename(metaSrc));
    fs.copyFileSync(metaSrc, metaDest);
  }

  return { destMain, meta: metaSrc ? path.join(destDir, path.basename(metaSrc)) : null };
}

async function validate() {
  const inputDir = path.resolve(__dirname, '..', 'input');
  const testsRoot = path.resolve(__dirname, '..', 'output', 'tests');
  ensureDir(testsRoot);

  const imagePath = findSampleImage(inputDir);
  const originalFileName = path.basename(imagePath);

  const models = [
    { id: 'wan-2.2-turbo', name: 'WAN 2.2 Turbo', dir: path.join(testsRoot, 'wan-22') },
    { id: 'wan-2.5-preview', name: 'WAN 2.5 Preview', dir: path.join(testsRoot, 'wan-25') },
    { id: 'kling-v2.5-turbo', name: 'Kling 2.5 Turbo Pro', dir: path.join(testsRoot, 'kling-25') },
  ];

  const vgs = new VideoGenerationService();

  console.log('🔎 Validating FAL models (real API)');
  console.log(`📸 Sample image: ${imagePath}`);

  for (const m of models) {
    console.log(`\n➡️  Testing ${m.name}...`);
    try {
      vgs.setModel(m.id);
      const prompt = `Validation run for ${m.name}. Use the provided image to generate a short spooky clip.`;

      const resultPath = await vgs.generateVideo(prompt, imagePath, originalFileName);

      const { destMain, meta } = moveWithMeta(resultPath, m.dir);

      const isRealVideo = destMain.toLowerCase().endsWith('.mp4');
      const size = fs.existsSync(destMain) ? fs.statSync(destMain).size : 0;
      const status = isRealVideo ? 'SUCCESS (video)' : 'FALLBACK (placeholder)';

      const note = `Model: ${m.name}\nResult: ${status}\nOutput: ${destMain}\nMetadata: ${meta || 'N/A'}\nSize: ${size} bytes\nTimestamp: ${new Date().toISOString()}\n`;
      fs.writeFileSync(path.join(m.dir, 'README.txt'), note);

      console.log(`✅ ${m.name}: ${status}. Saved to ${m.dir}`);
    } catch (err) {
      console.error(`❌ ${m.name} failed: ${err.message}`);
      const note = `Model: ${m.name}\nResult: ERROR\nMessage: ${err.message}\nTimestamp: ${new Date().toISOString()}\n`;
      ensureDir(m.dir);
      fs.writeFileSync(path.join(m.dir, 'README.txt'), note);
    }
  }

  console.log(`\n📁 Validation results under: ${testsRoot}`);
}

validate().catch(err => {
  console.error('Validation script error:', err);
  process.exit(1);
});
