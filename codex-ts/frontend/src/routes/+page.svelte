<script lang="ts">
  import { onMount } from 'svelte';
  import ChatInterface from '../components/ChatInterface.svelte';
  import FileBrowser from '../components/FileBrowser.svelte';
  import { sessionStore, createSession } from '../stores/session';
  import { websocketService } from '../services/websocket';

  let workspaceDir = '';
  let isConnected = false;
  let showFileBrowser = false;

  onMount(async () => {
    // Check if we have an existing session
    const existingSession = sessionStore.get();
    if (existingSession) {
      await connectWebSocket(existingSession.id);
    }
  });

  async function handleCreateSession() {
    if (!workspaceDir) {
      alert('Please enter a workspace directory');
      return;
    }

    try {
      const session = await createSession(workspaceDir);
      await connectWebSocket(session.id);
    } catch (error) {
      console.error('Failed to create session:', error);
      alert('Failed to create session');
    }
  }

  async function connectWebSocket(sessionId: string) {
    try {
      await websocketService.connect(sessionId);
      isConnected = true;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }
</script>

<div class="container">
  {#if !isConnected}
    <div class="setup">
      <h1>Welcome to Codex TypeScript</h1>
      <p>Enter your workspace directory to get started:</p>
      <input
        type="text"
        bind:value={workspaceDir}
        placeholder="/path/to/workspace"
        on:keydown={(e) => e.key === 'Enter' && handleCreateSession()}
      />
      <button class="primary" on:click={handleCreateSession}>Start Session</button>
    </div>
  {:else}
    <div class="main">
      <div class="sidebar">
        <button
          class="sidebar-toggle"
          on:click={() => (showFileBrowser = !showFileBrowser)}
        >
          {showFileBrowser ? 'Hide' : 'Show'} Files
        </button>
        {#if showFileBrowser}
          <FileBrowser />
        {/if}
      </div>
      <div class="content">
        <ChatInterface />
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .setup {
    max-width: 500px;
    margin: 100px auto;
    padding: 2rem;
    text-align: center;
  }

  .setup h1 {
    margin-bottom: 1rem;
  }

  .setup p {
    margin-bottom: 2rem;
    color: var(--secondary);
  }

  .setup input {
    margin-bottom: 1rem;
  }

  .main {
    display: flex;
    height: 100%;
  }

  .sidebar {
    width: 300px;
    border-right: 1px solid var(--border);
    padding: 1rem;
    overflow-y: auto;
  }

  .sidebar-toggle {
    width: 100%;
    margin-bottom: 1rem;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>