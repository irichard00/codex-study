import { v4 as uuidv4 } from 'uuid';
import type {
  Agent,
  Task,
  TaskStatus,
  Message,
  AgentStatus
} from '../../../shared/types/index.js';
import { agentService } from './AgentService.js';
import { conversationService } from './ConversationService.js';
import { taskService } from './TaskService.js';
import { fileService } from './FileService.js';

interface SubmissionContext {
  sessionId: string;
  agentId: string;
  conversationId: string;
  workspaceDir: string;
}

interface SubmissionResult {
  response: string;
  tasksExecuted: Task[];
  filesModified: string[];
}

/**
 * Manages the core submission processing loop
 * Equivalent to Rust's submission_loop but adapted for async web environment
 */
export class SubmissionLoop {
  private activeLoops: Map<string, boolean> = new Map();

  /**
   * Process a user submission through the complete loop
   * This is the core logic that mirrors Rust's submission_loop()
   */
  async processSubmission(
    context: SubmissionContext,
    userInput: string,
    onStatusUpdate?: (status: AgentStatus) => void
  ): Promise<SubmissionResult> {
    const { sessionId, agentId, conversationId, workspaceDir } = context;

    // Prevent concurrent submissions for same agent
    if (this.activeLoops.get(agentId)) {
      throw new Error('Submission already in progress');
    }

    this.activeLoops.set(agentId, true);

    try {
      // 1. Update agent status to thinking (like Rust's state machine)
      await this.updateAgentStatus(agentId, 'thinking', onStatusUpdate);

      // 2. Add user message to conversation
      await conversationService.addMessage(conversationId, {
        role: 'user',
        content: userInput,
      });

      // 3. Parse and plan tasks (equivalent to Rust's parse_command)
      const tasks = await this.planTasks(userInput, context);

      // 4. Execute tasks if any (like Rust's execute_tool_calls)
      const executedTasks: Task[] = [];
      const filesModified: string[] = [];

      if (tasks.length > 0) {
        await this.updateAgentStatus(agentId, 'executing', onStatusUpdate);

        for (const task of tasks) {
          try {
            const result = await this.executeTask(task, context);
            executedTasks.push(result);

            // Track file modifications
            if (task.type === 'file_write' && result.status === 'completed') {
              filesModified.push(result.output?.path);
            }
          } catch (error) {
            console.error(`Task ${task.id} failed:`, error);
            task.status = 'failed';
            task.error = error instanceof Error ? error.message : 'Unknown error';
          }
        }
      }

      // 5. Generate response (like Rust's generate_response)
      await this.updateAgentStatus(agentId, 'thinking', onStatusUpdate);
      const response = await this.generateResponse(
        userInput,
        executedTasks,
        filesModified
      );

      // 6. Add assistant response to conversation
      await conversationService.addMessage(conversationId, {
        role: 'assistant',
        content: response,
        metadata: {
          tasksExecuted: executedTasks.length,
          filesModified: filesModified.length,
        },
      });

      // 7. Update agent status back to idle
      await this.updateAgentStatus(agentId, 'idle', onStatusUpdate);

      return {
        response,
        tasksExecuted,
        filesModified,
      };

    } finally {
      // Always cleanup the active loop flag
      this.activeLoops.delete(agentId);
    }
  }

  /**
   * Plan tasks based on user input (like Rust's command parsing)
   */
  private async planTasks(
    userInput: string,
    context: SubmissionContext
  ): Promise<Task[]> {
    const tasks: Task[] = [];

    // Parse for file operations
    if (userInput.includes('create file') || userInput.includes('write file')) {
      const fileMatch = userInput.match(/file[s]?\s+([^\s]+)/);
      if (fileMatch) {
        tasks.push({
          id: uuidv4(),
          agentId: context.agentId,
          type: 'file_write',
          status: 'pending',
          input: {
            path: fileMatch[1],
            content: 'New file content',
          },
          startedAt: new Date(),
          metadata: {},
        });
      }
    }

    // Parse for file search
    if (userInput.includes('search') || userInput.includes('find')) {
      const searchMatch = userInput.match(/(?:search|find)\s+(.+)/);
      if (searchMatch) {
        tasks.push({
          id: uuidv4(),
          agentId: context.agentId,
          type: 'file_search',
          status: 'pending',
          input: {
            query: searchMatch[1],
          },
          startedAt: new Date(),
          metadata: {},
        });
      }
    }

    // Parse for code generation
    if (userInput.includes('generate') || userInput.includes('create') && userInput.includes('code')) {
      tasks.push({
        id: uuidv4(),
        agentId: context.agentId,
        type: 'code_generation',
        status: 'pending',
        input: {
          prompt: userInput,
        },
        startedAt: new Date(),
        metadata: {},
      });
    }

    // Parse for command execution
    if (userInput.startsWith('run ') || userInput.startsWith('execute ')) {
      const commandMatch = userInput.match(/(?:run|execute)\s+(.+)/);
      if (commandMatch) {
        tasks.push({
          id: uuidv4(),
          agentId: context.agentId,
          type: 'execute_command',
          status: 'pending',
          input: {
            command: commandMatch[1],
          },
          startedAt: new Date(),
          metadata: {},
        });
      }
    }

    return tasks;
  }

  /**
   * Execute a single task (like Rust's tool execution)
   */
  private async executeTask(
    task: Task,
    context: SubmissionContext
  ): Promise<Task> {
    task.status = 'running';

    try {
      switch (task.type) {
        case 'file_write':
          const writeResult = await fileService.writeFile(
            context.workspaceDir,
            task.input.path,
            task.input.content
          );
          task.output = { path: task.input.path, operation: writeResult };
          break;

        case 'file_search':
          const searchResults = await fileService.searchFiles(
            context.workspaceDir,
            task.input.query,
            true
          );
          task.output = { results: searchResults };
          break;

        case 'file_read':
          const content = await fileService.readFile(
            context.workspaceDir,
            task.input.path
          );
          task.output = { content };
          break;

        case 'code_generation':
          // Placeholder for code generation
          task.output = {
            code: `// Generated code for: ${task.input.prompt}\nfunction example() {\n  console.log("Generated");\n}`,
          };
          break;

        case 'execute_command':
          // Placeholder for command execution (would need sandboxing)
          task.output = {
            stdout: `Executed: ${task.input.command}`,
            stderr: '',
            exitCode: 0,
          };
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      task.status = 'completed';
      task.completedAt = new Date();
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Task execution failed';
      task.completedAt = new Date();
    }

    return task;
  }

  /**
   * Generate AI response based on execution results
   */
  private async generateResponse(
    userInput: string,
    tasksExecuted: Task[],
    filesModified: string[]
  ): Promise<string> {
    // This would integrate with actual AI model
    // For now, generate a summary response

    let response = `I've processed your request: "${userInput}"\n\n`;

    if (tasksExecuted.length > 0) {
      response += `Executed ${tasksExecuted.length} task(s):\n`;
      for (const task of tasksExecuted) {
        response += `- ${task.type}: ${task.status}\n`;
        if (task.error) {
          response += `  Error: ${task.error}\n`;
        }
      }
      response += '\n';
    }

    if (filesModified.length > 0) {
      response += `Modified files:\n`;
      for (const file of filesModified) {
        response += `- ${file}\n`;
      }
    }

    if (tasksExecuted.length === 0) {
      response += `I'm ready to help. You can ask me to:\n`;
      response += `- Search for files\n`;
      response += `- Read or write files\n`;
      response += `- Generate code\n`;
      response += `- Execute commands\n`;
    }

    return response;
  }

  /**
   * Update agent status with callback
   */
  private async updateAgentStatus(
    agentId: string,
    status: AgentStatus,
    callback?: (status: AgentStatus) => void
  ): Promise<void> {
    await agentService.updateAgentStatus(agentId, status);
    if (callback) {
      callback(status);
    }
  }

  /**
   * Check if a submission is currently being processed
   */
  isProcessing(agentId: string): boolean {
    return this.activeLoops.get(agentId) || false;
  }

  /**
   * Cancel an active submission (if supported)
   */
  async cancelSubmission(agentId: string): Promise<void> {
    if (this.activeLoops.get(agentId)) {
      // In a real implementation, this would set a cancellation flag
      // that the loop checks periodically
      this.activeLoops.delete(agentId);
      await agentService.updateAgentStatus(agentId, 'idle');
    }
  }
}

export const submissionLoop = new SubmissionLoop();