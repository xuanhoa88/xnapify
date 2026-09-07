# `tools/atomic` — crash-safe file writes for the build toolchain

`tools/` is a **build-time package**: it launches the dev server and produces
the Plug & Play extension bundles. It runs under raw Node, before a single
dependency is guaranteed to be installed, so it depends on nothing but `node:`
builtins — no `@shared` alias, no container, no logger. That is what keeps
`tools/` standalone, and it is why this module exists inside it rather than
being imported from `shared/`.

## Relationship to `shared/utils/atomic`

The runtime has its own copy at `shared/utils/atomic`. The two are **related but
deliberately not identical**, and neither should be made a copy of the other:

|                         | `shared/utils/atomic`       | `tools/atomic`              |
| ----------------------- | --------------------------- | --------------------------- |
| Runs in                 | long-lived cluster workers  | short-lived build processes |
| Handles untrusted paths | yes (uploads, hub packages) | no (paths come from config) |
| Concurrent writers      | many, indefinitely          | a couple, briefly           |
| Exports                 | 36                          | 11                          |

What the build does **not** need, and therefore does not carry:

- **`sweepTemps`** — background reaping of temps left by a `SIGKILL`. A build
  process is short-lived and has no idle moment to run a sweep in; the
  `process.on('exit')` hook in `write.js` is the whole cleanup story here.
- **`updateJsonAtomic`** — read-modify-write under a lock. Nothing in the build
  does a read-modify-write cycle. (`jwt.js` does, and holds `withFileLock`
  across it explicitly.)
- **`resolveWithinReal` / `safeSegment`** — symlink-aware containment and name
  reduction, for input arriving from a request. The build has no such input.
- **The async `readFileSafe` / `readJsonSafe` / `writeJsonAtomic`** — the build
  reads JSON only from an rspack plugin hook and `preboot`, both synchronous.
- **The `durable`, `preserveMode`, `retries` and `maxBytes` options** — every
  caller left them at their defaults, so the defaults are now the behaviour.

## Why the safety that remains is not optional

It would be reasonable to assume a build tool can write files carelessly,
because build output is regenerable. Two of the files written through here are
not build output:

- **`.env`** — the operator's only copy. The tracked `.env.xnapify` is a
  template, and a `.env` truncated to zero length still satisfies
  `ensureEnvFile`, so nothing would ever restore it. `preboot` replaces this
  file wholesale.
- **`XNAPIFY_KEY`** — the JWT signing secret, which lives inside `.env`.

So three guarantees stay:

1. **Atomic replacement.** `writeFile` truncates the target before the first
   byte lands; an `ENOSPC` or a Ctrl-C in that window destroys the file rather
   than leaving it unchanged. Publishing by `rename` means a reader gets the old
   file or the new one, never a blend.
2. **Permission inheritance.** A temp file is created fresh and gets the process
   umask — typically 0644. Renaming it over a 0600 `.env` would _widen_ the
   secret to every account on the host. `preboot` passes no `mode` at all and
   relies entirely on this.
3. **The cross-process lock.** `npm run setup` and `preboot` both rewrite `.env`
   from a whole-file snapshot. Two of them interleaving produces two
   perfectly-formed files, the later of which silently reverts the other's keys
   — including a freshly minted `XNAPIFY_KEY`, invalidating every session signed
   with it. Atomic writes do not prevent this; only the lock does.

## API

| Function                                 | Use for                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `writeFileAtomic(path, data, opts)`      | replace a file, crash-safely                       |
| `writeFileAtomicSync(path, data, opts)`  | the same, for `preboot`'s synchronous path         |
| `writeJsonAtomicSync(path, value, opts)` | the same, serialising first                        |
| `readFileSafeSync(path, opts)`           | read; missing → `fallback`, everything else throws |
| `readJsonSafeSync(path, opts)`           | read + parse; corruption is an explicit outcome    |
| `withFileLock(path, fn, opts)`           | cross-process mutual exclusion                     |
| `mapLimit(items, fn, limit)`             | bounded fs fan-out (EMFILE guard)                  |
| `resolveWithin(base, userPath)`          | confine a derived path to a directory              |
| `ensureDir(path)`                        | `mkdir -p`, with a readable error on a file clash  |
| `tempSuffix()`                           | a collision-free temp name component               |
| `isMissingFsError(err)`                  | "the path is not there", as distinct from a fault  |

`opts` is `{ encoding, mode }` for the write functions, plus `spaces` for the
JSON one; `{ fallback }` for the reads, plus `onCorrupt` and `validate` for the
JSON one.

The export list is exactly what `tools/` imports today, and
`atomic.test.js` pins it. A stale import fails loudly at module load
("does not provide an export named ..."), never silently as `undefined` — but
adding a _consumer_ means adding its symbol to `index.js` first.

### The four steps of an atomic write

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

The temp name combines pid, an in-process counter and 4 random bytes.
Timestamps are not identity: the implementation this replaced used
`` `${file}.tmp.${Date.now()}` ``, and two writers in the same millisecond got
the same temp path, wrote into each other's bytes, and renamed the result into
place.

### Corruption is a decision, not a default

`readJsonSafeSync` distinguishes three cases:

- **missing** → returns `fallback`. Routine: a fresh checkout, a first build.
- **corrupt** → `onCorrupt` decides: `'throw'` (default) or `'fallback'`.
- **unreadable** (`EACCES`, `EISDIR`, over 64 MB) → always throws.

The default is `'throw'` so that discarding data is always something a caller
opted into. A **zero-length file counts as corrupt**, not missing: an atomic
write never publishes one, so its existence means something truncated it.

### Locking

`withFileLock` builds on two primitives that are atomic everywhere:
`open(O_CREAT|O_EXCL)` (exactly one creator wins) and `rename` (exactly one
stealer wins). It does not use advisory locking, which behaves differently on
every network filesystem.

A holder heartbeats to keep its lock live, and _verifies it still owns it_ on
every beat — a holder that kept working after being stolen from is exactly the
double-execution the lock existed to prevent. `release()` only unlinks a lock
that still carries its own token, so it can never free someone else's.

Stealing an abandoned lock is the subtle part. Staleness is decided by a `stat`
and acted on by a `rename` — two syscalls — so the file behind `lockPath` can be
replaced between them, and the steal would then evict a _live_ lock and produce
two simultaneous holders. The guard is identity, not age: the inode observed at
`stat` time is compared against the inode actually moved aside, and a mismatch
means we took someone's live lock and must put it back. Restoring uses `link`
rather than `rename` — `rename` overwrites, so restoring that way would clobber
whichever third waiter had legitimately claimed the slot.

`staleMs` must exceed your longest critical section. `heartbeatMs` is clamped to
at most `staleMs / 3`; a heartbeat slower than the stale window makes losing the
lock a certainty rather than an edge case.

```js
await withFileLock(`${envPath}.lock`, async signal => {
  // long work — check `signal.aborted` before writing
});
```

### `path.join` is not a containment check

`path.join('/data', '../../etc/passwd')` returns `/etc/passwd`. `resolveWithin`
uses `resolve`, not `join`, deliberately: `join` silently reinterprets an
absolute input as relative (`join('/data', '/etc/passwd')` → `/data/etc/passwd`),
quietly targeting a different path than the caller named; `resolve` lets the
absolute path win so the containment check can reject it outright. It also
rejects NUL bytes and the sibling-prefix case (`/data-evil` slipping past a bare
`startsWith('/data')`).

One sharp edge: `resolveWithin` permits the base directory itself. That is right
in general, but `preboot` deletes what it resolves, so it compares the result
against the base and refuses a match — otherwise a name of `"."` would remove
the whole sandbox root.
