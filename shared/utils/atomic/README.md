# `@shared/utils/atomic` — crash-safe filesystem primitives

Every file-backed store in this repo — the cache, the queue, the broker, the
Node-RED flow splitter, the extension installer, the build manifest, `.env` —
had its own answer to "how do I write a file without corrupting it". They
disagreed, and most of them were wrong in a way that only shows up under a
crash, a full disk, or two cluster workers running at once.

This module is the single answer. It depends on nothing but `node:` builtins,
so the bundled runtime imports it as `@shared/utils/atomic/index.js` and the
raw-Node build scripts under `tools/` import it by relative path.

## The problem, concretely

```js
await fs.writeFile(configPath, JSON.stringify(config));
```

`writeFile` **truncates the target first**. Between the truncate and the last
byte, that file is empty or half-written. Anything that reads it in that window
— another worker, the next boot, an SSR request — sees garbage. If the process
dies in that window, the file _stays_ garbage.

And the read side does not catch it:

```js
try {
  return JSON.parse(await fs.readFile(p, 'utf8'));
} catch (err) {
  if (err.code === 'ENOENT') return null; // ← a SyntaxError has no `.code`
  throw err; // ← so it lands here
}
```

`JSON.parse` throws a `SyntaxError`, which carries no `code`. On Node 20 an
unhandled rejection terminates the process, so a single torn file turns into a
crash loop that survives restarts.

## The four steps

`writeFileAtomic` does write-temp → `fsync(temp)` → `chmod` → `rename` →
`fsync(dir)`. Each step buys one guarantee:

| Step          | Dropping it costs                                               |
| ------------- | --------------------------------------------------------------- |
| temp file     | a reader observes a partial write; a crash truncates the target |
| `fsync(temp)` | a power cut publishes a file whose bytes never reached disk     |
| `rename`      | — (this is the atomic swap itself)                              |
| `fsync(dir)`  | a power cut loses the rename, so the new file has no name       |
| `chmod`       | replacing a `0600` file republishes it as `0644`                |

`rename(2)` is atomic on every supported platform: a reader gets the old inode
or the new one, never a blend. That is what makes the whole thing work.

The temp file is always created **in the target's own directory**. A temp in
`os.tmpdir()` makes the rename a cross-device move (`EXDEV`) anywhere `/tmp` is
its own mount — which is most containers, including this project's.

### Why the temp name has a random component

The implementation this replaced used `` `${file}.tmp.${Date.now()}` ``. Two
writers to the same key in the same millisecond get the same temp path, write
into each other's bytes, and rename the result into place. Timestamps are not
identity. `tempSuffix()` combines pid, an in-process counter, and 4 random
bytes, so the three ways two writers can collide — different hosts, different
processes, same process — are each covered.

## Choosing `durable`

`durable: true` (the default) runs the two `fsync`s. Each is a real disk
round-trip, so this is a genuine cost, paid per write.

- **`true`** for anything whose loss is an incident: queue jobs, Node-RED flows,
  `.env`, the build manifest, extension metadata.
- **`false`** where the data is reconstructible and the write is hot: the cache
  adapter, the broker's message spool. These still get the temp file, the unique
  name and the cleanup — those defend against _concurrency_, which happens per
  request, not against _power loss_, which does not.

## API

| Function                             | Use for                                            |
| ------------------------------------ | -------------------------------------------------- |
| `writeFileAtomic(path, data, opts)`  | replace a file, crash-safely                       |
| `writeJsonAtomic(path, value, opts)` | the same, serialising first                        |
| `readFileSafe(path, opts)`           | read; missing → `fallback`, everything else throws |
| `readJsonSafe(path, opts)`           | read + parse; corruption is an explicit outcome    |
| `updateJsonAtomic(path, fn, opts)`   | **read-modify-write under a lock**                 |
| `withFileLock(path, fn, opts)`       | cross-process mutual exclusion                     |
| `sweepTemps(dir, opts)`              | delete artifacts left by a SIGKILLed writer        |
| `mapLimit(items, fn, limit)`         | bounded fs fan-out (EMFILE guard)                  |
| `resolveWithin(base, userPath)`      | confine an untrusted path to a directory           |
| `resolveWithinReal(base, userPath)`  | the same, plus a symlink-escape check              |
| `safeSegment(name)`                  | reduce an untrusted name to one path segment       |
| `ensureDir` / `fsyncDir`             | directory helpers                                  |

`*Sync` variants exist for constructor-time recovery and `process.on('exit')`
handlers. Prefer the async form everywhere else — each `fsync` blocks the loop.

### Atomic writes do not make read-modify-write safe

This is the trap worth stating outright:

```js
// STILL BROKEN, even though both writes are atomic:
const cfg = await readJsonSafe(p);
cfg.count += 1;
await writeJsonAtomic(p, cfg);
```

Two workers both read `count: 1`, both write `count: 2`. Both files are
perfectly formed. One increment is gone. Atomicity guarantees no _torn_ file; it
says nothing about _lost updates_. Use `updateJsonAtomic`, which holds a lock
across the whole cycle:

```js
await updateJsonAtomic(p, cfg => ({ ...cfg, count: cfg.count + 1 }));
```

### `path.join` is not a containment check

The single most dangerous line this module replaces:

```js
getFilePath(fileName) {
  return path.join(this.basePath, fileName); // ← serves any file on disk
}
```

`path.join('/uploads', '../../../../etc/passwd')` returns `/etc/passwd`. Wherever a name arrives from a request — a query parameter, a route param, an upload's `originalname`, an extension id out of a manifest — it has to be resolved and then _verified_:

```js
const filePath = resolveWithin(this.basePath, fileName); // throws PathEscapeError
```

`resolveWithin` uses `resolve`, not `join`, deliberately. `join` silently reinterprets an absolute input as relative (`join('/uploads', '/etc/passwd')` → `/uploads/etc/passwd`), quietly serving a different file than the caller named; `resolve` lets the absolute path win so the containment check can reject it outright. A refusal beats a surprise. It also rejects NUL bytes, which truncate the path at the syscall boundary, and the sibling-prefix case (`/uploads-evil` slipping past a bare `startsWith('/uploads')`).

`resolveWithinReal` adds a `realpath` check. Lexical containment stops being sufficient the moment something untrusted can _create_ entries in the directory — an uploaded archive, an extension package: `uploads/escape` can be a symlink to `/etc`, and `uploads/escape/passwd` is lexically impeccable.

`safeSegment` is for input that should never have been a path at all. It _reduces_ rather than rejects, which makes it the wrong tool for an identifier: reducing `../../../etc` to `etc` is safely contained but now names a different, real resource. For identifiers, check containment and refuse instead.

One sharp edge: `resolveWithin` permits the base directory itself. That is right in general, but when the resolved path is about to be deleted, compare it against the base and reject — otherwise a key of `"."` removes the entire directory.

### Corruption is a decision, not a default

`readJsonSafe` distinguishes three cases, because each deserves a different
response:

- **missing** → returns `fallback`. Routine: a fresh install, a cache miss.
- **corrupt** → `onCorrupt` decides: `'throw'` (default), `'fallback'`, or
  `'quarantine'` (moves the file to `corrupt/` and logs loudly).
- **unreadable** (`EACCES`, `EISDIR`, over `maxBytes`) → always throws.

The default is `'throw'` so that discarding data is always something a caller
opted into. `'quarantine'` never deletes: a torn write and genuine garbage look
identical from the outside, and the torn one may be the only copy of real work.

A **zero-length file counts as corrupt**, not missing. An atomic write never
publishes one, so its existence means something truncated the file.

### Locking

`withFileLock` builds on two primitives that are atomic everywhere:
`open(O_CREAT|O_EXCL)` (exactly one creator wins) and `rename` (exactly one
stealer wins). It does not use advisory locking, which behaves differently on
every network filesystem.

A holder heartbeats to keep its lock live, and _verifies it still owns it_ on
every beat — a holder that kept working after being stolen from is exactly the
double-execution the lock existed to prevent. `release()` only unlinks a lock
that still carries its own token, so it can never free someone else's.

Stealing an abandoned lock is where this gets subtle, and where an earlier
version of this module was wrong. Staleness is decided by a `stat` and acted on
by a `rename` — two syscalls — so the file behind `lockPath` can be replaced
between them, and the steal then evicts a _live_ lock and produces two
simultaneous holders. The guard is identity, not age: the inode observed at
`stat` time is compared against the inode actually moved aside, and a mismatch
means we took someone's live lock and must put it back. Restoring uses `link`
rather than `rename` for the same reason — `rename` overwrites, so restoring
that way would clobber whichever third waiter had legitimately claimed the slot,
trading one stolen lock for another.

`staleMs` must exceed your longest critical section. `heartbeatMs` is clamped to
at most `staleMs / 3`; a heartbeat slower than the stale window makes losing the
lock a certainty rather than an edge case.

```js
await withFileLock(`${target}.lock`, async signal => {
  // long work — check `signal.aborted` before writing
});
```

## Cleaning up after a SIGKILL

Every write removes its own temp on the failure path, and a `process.on('exit')`
hook removes any still in flight. Neither runs when the process is `SIGKILL`ed
or the host loses power, so long-lived directories should sweep:

```js
await sweepTemps(dataDir, { recursive: true }); // never throws
```

Age is the only safe discriminator — a live writer's temp and an abandoned one
are indistinguishable by name — so anything younger than `graceMs` (60s) is
left alone.

## Testing

`npx jest shared/utils/atomic` — 57 tests. The ones worth reading first:

- _never publishes a torn file under concurrent writers_ — 50 writers, one file
- _loses no update when many writers race_ — the lock-vs-atomicity distinction
- _preserves the permissions of the file it replaces_ — the `0600` → `0644` leak
- _refuses to delete a lock that now belongs to someone else_
