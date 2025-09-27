/**
 * T019: No Migration Test
 * Verifies that migration-related code and features are not present in the simplified implementation
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('No Migration Code Verification', () => {
  const configDir = path.resolve(__dirname, '../../src/config');
  const testFiles = [
    'env-loader.ts',
    'env-transformer.ts',
    'business-rules.ts',
    'env-types.ts',
    'defaults.ts',
    'types.ts'
  ];

  describe('Source files should not contain migration code', () => {
    testFiles.forEach(fileName => {
      it(`${fileName} should not contain migration-related keywords`, () => {
        const filePath = path.join(configDir, fileName);

        if (!fs.existsSync(filePath)) {
          // Some files might not exist, that's fine
          return;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Keywords that should NOT appear in simplified implementation
        const forbiddenKeywords = [
          'migration',
          'migrate',
          'migrat', // catches migrate, migration, migrating, etc.
          'legacy',
          'convert',
          'upgrade',
          'downgrade',
          'backward-compat',
          'backwards-compat',
          'compatibility',
          'convert-from',
          'convert-to',
          'version-upgrade',
          'schema-migration',
          'config-migration',
          'migrate-config',
          'legacy-support',
          'deprecated-config'
        ];

        forbiddenKeywords.forEach(keyword => {
          expect(content.toLowerCase()).not.toContain(keyword.toLowerCase());
        });
      });

      it(`${fileName} should not contain migration-related function names`, () => {
        const filePath = path.join(configDir, fileName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Function names that should NOT exist
        const forbiddenFunctions = [
          'migrateLegacyConfig',
          'convertOldFormat',
          'upgradeConfigVersion',
          'migrateFromVersion',
          'convertFromLegacy',
          'transformLegacyFormat',
          'upgradeConfiguration',
          'migrateSettings',
          'convertConfiguration',
          'updateConfigFormat'
        ];

        forbiddenFunctions.forEach(funcName => {
          expect(content).not.toContain(funcName);
        });
      });

      it(`${fileName} should not contain migration-related interfaces`, () => {
        const filePath = path.join(configDir, fileName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Interface names that should NOT exist
        const forbiddenInterfaces = [
          'IMigrationResult',
          'IConfigMigrator',
          'ILegacyConfig',
          'IMigrationOptions',
          'IVersionUpgrader',
          'IConfigConverter',
          'IBackwardCompatibility',
          'IMigrationStrategy',
          'ILegacySupport'
        ];

        forbiddenInterfaces.forEach(interfaceName => {
          expect(content).not.toContain(interfaceName);
        });
      });

      it(`${fileName} should not contain migration-related types`, () => {
        const filePath = path.join(configDir, fileName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Type names that should NOT exist
        const forbiddenTypes = [
          'MigrationResult',
          'LegacyConfig',
          'ConfigVersion',
          'MigrationOptions',
          'LegacyFormat',
          'DeprecatedConfig',
          'BackwardCompatConfig',
          'MigrationStrategy',
          'ConfigConverter'
        ];

        forbiddenTypes.forEach(typeName => {
          expect(content).not.toContain(typeName);
        });
      });
    });
  });

  describe('Migration-related files should not exist', () => {
    const forbiddenFiles = [
      'migration.ts',
      'migrator.ts',
      'legacy-config.ts',
      'config-migrator.ts',
      'version-upgrader.ts',
      'backward-compat.ts',
      'config-converter.ts',
      'legacy-support.ts',
      'migration-strategies.ts',
      'config-migration.ts'
    ];

    forbiddenFiles.forEach(fileName => {
      it(`${fileName} should not exist`, () => {
        const filePath = path.join(configDir, fileName);
        expect(fs.existsSync(filePath)).toBe(false);
      });
    });
  });

  describe('Test files should not contain migration tests', () => {
    const testDir = path.resolve(__dirname, '..');

    it('should not have migration-specific test files', () => {
      const forbiddenTestFiles = [
        'migration.test.ts',
        'migrator.test.ts',
        'legacy-config.test.ts',
        'config-migration.test.ts',
        'backward-compat.test.ts',
        'version-upgrade.test.ts'
      ];

      function checkDirectory(dir: string) {
        if (!fs.existsSync(dir)) return;

        const files = fs.readdirSync(dir, { withFileTypes: true });

        files.forEach(file => {
          if (file.isDirectory()) {
            checkDirectory(path.join(dir, file.name));
          } else if (file.isFile()) {
            forbiddenTestFiles.forEach(forbiddenFile => {
              expect(file.name).not.toBe(forbiddenFile);
            });
          }
        });
      }

      checkDirectory(testDir);
    });

    it('existing test files should not contain migration test cases', () => {
      const currentTestFiles = [
        'env-loader.test.ts',
        'env-transformer.test.ts',
        'business-rules.test.ts'
      ];

      currentTestFiles.forEach(fileName => {
        const filePath = path.join(__dirname, fileName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Test descriptions that should NOT exist
        const forbiddenTestDescriptions = [
          'should migrate legacy config',
          'should convert old format',
          'should upgrade configuration',
          'should handle legacy settings',
          'should migrate from version',
          'should convert deprecated format',
          'should maintain backward compatibility',
          'migration should work',
          'legacy support'
        ];

        forbiddenTestDescriptions.forEach(description => {
          expect(content.toLowerCase()).not.toContain(description.toLowerCase());
        });
      });
    });
  });

  describe('Environment variables should not reference migration', () => {
    it('should not use migration-related environment variable names', () => {
      // Check if any config files reference migration-related env vars
      testFiles.forEach(fileName => {
        const filePath = path.join(configDir, fileName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        const forbiddenEnvVars = [
          'CODEX_MIGRATION_ENABLED',
          'CODEX_LEGACY_SUPPORT',
          'CODEX_BACKWARD_COMPAT',
          'CODEX_CONFIG_VERSION',
          'CODEX_MIGRATION_MODE',
          'CODEX_CONVERT_LEGACY',
          'CODEX_UPGRADE_CONFIG'
        ];

        forbiddenEnvVars.forEach(envVar => {
          expect(content).not.toContain(envVar);
        });
      });
    });

    it('should not have migration-related configuration options', () => {
      const typesFile = path.join(configDir, 'types.ts');

      if (!fs.existsSync(typesFile)) {
        return;
      }

      const content = fs.readFileSync(typesFile, 'utf8');

      // Properties that should NOT exist in config interfaces
      const forbiddenProperties = [
        'enableMigration',
        'legacySupport',
        'backwardCompatible',
        'migrationMode',
        'configVersion',
        'allowLegacy',
        'convertLegacy',
        'migrationEnabled'
      ];

      forbiddenProperties.forEach(property => {
        expect(content).not.toContain(property);
      });
    });
  });

  describe('Package.json should not include migration dependencies', () => {
    it('should not have migration-related packages', () => {
      const packageJsonPath = path.resolve(__dirname, '../../../package.json');

      if (!fs.existsSync(packageJsonPath)) {
        return;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      const forbiddenPackages = [
        'config-migrator',
        'legacy-config-converter',
        'backward-compat-helper',
        'config-upgrade-tool',
        'migration-helper',
        'version-migrator'
      ];

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies
      };

      forbiddenPackages.forEach(pkg => {
        expect(allDeps).not.toHaveProperty(pkg);
      });
    });
  });

  describe('Documentation should not reference migration', () => {
    it('should not have migration-related documentation', () => {
      const docsDir = path.resolve(__dirname, '../../../docs');

      if (!fs.existsSync(docsDir)) {
        return; // No docs directory
      }

      const forbiddenDocFiles = [
        'migration.md',
        'config-migration.md',
        'legacy-support.md',
        'backward-compatibility.md',
        'upgrading.md',
        'migration-guide.md'
      ];

      forbiddenDocFiles.forEach(fileName => {
        const filePath = path.join(docsDir, fileName);
        expect(fs.existsSync(filePath)).toBe(false);
      });
    });
  });

  describe('Code comments should not mention migration', () => {
    testFiles.forEach(fileName => {
      it(`${fileName} comments should not reference migration`, () => {
        const filePath = path.join(configDir, fileName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Extract comments (simple regex for // and /* */ comments)
        const commentRegex = /(?:\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
        const comments = content.match(commentRegex) || [];

        const forbiddenInComments = [
          'migration',
          'migrate',
          'legacy',
          'backward compatibility',
          'deprecated config',
          'old format',
          'convert from',
          'upgrade from'
        ];

        comments.forEach(comment => {
          forbiddenInComments.forEach(keyword => {
            expect(comment.toLowerCase()).not.toContain(keyword.toLowerCase());
          });
        });
      });
    });
  });

  describe('API should not expose migration methods', () => {
    it('exported functions should not include migration methods', () => {
      // Check main config files for exported migration functions
      const mainFiles = ['env-loader.ts', 'env-transformer.ts'];

      mainFiles.forEach(fileName => {
        const filePath = path.join(configDir, fileName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Look for export statements with migration-related names
        const exportRegex = /export\s+(?:function|class|const|let|var)\s+(\w+)/g;
        let match;

        while ((match = exportRegex.exec(content)) !== null) {
          const exportedName = match[1];

          const migrationKeywords = ['migrat', 'legacy', 'convert', 'upgrade'];
          migrationKeywords.forEach(keyword => {
            expect(exportedName.toLowerCase()).not.toContain(keyword);
          });
        }
      });
    });

    it('interfaces should not expose migration methods', () => {
      testFiles.forEach(fileName => {
        const filePath = path.join(configDir, fileName);

        if (!fs.existsSync(filePath)) {
          return;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Look for interface method definitions with migration names
        const methodRegex = /(\w+)\s*\([^)]*\)\s*:/g;
        let match;

        while ((match = methodRegex.exec(content)) !== null) {
          const methodName = match[1];

          const migrationKeywords = ['migrat', 'legacy', 'convert', 'upgrade'];
          migrationKeywords.forEach(keyword => {
            expect(methodName.toLowerCase()).not.toContain(keyword);
          });
        }
      });
    });
  });

  describe('Configuration schema should not include migration fields', () => {
    it('should not have migration-related schema fields', () => {
      const schemaFile = path.join(configDir, 'env-schemas.ts');

      if (!fs.existsSync(schemaFile)) {
        return;
      }

      const content = fs.readFileSync(schemaFile, 'utf8');

      const forbiddenSchemaFields = [
        'migration',
        'legacy',
        'backward',
        'compat',
        'convert',
        'upgrade',
        'version'
      ];

      forbiddenSchemaFields.forEach(field => {
        // Look for schema field definitions
        const fieldRegex = new RegExp(`\\b${field}\\w*\\s*:`, 'i');
        expect(content).not.toMatch(fieldRegex);
      });
    });
  });

  describe('Build output should not include migration code', () => {
    it('generated types should not include migration interfaces', () => {
      // This test ensures that if types are generated, they don't include migration
      const generatedTypesPath = path.join(configDir, 'generated-types.ts');

      if (!fs.existsSync(generatedTypesPath)) {
        return; // Generated types might not exist
      }

      const content = fs.readFileSync(generatedTypesPath, 'utf8');

      expect(content).not.toContain('Migration');
      expect(content).not.toContain('Legacy');
      expect(content).not.toContain('Backward');
      expect(content).not.toContain('Convert');
    });
  });
});