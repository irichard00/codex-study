/**
 * T021: Type transformation functions
 */

export const transformers = {
  string: (value: string): string => {
    return value.trim();
  },

  number: (value: string): number => {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${value}`);
    }
    return num;
  },

  boolean: (value: string): boolean => {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
    throw new Error(`Invalid boolean: ${value}. Expected true/false, yes/no, or 1/0`);
  },

  array: (value: string, delimiter = ','): string[] => {
    if (!value) return [];
    return value.split(delimiter)
      .map(s => s.trim())
      .filter(Boolean);
  },

  enum: <T extends string>(value: string, options: readonly T[]): T => {
    if (!options.includes(value as T)) {
      throw new Error(`Invalid enum value: ${value}. Must be one of: ${options.join(', ')}`);
    }
    return value as T;
  },

  url: (value: string): string => {
    try {
      const url = new URL(value);
      if (!url.protocol.startsWith('http')) {
        throw new Error('Only HTTP(S) URLs are supported');
      }
      return value;
    } catch {
      throw new Error(`Invalid URL: ${value}`);
    }
  },
};

// Export individual functions for convenience
export const transformString = transformers.string;
export const transformNumber = transformers.number;
export const transformBoolean = transformers.boolean;
export const transformArray = transformers.array;
export const transformEnum = transformers.enum;
export const transformUrl = transformers.url;