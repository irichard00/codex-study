<script lang="ts">
  import { onMount } from 'svelte';
  import { MessageRouter, MessageType } from '../core/MessageRouter';
  import type { Event } from '../protocol/types';
  import type { EventMsg } from '../protocol/events';
  import TerminalContainer from './components/TerminalContainer.svelte';
  import TerminalMessage from './components/TerminalMessage.svelte';
  import TerminalInput from './components/TerminalInput.svelte';
  import type { MessageType as TerminalMessageType } from '../types/terminal';

  let router: MessageRouter;
  let messages: Array<{ type: 'user' | 'agent'; content: string; timestamp: number }> = [];
  let inputText = '';
  let isConnected = false;
  let isProcessing = false;

  onMount(() => {
    // Initialize router
    router = new MessageRouter('sidepanel');

    // Setup event handlers
    router.on(MessageType.EVENT, (message) => {
      const event = message.payload as Event;
      handleEvent(event);
    });

    router.on(MessageType.STATE_UPDATE, (message) => {
      console.log('State update:', message.payload);
    });

    // Check connection
    checkConnection();

    // Periodic connection check
    const interval = setInterval(checkConnection, 5000);

    return () => {
      clearInterval(interval);
      router?.cleanup();
    };
  });

  async function checkConnection() {
    try {
      const response = await router?.send(MessageType.PING);
      isConnected = response?.type === MessageType.PONG;
    } catch {
      isConnected = false;
    }
  }

  function handleEvent(event: Event) {
    const msg = event.msg;

    switch (msg.type) {
      case 'AgentMessage':
        if ('data' in msg && msg.data && 'message' in msg.data) {
          messages = [...messages, {
            type: 'agent',
            content: msg.data.message,
            timestamp: Date.now(),
          }];
        }
        break;

      case 'TaskStarted':
        isProcessing = true;
        break;

      case 'TaskComplete':
        isProcessing = false;
        break;

      case 'Error':
        if ('data' in msg && msg.data && 'message' in msg.data) {
          messages = [...messages, {
            type: 'agent',
            content: `Error: ${msg.data.message}`,
            timestamp: Date.now(),
          }];
        }
        isProcessing = false;
        break;
    }
  }

  async function sendMessage() {
    if (!inputText.trim() || !isConnected) return;

    const text = inputText.trim();
    inputText = '';

    // Add user message
    messages = [...messages, {
      type: 'user',
      content: text,
      timestamp: Date.now(),
    }];

    // Send to agent
    try {
      await router.sendSubmission({
        id: `user_${Date.now()}`,
        op: {
          type: 'UserInput',
          items: [{ type: 'text', text }],
        },
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      messages = [...messages, {
        type: 'agent',
        content: 'Failed to send message. Please try again.',
        timestamp: Date.now(),
      }];
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getMessageType(message: { type: 'user' | 'agent'; content: string }): 'default' | 'warning' | 'error' | 'input' | 'system' {
    if (message.type === 'user') return 'input';
    if (message.content.toLowerCase().startsWith('error:')) return 'error';
    if (message.content.toLowerCase().includes('warning')) return 'warning';
    if (message.content.toLowerCase().includes('system')) return 'system';
    return 'default';
  }
</script>

<TerminalContainer>
  <!-- Status Line -->
  <div class="flex justify-between mb-2">
    <TerminalMessage type="system" content="Codex Terminal v1.0.0" />
    <div class="flex items-center space-x-2">
      {#if isProcessing}
        <TerminalMessage type="warning" content="[PROCESSING]" />
      {/if}
      <TerminalMessage
        type={isConnected ? 'system' : 'error'}
        content={isConnected ? '[CONNECTED]' : '[DISCONNECTED]'}
      />
    </div>
  </div>

  <!-- Messages -->
  <div class="flex-1 overflow-y-auto mb-4">
    {#if messages.length === 0}
      <TerminalMessage type="system" content="Welcome to Codex Terminal" />
      <TerminalMessage type="default" content="Ready for input. Type a command to begin..." />
    {/if}

    {#each messages as message}
      <div class="mb-1">
        {#if message.type === 'user'}
          <div class="terminal-prompt">
            <TerminalMessage type="input" content={message.content} />
          </div>
        {:else}
          <TerminalMessage type={getMessageType(message)} content={message.content} />
        {/if}
      </div>
    {/each}
  </div>

  <!-- Input -->
  <div class="terminal-prompt flex items-center">
    <span class="text-term-dim-green mr-2">&gt;</span>
    <TerminalInput
      bind:value={inputText}
      onSubmit={sendMessage}
      placeholder="Enter command..."
    />
  </div>
</TerminalContainer>

<style>
  /* Component-specific styles */
  textarea {
    font-family: inherit;
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: .5;
    }
  }
</style>