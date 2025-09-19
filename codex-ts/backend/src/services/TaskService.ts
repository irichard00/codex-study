import { v4 as uuidv4 } from 'uuid';
import type { Task, CreateTask, TaskStatus } from '../../../shared/types/index.js';

export class TaskService {
  private tasks: Map<string, Task> = new Map();

  async createTask(agentId: string, data: CreateTask): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      agentId,
      type: data.type,
      status: 'pending',
      input: data.input,
      startedAt: new Date(),
      metadata: {},
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async getTask(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async listTasksByAgent(agentId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(
      (task) => task.agentId === agentId
    );
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.status = status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        task.completedAt = new Date();
      }
      this.tasks.set(id, task);
    }
  }

  async updateTaskOutput(id: string, output: any): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.output = output;
      this.tasks.set(id, task);
    }
  }

  async cancelTask(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (task && task.status === 'running') {
      task.status = 'cancelled';
      task.completedAt = new Date();
      this.tasks.set(id, task);
      return true;
    }
    return false;
  }

  // State machine validation
  isValidStatusTransition(from: TaskStatus, to: TaskStatus): boolean {
    const transitions: Record<TaskStatus, TaskStatus[]> = {
      pending: ['running', 'cancelled'],
      running: ['completed', 'failed', 'cancelled'],
      completed: [],
      failed: [],
      cancelled: [],
    };

    return transitions[from]?.includes(to) || false;
  }
}

export const taskService = new TaskService();