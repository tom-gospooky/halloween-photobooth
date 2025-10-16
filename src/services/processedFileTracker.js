import fs from 'fs';
import crypto from 'crypto';

export class ProcessedFileTracker {
  constructor() {
    this.trackingFile = './processed-files.json';
    this.processedFiles = new Map();
    this.isInitialized = false;
    // Rate limit 'currently processing' logs to avoid spam
    this._lastProcessingLog = new Map();
  }

  async initialize() {
    try {
      await this.loadProcessedFiles();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize processed file tracker:', error);
      return false;
    }
  }

  async loadProcessedFiles() {
    try {
      if (fs.existsSync(this.trackingFile)) {
        const data = fs.readFileSync(this.trackingFile, 'utf8');
        const processedData = JSON.parse(data);

        this.processedFiles = new Map(Object.entries(processedData));
      } else {
        this.processedFiles = new Map();
      }
    } catch (error) {
      console.warn('⚠️  Could not load processed files tracking - starting fresh:', error.message);
      this.processedFiles = new Map();
    }
  }

  async saveProcessedFiles() {
    try {
      const processedData = Object.fromEntries(this.processedFiles);
      fs.writeFileSync(this.trackingFile, JSON.stringify(processedData, null, 2));
    } catch (error) {
      console.error('❌ Failed to save processed files tracking:', error);
    }
  }

  generateFileHash(filePath) {
    try {
      // Create hash based on file content and stats for robust identification
      const fileBuffer = fs.readFileSync(filePath);
      const stats = fs.statSync(filePath);

      const hash = crypto.createHash('sha256');
      hash.update(fileBuffer);
      hash.update(stats.size.toString());
      hash.update(stats.birthtime.toISOString());

      return hash.digest('hex');
    } catch (error) {
      console.error(`Error generating hash for ${filePath}:`, error);
      return null;
    }
  }

  isFileProcessed(filePath, fileName) {
    // Check multiple identifiers for maximum reliability
    const fileHash = this.generateFileHash(filePath);
    if (!fileHash) return false;

    // Check by hash (most reliable)
    if (this.processedFiles.has(fileHash)) {
      const record = this.processedFiles.get(fileHash);
      if (record.status === 'completed') {
        return true;
      }
    }

    // Check by filename (backup method)
    for (const [, record] of this.processedFiles.entries()) {
      if (record.fileName === fileName && record.filePath === filePath && record.status === 'completed') {
        return true;
      }
    }

    return false;
  }

  async markFileAsProcessed(filePath, fileName, videoOutputPath = null, extra = {}) {
    try {
      const fileHash = this.generateFileHash(filePath);
      if (!fileHash) {
        console.warn(`⚠️  Could not generate hash for ${fileName} - marking by path only`);
        return;
      }

      const stats = fs.statSync(filePath);
      const record = {
        fileName: fileName,
        filePath: filePath,
        fileHash: fileHash,
        fileSize: stats.size,
        fileModified: stats.mtime.toISOString(),
        processedAt: new Date().toISOString(),
        videoOutput: videoOutputPath,
        status: 'completed',
        stage: 'completed',
        stageAt: new Date().toISOString(),
        ...(extra && typeof extra === 'object' ? extra : {})
      };

      this.processedFiles.set(fileHash, record);
      await this.saveProcessedFiles();
    } catch (error) {
      console.error(`❌ Failed to mark file as processed: ${fileName}`, error);
    }
  }

  async markFileAsProcessing(filePath, fileName, extra = {}) {
    try {
      const fileHash = this.generateFileHash(filePath);
      if (!fileHash) return;

      const stats = fs.statSync(filePath);
      const record = {
        fileName: fileName,
        filePath: filePath,
        fileHash: fileHash,
        fileSize: stats.size,
        fileModified: stats.mtime.toISOString(),
        processedAt: new Date().toISOString(),
        processingStartedAt: new Date().toISOString(),
        videoOutput: null,
        status: 'processing',
        stage: 'queued',
        stageAt: new Date().toISOString(),
        ...(extra && typeof extra === 'object' ? extra : {})
      };

      if (!record.retries) {
        record.retries = 0;
      }

      this.processedFiles.set(fileHash, record);
      await this.saveProcessedFiles();
    } catch (error) {
      console.error(`❌ Failed to mark file as processing: ${fileName}`, error);
    }
  }

  async setProcessingStage(filePath, _fileName, stage, extra = {}) {
    try {
      const fileHash = this.generateFileHash(filePath);
      if (!fileHash) return;

      const existing = this.processedFiles.get(fileHash) || {
        fileName: _fileName,
        filePath,
        fileHash,
        status: 'processing'
      };

      existing.stage = stage;
      existing.stageAt = new Date().toISOString();
      if (extra && typeof extra === 'object') {
        for (const [k, v] of Object.entries(extra)) existing[k] = v;
      }
      if (!existing.retries) {
        existing.retries = 0;
      }
      // Keep existing processedAt/file size if present
      this.processedFiles.set(fileHash, existing);
      await this.saveProcessedFiles();
    } catch (error) {
      console.error(`❌ Failed to set processing stage:`, error);
    }
  }

  isFileCurrentlyProcessing(filePath, _fileName, timeoutMs = 10 * 60 * 1000) {
    const record = this.getRecordForFile(filePath, _fileName);
    if (!record) return false;
    if (record.status !== 'processing') return false;
    if (!record.stageAt) return true;

    const stageDate = new Date(record.stageAt);
    if (Number.isNaN(stageDate.getTime())) return true;

    if (Date.now() - stageDate.getTime() > timeoutMs) {
      return false;
    }

    return true;
  }

  getRecordForFile(filePath, _fileName) {
    const fileHash = this.generateFileHash(filePath);
    if (fileHash && this.processedFiles.has(fileHash)) {
      return this.processedFiles.get(fileHash);
    }

    for (const [, record] of this.processedFiles.entries()) {
      if (record.filePath === filePath && record.fileName === _fileName) {
        return record;
      }
    }
    return null;
  }

  getProcessedFiles() {
    return Array.from(this.processedFiles.values());
  }

  getProcessedCount() {
    return this.processedFiles.size;
  }

  async cleanupOldEntries(daysOld = 30) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      let removedCount = 0;

      for (const [hash, record] of this.processedFiles.entries()) {
        const processedDate = new Date(record.processedAt);
        if (processedDate < cutoffDate) {
          this.processedFiles.delete(hash);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        await this.saveProcessedFiles();
        console.log(`🧹 Cleaned up ${removedCount} old processed file entries`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup old entries:', error);
    }
  }

  async resetAllProcessedFiles() {
    try {
      console.log(`🔄 Resetting all processed files (${this.processedFiles.size} files)`);

      this.processedFiles.clear();

      // Delete the tracking file
      if (fs.existsSync(this.trackingFile)) {
        fs.unlinkSync(this.trackingFile);
        console.log(`🗑️  Deleted tracking file: ${this.trackingFile}`);
      }

      console.log('✅ All processed files reset - input folder will be treated as new');
      return true;
    } catch (error) {
      console.error('❌ Failed to reset processed files:', error);
      throw error;
    }
  }

  async unmarkFile(filePath, fileName) {
    try {
      // Try by content hash first
      const fileHash = this.generateFileHash(filePath);
      let removed = false;
      if (fileHash && this.processedFiles.has(fileHash)) {
        this.processedFiles.delete(fileHash);
        removed = true;
      }

      if (!removed) {
        // Fallback: scan map for matching path/name
        for (const [hash, record] of this.processedFiles.entries()) {
          if (record.fileName === fileName && record.filePath === filePath) {
            this.processedFiles.delete(hash);
            removed = true;
            break;
          }
        }
      }

      if (removed) {
        await this.saveProcessedFiles();
      }

      return removed;
    } catch (error) {
      console.error(`❌ Failed to unmark file ${fileName}:`, error);
      return false;
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      totalProcessed: this.processedFiles.size,
      trackingFile: this.trackingFile,
      trackingFileExists: fs.existsSync(this.trackingFile)
    };
  }

  async requeueStaleProcessing(maxAgeMs = 10 * 60 * 1000) {
    const now = Date.now();
    let changed = 0;
    for (const [hash, record] of this.processedFiles.entries()) {
      if (record.status === 'processing') {
        const stageAt = record.stageAt ? new Date(record.stageAt).getTime() : 0;
        if (!stageAt || now - stageAt > maxAgeMs) {
          record.status = 'pending';
          record.stage = 'queued';
          record.stageAt = new Date().toISOString();
          record.processingStartedAt = new Date().toISOString();
          record.retries = (record.retries || 0) + 1;
          delete record.runId;
          this.processedFiles.set(hash, record);
          changed += 1;
        }
      }
    }

    if (changed > 0) {
      await this.saveProcessedFiles();
      console.log(`🔁 Re-queued ${changed} stale processing file(s)`);
    }

    return changed;
  }

  async requeueFile(filePath, fileName) {
    const fileHash = this.generateFileHash(filePath);
    let record = null;
    if (fileHash && this.processedFiles.has(fileHash)) {
      record = this.processedFiles.get(fileHash);
    } else {
      record = this.getRecordForFile(filePath, fileName);
    }

    if (!record) {
      return false;
    }

    record.status = 'pending';
    record.stage = 'queued';
    record.stageAt = new Date().toISOString();
    record.processingStartedAt = new Date().toISOString();
    record.retries = (record.retries || 0) + 1;
    delete record.runId;

    const hashKey = fileHash || this.generateFileHash(filePath);
    if (hashKey) {
      this.processedFiles.set(hashKey, record);
    }

    await this.saveProcessedFiles();
    return true;
  }
}
