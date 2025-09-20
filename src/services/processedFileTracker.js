import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class ProcessedFileTracker {
  constructor() {
    this.trackingFile = './processed-files.json';
    this.processedFiles = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      await this.loadProcessedFiles();
      this.isInitialized = true;
      console.log(`✅ Processed file tracker initialized - ${this.processedFiles.size} files tracked`);
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
        console.log(`📋 Loaded ${this.processedFiles.size} processed files from tracking file`);
      } else {
        console.log('📋 No existing tracking file found - starting fresh');
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
        console.log(`🔄 File already processed: ${fileName} (processed: ${record.processedAt})`);
        return true;
      }
    }

    // Check by filename (backup method)
    for (const [hash, record] of this.processedFiles.entries()) {
      if (record.fileName === fileName && record.filePath === filePath && record.status === 'completed') {
        console.log(`🔄 File already processed (by name): ${fileName} (processed: ${record.processedAt})`);
        return true;
      }
    }

    return false;
  }

  async markFileAsProcessed(filePath, fileName, videoOutputPath = null) {
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
        status: 'completed'
      };

      this.processedFiles.set(fileHash, record);
      await this.saveProcessedFiles();

      console.log(`✅ Marked as processed: ${fileName} (hash: ${fileHash.substring(0, 8)}...)`);
    } catch (error) {
      console.error(`❌ Failed to mark file as processed: ${fileName}`, error);
    }
  }

  async markFileAsProcessing(filePath, fileName) {
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
        videoOutput: null,
        status: 'processing'
      };

      this.processedFiles.set(fileHash, record);
      await this.saveProcessedFiles();

      console.log(`🔄 Marked as processing: ${fileName} (hash: ${fileHash.substring(0, 8)}...)`);
    } catch (error) {
      console.error(`❌ Failed to mark file as processing: ${fileName}`, error);
    }
  }

  isFileCurrentlyProcessing(filePath, fileName) {
    const fileHash = this.generateFileHash(filePath);
    if (!fileHash) return false;

    if (this.processedFiles.has(fileHash)) {
      const record = this.processedFiles.get(fileHash);
      if (record.status === 'processing') {
        // Check if processing started more than 10 minutes ago (assume failed)
        const processingStarted = new Date(record.processedAt);
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        if (processingStarted < tenMinutesAgo) {
          console.log(`⚠️  Processing timeout detected for ${fileName} - will retry`);
          return false;
        }

        console.log(`🔄 File currently being processed: ${fileName}`);
        return true;
      }
    }

    return false;
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

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      totalProcessed: this.processedFiles.size,
      trackingFile: this.trackingFile,
      trackingFileExists: fs.existsSync(this.trackingFile)
    };
  }
}