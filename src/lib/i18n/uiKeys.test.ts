import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import bn from '@/locales/bn/common.json';
import en from '@/locales/en/common.json';

/**
 * Every UI string must come from `src/locales/**` (PROJECT_RULES 3.1 #14).
 *
 * This test reads the source files and checks that each literal key passed to
 * `t('…')` exists in both languages. It catches the most common i18n bug — a
 * typo in a key that silently renders as the raw key in production.
 *
 * Limits, on purpose: only literal keys are checked. Templated keys such as
 * `t(\`errors.${code}\`)` cannot be resolved statically and are covered by the
 * separate tests for those code lists.
 */

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const compilers = walk(SRC).filter(
  (file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('.test.'),
);

/** Resolves "a.b.c" inside a loaded namespace object. */
function lookup(node: unknown, key: string): boolean {
  let cursor = node;
  for (const part of key.split('.')) {
    if (typeof cursor !== 'object' || cursor === null) return false;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === 'string';
}

/** Global namespaces, always available through i18next's defaultNS chain. */
const namespaces = Object.fromEntries(
  readdirSync(join(SRC, 'locales', 'bn'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => [
      file.replace('.json', ''),
      JSON.parse(readFileSync(join(SRC, 'locales', 'bn', file), 'utf8')),
    ]),
) as Record<string, unknown>;

const englishNamespaces = Object.fromEntries(
  readdirSync(join(SRC, 'locales', 'en'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => [
      file.replace('.json', ''),
      JSON.parse(readFileSync(join(SRC, 'locales', 'en', file), 'utf8')),
    ]),
) as Record<string, unknown>;

type Usage = { file: string; namespace: string; key: string };

const usages: Usage[] = [];

for (const file of compilers) {
  const source = readFileSync(file, 'utf8');
  const namespaceMatch = /useAppTranslation\(\s*'([\w]+)'/.exec(source);
  if (!namespaceMatch?.[1]) continue;
  const namespace = namespaceMatch[1];

  for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) {
    const raw = match[1] as string;
    // "common:actions.back" reaches into another namespace; a bare key uses
    // the namespace of the hook.
    const [ns, key] = raw.includes(':') ? raw.split(':') : [namespace, raw];
    if (!ns || !key) continue;
    usages.push({ file: file.replace(`${SRC}/`, 'src/'), namespace: ns, key });
  }
}

describe('translation keys used by the UI', () => {
  it('finds the translation calls (guards against a broken scan)', () => {
    expect(usages.length).toBeGreaterThan(50);
  });

  it('resolves every literal key in Bangla', () => {
    const missing = usages.filter((usage) => !lookup(namespaces[usage.namespace], usage.key));
    expect(missing).toEqual([]);
  });

  it('resolves every literal key in English', () => {
    const missing = usages.filter(
      (usage) => !lookup(englishNamespaces[usage.namespace], usage.key),
    );
    expect(missing).toEqual([]);
  });

  it('only references namespaces that exist', () => {
    const unknown = usages.filter(
      (usage) => !(usage.namespace in namespaces) || !(usage.namespace in englishNamespaces),
    );
    expect(unknown).toEqual([]);
  });
});

describe('locale files', () => {
  it('have the same namespaces', () => {
    expect(Object.keys(englishNamespaces).sort()).toEqual(Object.keys(namespaces).sort());
  });

  it('are all loaded by the i18n setup', () => {
    // A namespace on disk that i18n never loads renders raw keys.
    const setup = readFileSync(join(SRC, 'lib', 'i18n', 'index.ts'), 'utf8');
    for (const namespace of Object.keys(namespaces)) {
      expect(setup, `namespace ${namespace} is not imported by i18n`).toContain(namespace);
    }
  });

  it('still ship the two namespaces every screen needs', () => {
    expect(namespaces).toHaveProperty('common');
    expect(bn).toHaveProperty('nav');
    expect(en).toHaveProperty('nav');
  });
});
