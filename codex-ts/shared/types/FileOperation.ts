import { z } from 'zod';

export const FileOperationTypeSchema = z.enum(['read', 'write', 'delete', 'rename']);
export type FileOperationType = z.infer<typeof FileOperationTypeSchema>;

export const FileOperationStatusSchema = z.enum(['success', 'failed']);
export type FileOperationStatus = z.infer<typeof FileOperationStatusSchema>;

export const FileOperationSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  type: FileOperationTypeSchema,
  path: z.string(),
  previousContent: z.string().optional(),
  newContent: z.string().optional(),
  timestamp: z.date(),
  taskId: z.string().uuid().optional(),
  status: FileOperationStatusSchema,
  error: z.string().optional(),
});
export type FileOperation = z.infer<typeof FileOperationSchema>;

export const FileInfoSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number(),
  modifiedAt: z.date(),
});
export type FileInfo = z.infer<typeof FileInfoSchema>;

export const SearchResultSchema = z.object({
  path: z.string(),
  line: z.number(),
  content: z.string(),
  score: z.number(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const FileSearchSchema = z.object({
  query: z.string(),
  fuzzy: z.boolean().default(true),
});
export type FileSearch = z.infer<typeof FileSearchSchema>;