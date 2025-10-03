import crypto from 'crypto';

function computeShortId(...parts) {
  try {
    const hash = crypto.createHash('sha1');
    for (const p of parts) hash.update(String(p));
    return hash.digest('hex').slice(0, 6);
  } catch {
    // Fallback: random short id
    return Math.random().toString(36).slice(2, 8);
  }
}

export function createImageLogger(filePath, fileName) {
  const baseName = String(fileName || '').trim() || 'image';
  const id = computeShortId(filePath || '', baseName);
  const prefix = `[${id} ${baseName}]`;

  const format = (icon, msg) => `${icon} ${prefix} ${msg}`;

  return {
    id,
    name: baseName,
    info: (msg = '') => console.log(format('•', msg)),
    stage: (msg = '') => console.log(format('▶️', msg)),
    success: (msg = '') => console.log(format('✅', msg)),
    warn: (msg = '') => console.warn(format('⚠️', msg)),
    error: (msg = '') => console.error(format('❌', msg))
  };
}

