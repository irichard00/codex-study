# Enhanced Browser Tools API Contracts

## Overview
Advanced browser automation tools that extend the existing basic tools with pattern-based extraction, form automation, and network interception capabilities. The related code dir is `codex-chrome/src/tools`

## WebScrapingTool

### Interface
```typescript
class WebScrapingTool extends BaseTool {
  constructor(patternLibrary?: PatternLibrary);

  // Core methods
  async scrape(config: ScrapingConfig): Promise<ScrapingResult>;
  async extract(url: string, pattern: string): Promise<any>;
  async scrapeTable(selector: string, tabId?: number): Promise<TableData>;
  async scrapePaginated(config: PaginationConfig): Promise<any[]>;

  // Pattern management
  addPattern(pattern: ScrapingPattern): void;
  getPattern(name: string): ScrapingPattern | undefined;
  listPatterns(): string[];

  // Validation
  validateSelector(selector: string): boolean;
  testPattern(pattern: ScrapingPattern, html: string): any;
}
```

### Core Methods

#### `scrape(config: ScrapingConfig): Promise<ScrapingResult>`
Executes comprehensive web scraping with patterns.

```typescript
interface ScrapingConfig {
  url?: string;
  tabId?: number;
  patterns: ScrapingPattern[];
  waitFor?: WaitCondition;
  timeout?: number;
  screenshot?: boolean;
}

interface ScrapingResult {
  data: Record<string, any>;
  metadata: {
    url: string;
    timestamp: number;
    duration: number;
    errors: string[];
  };
  screenshot?: string;
}
```

**Implementation:**
```typescript
async scrape(config: ScrapingConfig) {
  const tab = await this.getTab(config.tabId);

  if (config.waitFor) {
    await this.waitForCondition(tab.id, config.waitFor);
  }

  const results = {};
  for (const pattern of config.patterns) {
    try {
      results[pattern.name] = await this.executePattern(tab.id, pattern);
    } catch (error) {
      results[pattern.name] = { error: error.message };
    }
  }

  return { data: results, metadata: {...} };
}
```

#### `scrapeTable(selector: string, tabId?: number): Promise<TableData>`
Extracts structured data from HTML tables.

```typescript
interface TableData {
  headers: string[];
  rows: string[][];
  metadata: {
    rowCount: number;
    columnCount: number;
    hasHeaders: boolean;
  };
}
```

#### `scrapePaginated(config: PaginationConfig): Promise<any[]>`
Handles multi-page scraping automatically.

```typescript
interface PaginationConfig {
  startUrl: string;
  pattern: ScrapingPattern;
  pagination: {
    type: 'click' | 'scroll' | 'url-pattern';
    nextSelector?: string;
    urlPattern?: string;
    maxPages: number;
    delay: number;
  };
}
```

### Pattern System

```typescript
interface ScrapingPattern {
  name: string;
  description: string;
  selectors: SelectorConfig[];
  extraction: ExtractionRule[];
  transform?: TransformPipeline;
  validation?: ValidationRule[];
}

interface SelectorConfig {
  type: 'css' | 'xpath' | 'text' | 'regex';
  selector: string;
  multiple: boolean;
  required: boolean;
  fallback?: string;
}

interface ExtractionRule {
  field: string;
  source: 'text' | 'attribute' | 'html' | 'computed';
  attribute?: string;
  format?: 'string' | 'number' | 'date' | 'json';
  default?: any;
}
```

### Common Patterns Library

```typescript
const CommonPatterns = {
  ARTICLE: {
    name: 'article',
    selectors: [
      { type: 'css', selector: 'article, main, [role="main"]', multiple: false }
    ],
    extraction: [
      { field: 'title', source: 'text', selector: 'h1' },
      { field: 'content', source: 'text', selector: 'p' },
      { field: 'author', source: 'text', selector: '[rel="author"]' },
      { field: 'date', source: 'attribute', attribute: 'datetime' }
    ]
  },

  PRODUCT: {
    name: 'product',
    selectors: [
      { type: 'css', selector: '[itemtype*="Product"]', multiple: true }
    ],
    extraction: [
      { field: 'name', source: 'text', selector: '[itemprop="name"]' },
      { field: 'price', source: 'text', selector: '[itemprop="price"]' },
      { field: 'description', source: 'text', selector: '[itemprop="description"]' },
      { field: 'image', source: 'attribute', selector: 'img', attribute: 'src' }
    ]
  }
};
```

## FormAutomationTool

### Interface
```typescript
class FormAutomationTool extends BaseTool {
  // Core methods
  async fillForm(task: FormAutomationTask): Promise<FormResult>;
  async detectFields(tabId: number): Promise<FormField[]>;
  async submitForm(tabId: number, selector?: string): Promise<void>;

  // Multi-step forms
  async executeSteps(steps: FormStep[]): Promise<StepResult[]>;
  async waitForNextStep(condition: WaitCondition): Promise<void>;

  // Validation
  async validateForm(tabId: number): Promise<ValidationResult>;
  getFieldValue(tabId: number, selector: string): Promise<any>;
}
```

### Core Methods

#### `fillForm(task: FormAutomationTask): Promise<FormResult>`
Automates form filling with smart field detection.

```typescript
interface FormAutomationTask {
  url?: string;
  tabId?: number;
  formSelector?: string;
  fields: FormFieldMapping[];
  submitButton?: string;
  validateBeforeSubmit?: boolean;
  waitAfterSubmit?: number;
}

interface FormResult {
  success: boolean;
  filledFields: string[];
  errors: FieldError[];
  submitted: boolean;
  responseUrl?: string;
}
```

#### `detectFields(tabId: number): Promise<FormField[]>`
Automatically detects form fields and their types.

```typescript
interface FormField {
  name: string;
  id?: string;
  type: 'text' | 'email' | 'password' | 'select' | 'checkbox' | 'radio' | 'file';
  label?: string;
  required: boolean;
  value?: any;
  options?: string[]; // for select/radio
  validation?: string; // regex pattern
}
```

#### `executeSteps(steps: FormStep[]): Promise<StepResult[]>`
Handles multi-step form workflows.

```typescript
interface FormStep {
  name: string;
  trigger: 'auto' | 'click' | 'wait';
  selector?: string;
  delay?: number;
  fields: FormFieldMapping[];
  validation?: (result: any) => boolean;
}
```

### Smart Field Detection

```typescript
class FormAutomationTool {
  private async detectFieldType(element: Element): Promise<string> {
    // Check input type attribute
    const type = element.getAttribute('type');
    if (type) return type;

    // Infer from attributes and labels
    const name = element.getAttribute('name')?.toLowerCase() || '';
    const label = await this.getFieldLabel(element);

    if (name.includes('email') || label?.includes('email')) return 'email';
    if (name.includes('password') || label?.includes('password')) return 'password';
    if (name.includes('phone') || label?.includes('phone')) return 'tel';

    return 'text';
  }

  private async getFieldLabel(element: Element): Promise<string | null> {
    // Try explicit label
    const id = element.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent;
    }

    // Try parent label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent;

    // Try previous sibling
    const prev = element.previousElementSibling;
    if (prev?.tagName === 'LABEL') return prev.textContent;

    return null;
  }
}
```

## NetworkInterceptTool

### Interface
```typescript
class NetworkInterceptTool extends BaseTool {
  // Interception control
  async startInterception(config: NetworkInterceptConfig): Promise<void>;
  async stopInterception(): void;

  // Request/Response modification
  async modifyRequest(pattern: string, modification: RequestModification): Promise<void>;
  async modifyResponse(pattern: string, modification: ResponseModification): Promise<void>;

  // Monitoring
  async getRequests(filter?: NetworkFilter): Promise<NetworkRequest[]>;
  async getMetrics(): Promise<NetworkMetrics>;

  // Caching
  async cacheResponse(pattern: string, ttl?: number): Promise<void>;
  async clearCache(pattern?: string): Promise<void>;
}
```

### Core Methods

#### `startInterception(config: NetworkInterceptConfig): Promise<void>`
Begins network interception with patterns.

```typescript
interface NetworkInterceptConfig {
  patterns: NetworkPattern[];
  requestModifications?: RequestModification[];
  responseModifications?: ResponseModification[];
  monitoring: MonitoringConfig;
  caching?: CachingConfig;
}
```

#### `modifyRequest(pattern: string, modification: RequestModification)`
Modifies outgoing requests matching pattern.

```typescript
interface RequestModification {
  type: 'header' | 'body' | 'url' | 'method';
  action: 'add' | 'modify' | 'remove';
  key?: string;
  value?: any;
}

// Example: Add authentication header
await tool.modifyRequest('api.example.com/*', {
  type: 'header',
  action: 'add',
  key: 'Authorization',
  value: 'Bearer token123'
});
```

### Chrome WebRequest Integration

```typescript
class NetworkInterceptTool {
  private setupWebRequestListeners(): void {
    // Before request - modify headers
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => this.handleBeforeSendHeaders(details),
      { urls: this.patterns },
      ['blocking', 'requestHeaders']
    );

    // Before response - cache or modify
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => this.handleHeadersReceived(details),
      { urls: this.patterns },
      ['blocking', 'responseHeaders']
    );

    // Complete - log metrics
    chrome.webRequest.onCompleted.addListener(
      (details) => this.handleCompleted(details),
      { urls: this.patterns }
    );
  }
}
```

## DataExtractionTool

### Interface
```typescript
class DataExtractionTool extends BaseTool {
  // Extraction methods
  async extractStructuredData(config: ExtractionConfig): Promise<StructuredData>;
  async extractFromJSON(tabId: number): Promise<any>;
  async extractFromCSV(content: string): Promise<any[]>;

  // Export methods
  async exportToFormat(data: any, format: ExportFormat): Promise<Blob>;
  async saveToStorage(data: any, key: string): Promise<void>;

  // Pattern recognition
  async detectDataPattern(tabId: number): Promise<DataPattern>;
  async applyPattern(pattern: DataPattern, tabId: number): Promise<any>;
}
```

### Structured Data Extraction

```typescript
interface ExtractionConfig {
  tabId?: number;
  url?: string;
  schema: DataSchema;
  formats?: string[];
  validation?: boolean;
}

interface DataSchema {
  type: 'object' | 'array';
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  required?: string[];
}

interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  selector?: string;
  transform?: (value: any) => any;
  default?: any;
}
```

### Export Formats

```typescript
enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  EXCEL = 'xlsx',
  XML = 'xml',
  MARKDOWN = 'md'
}

class DataExtractionTool {
  async exportToFormat(data: any, format: ExportFormat): Promise<Blob> {
    switch (format) {
      case ExportFormat.JSON:
        return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

      case ExportFormat.CSV:
        const csv = this.convertToCSV(data);
        return new Blob([csv], { type: 'text/csv' });

      case ExportFormat.MARKDOWN:
        const md = this.convertToMarkdown(data);
        return new Blob([md], { type: 'text/markdown' });

      // ... other formats
    }
  }
}
```

## Testing Requirements

### WebScrapingTool Tests
```typescript
describe('WebScrapingTool', () => {
  it('should extract data using patterns', async () => {
    const tool = new WebScrapingTool();
    const result = await tool.scrape({
      url: 'https://example.com',
      patterns: [CommonPatterns.ARTICLE]
    });

    expect(result.data.article).toBeDefined();
    expect(result.data.article.title).toBeTypeOf('string');
  });

  it('should handle pagination', async () => {
    const tool = new WebScrapingTool();
    const results = await tool.scrapePaginated({
      startUrl: 'https://example.com/page/1',
      pattern: CommonPatterns.PRODUCT,
      pagination: {
        type: 'url-pattern',
        urlPattern: 'page/{n}',
        maxPages: 3,
        delay: 1000
      }
    });

    expect(results.length).toBe(3);
  });
});
```

### FormAutomationTool Tests
```typescript
describe('FormAutomationTool', () => {
  it('should detect and fill form fields', async () => {
    const tool = new FormAutomationTool();
    const fields = await tool.detectFields(tabId);

    expect(fields.length).toBeGreaterThan(0);
    expect(fields[0]).toHaveProperty('type');

    const result = await tool.fillForm({
      tabId,
      fields: [
        { name: 'email', value: 'test@example.com' },
        { name: 'password', value: 'secure123' }
      ]
    });

    expect(result.success).toBe(true);
    expect(result.filledFields).toContain('email');
  });
});
```

## Performance Requirements

- Pattern execution: < 100ms per pattern
- Form field detection: < 200ms per form
- Network interception overhead: < 10ms per request
- Data extraction: < 500ms for typical page
- Export generation: < 1s for 10MB data

## Security Considerations

### Input Validation
- Sanitize selectors to prevent injection
- Validate URLs before navigation
- Limit pattern complexity

### Data Protection
- Don't store sensitive form data
- Sanitize extracted content
- Respect CORS policies

### Rate Limiting
- Limit concurrent extractions
- Add delays between pagination
- Respect robots.txt