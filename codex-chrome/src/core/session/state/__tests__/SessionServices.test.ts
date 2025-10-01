/**
 * SessionServices factory tests
 * Tests must fail until SessionServices is implemented (TDD)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionServices } from '../SessionServices';
import type { SessionServices } from '../types';

describe('SessionServices Factory', () => {
  describe('createSessionServices', () => {
    it('should create services with defaults', async () => {
      const services = await createSessionServices({}, false);

      expect(services).toBeDefined();
      expect(services.notifier).toBeDefined();
      expect(services.showRawAgentReasoning).toBe(false);
    });

    it('should create services in test mode', async () => {
      const services = await createSessionServices({}, true);

      expect(services).toBeDefined();
      expect(services.notifier).toBeDefined();
      // Test mode might use mock services
    });

    it('should use provided conversation store', async () => {
      const mockStore = {
        save: vi.fn(),
        load: vi.fn(),
        delete: vi.fn(),
      };

      const services = await createSessionServices(
        { conversationStore: mockStore as any },
        false
      );

      expect(services.conversationStore).toBe(mockStore);
    });

    it('should use provided notifier', async () => {
      const mockNotifier = {
        notify: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
      };

      const services = await createSessionServices(
        { notifier: mockNotifier as any },
        false
      );

      expect(services.notifier).toBe(mockNotifier);
    });

    it('should use provided rollout recorder', async () => {
      const mockRecorder = {
        record: vi.fn(),
      };

      const services = await createSessionServices(
        { rolloutRecorder: mockRecorder as any },
        false
      );

      expect(services.rolloutRecorder).toBe(mockRecorder);
    });

    it('should use provided DOM service', async () => {
      const mockDOMService = {
        querySelector: vi.fn(),
        click: vi.fn(),
        getText: vi.fn(),
      };

      const services = await createSessionServices(
        { domService: mockDOMService as any },
        false
      );

      expect(services.domService).toBe(mockDOMService);
    });

    it('should use provided tab manager', async () => {
      const mockTabManager = {
        getCurrentTab: vi.fn(),
        openTab: vi.fn(),
        closeTab: vi.fn(),
      };

      const services = await createSessionServices(
        { tabManager: mockTabManager as any },
        false
      );

      expect(services.tabManager).toBe(mockTabManager);
    });

    it('should respect showRawAgentReasoning flag', async () => {
      const services1 = await createSessionServices(
        { showRawAgentReasoning: true },
        false
      );
      expect(services1.showRawAgentReasoning).toBe(true);

      const services2 = await createSessionServices(
        { showRawAgentReasoning: false },
        false
      );
      expect(services2.showRawAgentReasoning).toBe(false);
    });

    it('should allow partial service override', async () => {
      const mockNotifier = {
        notify: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
      };

      const services = await createSessionServices(
        {
          notifier: mockNotifier as any,
          showRawAgentReasoning: true,
        },
        false
      );

      expect(services.notifier).toBe(mockNotifier);
      expect(services.showRawAgentReasoning).toBe(true);
      // Other services should have defaults
      expect(services.conversationStore).toBeDefined();
    });

    it('should create independent service instances', async () => {
      const services1 = await createSessionServices({}, false);
      const services2 = await createSessionServices({}, false);

      // Services should be different instances (unless they're singletons)
      expect(services1).not.toBe(services2);
    });
  });

  describe('Service Interface', () => {
    let services: SessionServices;

    beforeEach(async () => {
      services = await createSessionServices({}, false);
    });

    it('should have required notifier', () => {
      expect(services.notifier).toBeDefined();
      expect(typeof services.notifier.notify).toBe('function');
    });

    it('should have showRawAgentReasoning boolean', () => {
      expect(typeof services.showRawAgentReasoning).toBe('boolean');
    });

    it('should have optional conversation store', () => {
      if (services.conversationStore) {
        expect(typeof services.conversationStore.save).toBe('function');
        expect(typeof services.conversationStore.load).toBe('function');
      }
    });

    it('should have optional rollout recorder', () => {
      if (services.rolloutRecorder) {
        expect(typeof services.rolloutRecorder.record).toBe('function');
      }
    });

    it('should have optional DOM service', () => {
      if (services.domService) {
        expect(services.domService).toBeDefined();
      }
    });

    it('should have optional tab manager', () => {
      if (services.tabManager) {
        expect(services.tabManager).toBeDefined();
      }
    });
  });

  describe('Test Mode vs Production Mode', () => {
    it('should create different services in test mode', async () => {
      const prodServices = await createSessionServices({}, false);
      const testServices = await createSessionServices({}, true);

      // Both should have required fields
      expect(prodServices.notifier).toBeDefined();
      expect(testServices.notifier).toBeDefined();

      // Test services might use mocks or simpler implementations
      expect(prodServices).toBeDefined();
      expect(testServices).toBeDefined();
    });

    it('should allow service override in test mode', async () => {
      const mockNotifier = {
        notify: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
      };

      const services = await createSessionServices(
        { notifier: mockNotifier as any },
        true
      );

      expect(services.notifier).toBe(mockNotifier);
    });
  });
});
