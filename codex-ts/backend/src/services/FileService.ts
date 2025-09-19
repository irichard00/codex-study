import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  FileInfo,
  FileOperation,
  FileOperationType,
  SearchResult,
} from '../../../shared/types/index.js';

export class FileService {
  private fileOperations: Map<string, FileOperation> = new Map();

  async validatePath(workspaceDir: string, filePath: string): Promise<string> {
    const resolvedPath = path.resolve(workspaceDir, filePath);
    const resolvedWorkspace = path.resolve(workspaceDir);

    // Ensure the path is within the workspace
    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      throw new Error('Access denied: Path outside workspace');
    }

    return resolvedPath;
  }

  async listFiles(workspaceDir: string, dirPath: string): Promise<FileInfo[]> {
    const fullPath = await this.validatePath(workspaceDir, dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const fileInfos: FileInfo[] = [];

    for (const entry of entries) {
      const entryPath = path.join(fullPath, entry.name);
      const stats = await fs.stat(entryPath);

      fileInfos.push({
        name: entry.name,
        path: path.relative(workspaceDir, entryPath),
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modifiedAt: stats.mtime,
      });
    }

    return fileInfos.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  async readFile(workspaceDir: string, filePath: string): Promise<string> {
    const fullPath = await this.validatePath(workspaceDir, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    // Track operation
    await this.trackOperation('read', workspaceDir, filePath, undefined, content);

    return content;
  }

  async writeFile(workspaceDir: string, filePath: string, content: string): Promise<FileOperation> {
    const fullPath = await this.validatePath(workspaceDir, filePath);

    // Get previous content for undo capability
    let previousContent: string | undefined;
    try {
      previousContent = await fs.readFile(fullPath, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    // Create directory if it doesn't exist
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');

    // Track operation
    return await this.trackOperation('write', workspaceDir, filePath, previousContent, content);
  }

  async deleteFile(workspaceDir: string, filePath: string): Promise<FileOperation> {
    const fullPath = await this.validatePath(workspaceDir, filePath);

    // Get content for undo capability
    const previousContent = await fs.readFile(fullPath, 'utf-8');

    // Delete file
    await fs.unlink(fullPath);

    // Track operation
    return await this.trackOperation('delete', workspaceDir, filePath, previousContent);
  }

  async renameFile(
    workspaceDir: string,
    oldPath: string,
    newPath: string
  ): Promise<FileOperation> {
    const fullOldPath = await this.validatePath(workspaceDir, oldPath);
    const fullNewPath = await this.validatePath(workspaceDir, newPath);

    // Rename file
    await fs.rename(fullOldPath, fullNewPath);

    // Track operation
    return await this.trackOperation('rename', workspaceDir, oldPath, undefined, newPath);
  }

  async searchFiles(workspaceDir: string, query: string, fuzzy = true): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    async function searchDir(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await searchDir(fullPath);
        } else if (entry.isFile()) {
          const relativePath = path.relative(workspaceDir, fullPath);

          // Check filename match
          if (fuzzy ? entry.name.toLowerCase().includes(query.toLowerCase()) : entry.name === query) {
            results.push({
              path: relativePath,
              line: 0,
              content: entry.name,
              score: 1.0,
            });
          }

          // Search file content for text files
          if (entry.name.endsWith('.ts') || entry.name.endsWith('.js') ||
              entry.name.endsWith('.json') || entry.name.endsWith('.md')) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const lines = content.split('\n');

              lines.forEach((line, index) => {
                if (fuzzy ? line.toLowerCase().includes(query.toLowerCase()) : line.includes(query)) {
                  results.push({
                    path: relativePath,
                    line: index + 1,
                    content: line.trim(),
                    score: 0.8,
                  });
                }
              });
            } catch {
              // Ignore read errors
            }
          }
        }
      }
    }

    await searchDir(workspaceDir);

    // Sort by score and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);
  }

  private async trackOperation(
    type: FileOperationType,
    workspaceDir: string,
    filePath: string,
    previousContent?: string,
    newContent?: string
  ): Promise<FileOperation> {
    const operation: FileOperation = {
      id: uuidv4(),
      sessionId: '', // Will be filled by the calling service
      type,
      path: filePath,
      previousContent,
      newContent,
      timestamp: new Date(),
      status: 'success',
    };

    this.fileOperations.set(operation.id, operation);
    return operation;
  }

  async getFileOperations(sessionId: string): Promise<FileOperation[]> {
    return Array.from(this.fileOperations.values())
      .filter((op) => op.sessionId === sessionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async undoOperation(operationId: string, workspaceDir: string): Promise<void> {
    const operation = this.fileOperations.get(operationId);
    if (!operation) {
      throw new Error('Operation not found');
    }

    const fullPath = await this.validatePath(workspaceDir, operation.path);

    switch (operation.type) {
      case 'write':
      case 'delete':
        if (operation.previousContent) {
          await fs.writeFile(fullPath, operation.previousContent, 'utf-8');
        }
        break;
      case 'rename':
        if (operation.newContent) {
          const newFullPath = await this.validatePath(workspaceDir, operation.newContent);
          await fs.rename(newFullPath, fullPath);
        }
        break;
    }
  }
}

export const fileService = new FileService();