/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Locale-aware registry for module translation bundles.
 *
 * Modules used to hand their whole translation context to `addNamespace`,
 * which loaded every locale it contained. With two languages that put both
 * copies of every module's dictionary in the browser bundle, and half of it
 * was always the wrong language.
 *
 * Modules now register the context instead of its contents. Registration is
 * synchronous and loads nothing; the registry pulls one locale at a time and
 * remembers what it has applied, so:
 *
 *   - the browser fetches only the language it is showing;
 *   - switching language pulls the other one on demand, once;
 *   - the server, which clones one i18next instance per request and shares
 *     the resource store, loads every locale at boot as it always did.
 *
 * Contexts must therefore be declared with `mode: 'lazy'`, so each locale
 * file becomes its own chunk. A synchronous context still works, it simply
 * has nothing left to defer.
 */

import { createRspackContextAdapter } from '@shared/utils/contextAdapter.js';

import { DEFAULT_LOCALE } from './constants.js';
import { addNamespace } from './utils.js';

/** Extracts the locale code from a translation filename. */
const LOCALE_FROM_FILE = /([^/\\]+)\.json$/i;

/**
 * @typedef {Object} RegisteredContext
 * @property {string} namespace - i18n namespace the bundle belongs to
 * @property {Object} context - The context as handed in, used as identity
 * @property {string} fingerprint - The context's sorted file list
 * @property {Object} adapter - Context adapter
 * @property {Map<string, Promise<void>>} applied - locale → in-flight or settled load
 */

/**
 * Registered contexts, keyed by namespace.
 *
 * A Map rather than a Set because registration repeats: the server re-runs
 * module discovery whenever the compiled route tree is invalidated — an
 * extension install, uninstall or refresh, and every HMR reload — and each
 * pass registers the same ten namespaces again. Appending would grow the
 * registry without bound and make `activateLocale`, which every SSR request
 * dispatches, walk a longer list each time. Keying by namespace keeps one
 * entry per module and lets a re-registration reuse the dictionaries it
 * already loaded.
 *
 * @type {Map<string, RegisteredContext>}
 */
let registry = new Map();

/**
 * Locales the runtime currently wants loaded. **Browser only.**
 *
 * Seeded from the same `window.__XNAPIFY_LOCALE__` that the i18next singleton
 * reads, which Html.js writes before the Redux blob. Taking it from there
 * rather than waiting to be told means a module can register at any point in
 * startup and still get the right language, with no ordering rule to observe.
 *
 * There is exactly one browser runtime per user, so a process-global set is
 * the right shape there. On the server it would be a cross-request leak — one
 * process serves every request, and the language is a property of the request,
 * not of the process. Nothing on the server reads or writes it: every path
 * that touches it is behind `needsAllLocales() === false`.
 *
 * @type {Set<string>}
 */
let activeLocales = new Set(
  // eslint-disable-next-line no-underscore-dangle
  globalThis.__XNAPIFY_LOCALE__ ? [globalThis.__XNAPIFY_LOCALE__] : [],
);

/**
 * Whether this runtime needs every locale at once.
 *
 * The server shares one resource store across concurrent renders in different
 * languages, so it cannot load lazily per request. The browser only ever
 * displays one language at a time.
 *
 * @returns {boolean}
 */
function needsAllLocales() {
  return typeof window === 'undefined';
}

/**
 * Locales available in a context, read from filenames without loading them.
 *
 * @param {Object} adapter - Context adapter
 * @returns {string[]}
 */
function localesOf(adapter) {
  const locales = [];
  for (const file of adapter.files()) {
    const match = file.match(LOCALE_FROM_FILE);
    if (match) locales.push(match[1]);
  }
  return locales;
}

/**
 * A context's identity in terms of what it contains rather than which object
 * it is: the files it describes, order-independent.
 *
 * @param {Object} adapter - Context adapter
 * @returns {string}
 */
function fingerprintOf(adapter) {
  return adapter.files().slice().sort().join('\n');
}

/**
 * Load one locale out of one registered context and register the bundle.
 * Memoised per context and locale.
 *
 * @param {RegisteredContext} entry - Registered context
 * @param {string} locale - Locale code
 * @returns {Promise<void>}
 */
function applyLocale(entry, locale) {
  const existing = entry.applied.get(locale);
  if (existing) return existing;

  const file = entry.adapter
    .files()
    .find(name => (name.match(LOCALE_FROM_FILE) || [])[1] === locale);

  if (!file) {
    const resolved = Promise.resolve();
    entry.applied.set(locale, resolved);
    return resolved;
  }

  const pending = Promise.resolve(entry.adapter.load(file))
    .then(loaded => {
      const translation = (loaded && loaded.default) || loaded;
      if (translation && typeof translation === 'object') {
        addNamespace(entry.namespace, { [locale]: translation });
      }
    })
    .catch(error => {
      // A missing dictionary degrades to i18next's own key fallback; it must
      // not take down the render that triggered the load.
      console.error(
        `[i18n] Failed to load "${entry.namespace}" for ${locale}:`,
        error.message,
      );
      entry.applied.delete(locale);
    });

  entry.applied.set(locale, pending);
  return pending;
}

/**
 * Register a module's translation context and load the locales in use.
 *
 * @param {string} namespace - i18n namespace
 * @param {Object} context - Rspack context, or an adapter around one
 * @returns {Promise<void>} Resolves once the active locales are registered
 */
export function registerResourceContext(namespace, context) {
  if (!namespace || !context) return Promise.resolve();

  // Re-registering the same namespace with the same context is a no-op
  // beyond making sure the active locales are loaded; a genuinely new
  // context (an extension replaced by a rebuilt copy) replaces the entry and
  // starts with a fresh `applied` map so its dictionaries are re-read.
  //
  // Two things have to match for an entry to be reused, because neither one
  // implies the other:
  //
  //   - the context the caller passed. Not the adapter: that is rebuilt on
  //     every call and would never compare equal. Reuse therefore relies on
  //     `translations()` returning the *same* object each time it is called,
  //     which every module does by holding it in a module-level `const`; a
  //     hook that built its context inline would hand back a new object on
  //     every discovery pass and re-read every dictionary.
  //   - the file list that context describes. Identity alone is an assumption
  //     about the bundler, and a stale one the moment a context is mutable or
  //     hand-rolled: a context that gained or lost a locale must be re-read
  //     even if it is the same object.
  //
  // Both halves are pinned in resources.test.js.
  const adapter = context.files ? context : createRspackContextAdapter(context);
  const fingerprint = fingerprintOf(adapter);

  let entry = registry.get(namespace);
  if (
    !entry ||
    entry.context !== context ||
    entry.fingerprint !== fingerprint
  ) {
    entry = {
      namespace,
      context,
      fingerprint,
      adapter,
      applied: new Map(),
    };
    registry.set(namespace, entry);
  }

  const wanted = needsAllLocales()
    ? localesOf(entry.adapter)
    : Array.from(resolveActiveLocales());

  return Promise.all(wanted.map(locale => applyLocale(entry, locale))).then(
    () => undefined,
  );
}

/**
 * Locales the browser should hold: whatever has been activated, and always
 * the default so that i18next's fallback chain can resolve.
 *
 * @returns {Set<string>}
 */
function resolveActiveLocales() {
  const wanted = new Set(activeLocales);
  wanted.add(DEFAULT_LOCALE);
  return wanted;
}

/**
 * Make a locale available across every registered module.
 *
 * Called before switching language, so the new dictionaries are in place
 * before anything re-renders. Loading a locale that is already present is
 * free.
 *
 * @param {string} locale - Locale code
 * @returns {Promise<void>}
 */
export async function activateLocale(locale) {
  const work = [];

  if (needsAllLocales()) {
    /*
     * One resource store serves every concurrent request, so the server has
     * no "active locale" to record: it holds every locale at once, and this
     * call only has to make sure that is still true for anything registered
     * since. The caller's locale is deliberately *not* added to
     * `activeLocales` — that set is process-global, so writing a request's
     * language into it would leak into the next request's view of the world
     * (`getActiveLocales()` would name whichever request activated last).
     */
    for (const entry of registry.values()) {
      for (const code of localesOf(entry.adapter)) {
        work.push(applyLocale(entry, code));
      }
    }

    await Promise.all(work);
    return;
  }

  if (typeof locale === 'string' && locale) activeLocales.add(locale);

  const wanted = resolveActiveLocales();
  for (const entry of registry.values()) {
    for (const code of wanted) work.push(applyLocale(entry, code));
  }

  await Promise.all(work);
}

/**
 * Locales the runtime currently holds. Exposed for tests and debugging.
 *
 * In the browser that is the set the user has activated, plus the default so
 * i18next's fallback chain resolves. On the server there is no such set —
 * every registered locale is loaded and the language belongs to the request,
 * not the process — so this reports what the registered contexts actually
 * provide. Answering from a process-global set there would hand the caller
 * whichever language the last request happened to render in.
 *
 * @returns {string[]}
 */
export function getActiveLocales() {
  if (needsAllLocales()) {
    const available = new Set([DEFAULT_LOCALE]);
    for (const entry of registry.values()) {
      for (const code of localesOf(entry.adapter)) available.add(code);
    }
    return Array.from(available);
  }

  return Array.from(resolveActiveLocales());
}

/**
 * Drop all registrations. Used by HMR and tests; never in a running server.
 */
export function resetResourceRegistry() {
  registry = new Map();
  activeLocales = new Set(
    // eslint-disable-next-line no-underscore-dangle
    globalThis.__XNAPIFY_LOCALE__ ? [globalThis.__XNAPIFY_LOCALE__] : [],
  );
}
