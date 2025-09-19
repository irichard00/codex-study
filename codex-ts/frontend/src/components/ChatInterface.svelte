<script lang="ts">
  import { onMount } from 'svelte';
  import { messagesStore } from '../stores/messages';
  import { websocketService } from '../services/websocket';
  import type { Message } from '../../../shared/types';

  let inputMessage = '';
  let messagesContainer: HTMLDivElement;
  let isLoading = false;

  $: messages = $messagesStore;

  function handleSendMessage() {
    if (!inputMessage.trim() || isLoading) return;

    const message = inputMessage.trim();
    inputMessage = '';
    isLoading = true;

    // Add user message to store
    messagesStore.addMessage({
      role: 'user',
      content: message,
    } as Message);

    // Send via WebSocket
    websocketService.sendMessage(message);

    // Scroll to bottom
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
  }

  onMount(() => {
    // Listen for assistant messages
    websocketService.on('CONVERSATION_MESSAGE', (data) => {
      messagesStore.addMessage(data.message);
      isLoading = false;
    });

    websocketService.on('AGENT_STATUS', (data) => {
      isLoading = data.status === 'thinking' || data.status === 'executing';
    });
  });
</script>

<div class="chat-interface">
  <div class="messages" bind:this={messagesContainer}>
    {#each messages as message}
      <div class="message {message.role}">
        <div class="message-role">{message.role}</div>
        <div class="message-content">{message.content}</div>
      </div>
    {/each}
    {#if isLoading}
      <div class="message assistant">
        <div class="message-role">assistant</div>
        <div class="message-content loading">Thinking...</div>
      </div>
    {/if}
  </div>

  <div class="input-area">
    <input
      type="text"
      bind:value={inputMessage}
      on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
      placeholder="Type your message..."
      disabled={isLoading}
    />
    <button
      class="primary"
      on:click={handleSendMessage}
      disabled={isLoading || !inputMessage.trim()}
    >
      Send
    </button>
  </div>
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .message {
    margin-bottom: 1rem;
    padding: 1rem;
    border-radius: 8px;
    background: var(--light);
  }

  .message.user {
    background: #e3f2fd;
    margin-left: 20%;
  }

  .message.assistant {
    background: var(--light);
    margin-right: 20%;
  }

  .message-role {
    font-size: 0.875rem;
    color: var(--secondary);
    margin-bottom: 0.5rem;
    text-transform: capitalize;
  }

  .message-content {
    white-space: pre-wrap;
  }

  .message-content.loading {
    color: var(--secondary);
    font-style: italic;
  }

  .input-area {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid var(--border);
  }

  .input-area input {
    flex: 1;
  }
</style>