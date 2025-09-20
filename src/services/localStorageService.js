import fs from 'fs';
import path from 'path';

export class LocalStorageService {
  constructor() {
    this.isInitialized = false;
    this.folders = {
      input: './input',
      output: './output',
      screensaver: './screensaver'
    };
  }

  async initialize() {
    try {
      console.log('📁 Initializing local storage service...');

      // Create all required directories if they don't exist
      for (const [folderType, folderPath] of Object.entries(this.folders)) {
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
          console.log(`✅ Created ${folderType} folder: ${folderPath}`);
        } else {
          console.log(`📁 ${folderType} folder exists: ${folderPath}`);
        }
      }

      // Ensure temp directory exists
      if (!fs.existsSync('./temp')) {
        fs.mkdirSync('./temp', { recursive: true });
        console.log('✅ Created temp folder: ./temp');
      }

      this.isInitialized = true;
      console.log('✅ Local storage service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize local storage service:', error);
      return false;
    }
  }

  async getNewInputFiles() {
    try {
      const inputPath = this.folders.input;
      if (!fs.existsSync(inputPath)) {
        return [];
      }

      const files = fs.readdirSync(inputPath);
      const imageFiles = files
        .filter(file => this.isImageFile(file))
        .map(file => {
          const filePath = path.join(inputPath, file);
          const stats = fs.statSync(filePath);
          return {
            id: file,
            name: file,
            path: filePath,
            createdTime: stats.birthtime.toISOString(),
            mimeType: this.getMimeType(file),
            size: stats.size
          };
        })
        .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

      return imageFiles;
    } catch (error) {
      console.error('Error getting input files:', error);
      return [];
    }
  }

  async getOutputVideos() {
    try {
      const outputPath = this.folders.output;
      if (!fs.existsSync(outputPath)) {
        return [];
      }

      const files = fs.readdirSync(outputPath);
      const videoFiles = files
        .filter(file => this.isVideoFile(file))
        .map(file => {
          const filePath = path.join(outputPath, file);
          const stats = fs.statSync(filePath);
          return {
            id: file,
            name: file,
            path: filePath,
            createdTime: stats.birthtime.toISOString(),
            mimeType: this.getMimeType(file),
            size: stats.size
          };
        })
        .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

      return videoFiles;
    } catch (error) {
      console.error('Error getting output videos:', error);
      return [];
    }
  }

  async getScreensaverVideos() {
    try {
      const screensaverPath = this.folders.screensaver;
      if (!fs.existsSync(screensaverPath)) {
        return [];
      }

      const files = fs.readdirSync(screensaverPath);
      const videoFiles = files
        .filter(file => this.isVideoFile(file))
        .map(file => {
          const filePath = path.join(screensaverPath, file);
          const stats = fs.statSync(filePath);
          return {
            id: file,
            name: file,
            path: filePath,
            createdTime: stats.birthtime.toISOString(),
            mimeType: this.getMimeType(file),
            size: stats.size
          };
        });

      return videoFiles;
    } catch (error) {
      console.error('Error getting screensaver videos:', error);
      return [];
    }
  }

  async copyFile(sourcePath, fileName, targetFolder) {
    try {
      const targetPath = path.join(this.folders[targetFolder], fileName);
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`✅ File copied to ${targetFolder}: ${fileName}`);
      return {
        id: fileName,
        name: fileName,
        path: targetPath
      };
    } catch (error) {
      console.error(`❌ Failed to copy file to ${targetFolder}:`, error.message);
      throw error;
    }
  }


  async deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Deleted file: ${path.basename(filePath)}`);
      }
    } catch (error) {
      console.error(`❌ Failed to delete file ${filePath}:`, error.message);
      throw error;
    }
  }

  getVideoStream(fileName) {
    const filePath = path.join(this.folders.output, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Video file not found: ${fileName}`);
    }
    return fs.createReadStream(filePath);
  }

  getScreensaverVideoStream(fileName) {
    const filePath = path.join(this.folders.screensaver, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Screensaver video file not found: ${fileName}`);
    }
    return fs.createReadStream(filePath);
  }

  async getThumbnail(videoId) {
    try {
      // For now, return null since we don't have thumbnail generation
      // In a real implementation, you would generate thumbnails from video files
      return null;
    } catch (error) {
      console.error(`Error getting thumbnail for ${videoId}:`, error);
      return null;
    }
  }

  async deleteVideo(videoId) {
    try {
      // Check output folder first
      let filePath = path.join(this.folders.output, videoId);
      if (fs.existsSync(filePath)) {
        await this.deleteFile(filePath);
        return true;
      }

      // Check screensaver folder
      filePath = path.join(this.folders.screensaver, videoId);
      if (fs.existsSync(filePath)) {
        await this.deleteFile(filePath);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error deleting video ${videoId}:`, error);
      throw error;
    }
  }

  isImageFile(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.raw', '.cr2', '.nef'].includes(ext);
  }

  isVideoFile(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
  }

  getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  getFolderPaths() {
    return { ...this.folders };
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      folders: this.folders,
      folderExists: Object.fromEntries(
        Object.entries(this.folders).map(([key, path]) => [key, fs.existsSync(path)])
      )
    };
  }
}