<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '../services/api';
  import { sessionStore } from '../stores/session';
  import type { FileInfo } from '../../../shared/types';

  let files: FileInfo[] = [];
  let currentPath = '.';
  let isLoading = false;

  onMount(() => {
    loadFiles();
  });

  async function loadFiles(path = '.') {
    isLoading = true;
    try {
      const session = sessionStore.get();
      if (!session) return;

      const response = await apiClient.get(`/api/sessions/${session.id}/files`, {
        params: { path },
      });
      files = response.data;
      currentPath = path;
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      isLoading = false;
    }
  }

  async function handleFileClick(file: FileInfo) {
    if (file.type === 'directory') {
      loadFiles(file.path);
    } else {
      // Open file in editor
      openFile(file.path);
    }
  }

  async function openFile(path: string) {
    try {
      const session = sessionStore.get();
      if (!session) return;

      const response = await apiClient.get(`/api/sessions/${session.id}/files/content`, {
        params: { path },
      });

      // Emit event or update store for file editor
      console.log('File content:', response.data);
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }

  function goUp() {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '.';
    loadFiles(parentPath);
  }
</script>

<div class="file-browser">
  <div class="path-bar">
    <button on:click={() => loadFiles('.')}>Root</button>
    {#if currentPath !== '.'}
      <button on:click={goUp}>Up</button>
    {/if}
    <span class="current-path">{currentPath}</span>
  </div>

  {#if isLoading}
    <div class="loading">Loading files...</div>
  {:else}
    <div class="file-list">
      {#each files as file}
        <div
          class="file-item"
          class:directory={file.type === 'directory'}
          on:click={() => handleFileClick(file)}
        >
          <span class="file-icon">
            {file.type === 'directory' ? '📁' : '📄'}
          </span>
          <span class="file-name">{file.name}</span>
          {#if file.type === 'file'}
            <span class="file-size">{(file.size / 1024).toFixed(1)} KB</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .file-browser {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .path-bar {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  .path-bar button {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
  }

  .current-path {
    flex: 1;
    font-size: 0.875rem;
    color: var(--secondary);
  }

  .file-list {
    flex: 1;
    overflow-y: auto;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .file-item:hover {
    background: var(--light);
  }

  .file-item.directory {
    font-weight: 500;
  }

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    font-size: 0.875rem;
    color: var(--secondary);
  }

  .loading {
    padding: 1rem;
    text-align: center;
    color: var(--secondary);
  }
</style>