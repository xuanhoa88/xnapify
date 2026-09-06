# Shared JWT

Standardized JSON Web Token implementation. Features core JWT creation/verification, strongly-typed tokens (access vs. refresh), and environment-based configuration factories.

## Quick Start

```javascript
import { createJwtFromEnv } from '@shared/jwt';

// Automatically loads XNAPIFY_KEY and other XNAPIFY_JWT_* env vars
const jwt = createJwtFromEnv();

// Generate an access token
const accessToken = jwt.generateTypedToken('access', { userId: 123 });

// Verify an access token (throws if expired or wrong type)
const decoded = jwt.verifyTypedToken(accessToken, 'access');
console.log(decoded.userId);

// Token pairs are NOT minted here — a pair without a `refresh_tokens` row
// cannot be revoked or rotated. Use the session service instead:
const pair = await container
  .resolve('users:sessions')
  .issueTokenPair({ id: userId }, { jwt, models });
```

## Features

- **Standard JWT**: Wrapper around `jsonwebtoken` ensuring valid signature formats and standard claims (`jti`, `iat`, `exp`, `iss`, `aud`).
- **Typed Tokens**: Built-in support for different token types (`access`, `refresh`, `reset`, `verification`) preventing a refresh token from being used as an access token.
- **Token Pairs**: Owned by `users:sessions`, not by this module — every pair is recorded in `refresh_tokens` so it stays revocable and rotatable.
- **Factory Approach**: Encapsulates the secret key inside a factory instance so it doesn't leak into business logic layers.
- **Unified Errors**: Standardized error mappings (e.g. `TokenExpiredError`, `InvalidTokenTypeError`).

## Requirements

The minimum required configuration is a secret string. Using `createJwtFromEnv()` expects the `XNAPIFY_KEY` environment variable to be set.

## Usage Guide

### Instantiation

```javascript
import { createJwt } from '@shared/jwt';

const jwt = createJwt({
  secret: 'my-super-secret-key-123456',
  expiresIn: '15m', // default
  algorithm: 'HS256', // default
  issuer: 'xnapify', // default
});
```

### Core Methods

The instantiated `jwt` object provides the following functions:

- `generateToken(payload, [options])`: Creates a raw token.
- `verifyToken(token, [options])`: Validates signature and expiration, returns payload.
- `generateTypedToken(type, payload, [options])`: Creates a token with a specific `type` claim.
- `verifyTypedToken(token, expectedType, [options])`: Validates signature and strictly enforces the the `type` claim.
- `generateTokenPair(payload, [options])` / `refreshTokenPair(refreshToken, [options])`: **throw**. They minted sessions with no `refresh_tokens` row, no `sid` and no `ver` — unrevocable and unrotatable. Use `container.resolve('users:sessions').issueTokenPair()` / `rotateTokenPair()`.

### Static Utilities

These methods are exposed statically and do not require a secret:

```javascript
import { decodeToken, isTokenExpired } from '@shared/jwt';

const { header, payload } = decodeToken(token);
const isExpired = isTokenExpired(token);
```

---

# Shared JWT — Technical Specification

## Overview

The `shared/jwt/` library is a domain-specific wrapper around `jsonwebtoken`. It enforces security best practices, typed token constraints, and provides a DI-friendly factory interface to manage the secret safely.

## Architecture

```
shared/jwt/
├── index.js        # Main exports
├── factory.js      # Factory constructors (`createJwt`, `createJwtFromEnv`)
├── core.js         # Core token generation and verification
├── typed.js        # Typed token constraints (access, refresh, reset, verification)
├── utils.js        # Time utilities, decoding logic, blacklisting helpers
├── cache.js        # Optional in-memory token state block (e.g. invalidation queues)
└── config.js       # Configuration validators
```

## The Factory Pattern (`factory.js`)

To prevent the secret key from being imported directly everywhere or stored dynamically in global scopes, `jwt` uses a factory pattern.

`createJwt(config)` closes over the `secret` within its lexical scope and returns a frozen object structure binding the secret implicitly to functions like `generateToken()` and `verifyToken()`.

## Core Logic (`core.js`)

### `generateToken(payload, secret, options)`

1. Validates `payload` (must be non-empty object) and `secret` (must be non-empty string).
2. Sets default claims automatically if missing:
   - `jti`: 16-byte random hex string.
   - `iat`: mathematical current timestamp.
3. Signs using `jsonwebtoken`.

### `verifyToken(token, secret, options)`

1. Verifies token string utilizing exact `algorithms`, `issuer`, and `audience` checks.
2. Catches `jsonwebtoken` errors and re-throws strongly-typed error objects:
   - `TokenExpiredError` (Status 401)
   - `InvalidTokenFormatError` (Status 401)
   - `TokenNotActiveError` (Status 401)

## Typed Tokens (`typed.js`)

Standard JWT does not natively distinguish between an "access token" and a "refresh token". `typed.js` introduces a mandatory `type` claim mapping internally to `JWT_TOKEN_TYPES`.

| Type           | Default Expiration | Purpose                       |
| -------------- | ------------------ | ----------------------------- |
| `access`       | 15m                | Identifies API requests       |
| `refresh`      | 7d                 | Exchanges for new token pairs |
| `reset`        | 1h                 | Password reset links          |
| `verification` | 24h                | Email verification links      |

### `generateTypedToken(type, payload, secret, options)`

Injects `type: tokenConfig.type` into the payload and overrides `expiresIn` with the typed default automatically.

### `verifyTypedToken(token, expectedType, secret, options)`

Runs `verifyToken` first, then rigorously asserts `decoded.type === expectedType`. Mismatches throw `InvalidTokenTypeError`.

### Rotation

Rotation lives in `users:sessions.rotateTokenPair()`, which verifies the token as `refresh`, re-reads the account's authorization claims from the database, retires the presented token atomically, and records the successor in the same family.
