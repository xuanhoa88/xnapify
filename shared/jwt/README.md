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

// Generate a pair
const pair = jwt.generateTokenPair({ userId: 123 });
console.log(pair.accessToken, pair.refreshToken);
```

## Features

- **Standard JWT**: Wrapper around `jsonwebtoken` ensuring valid signature formats and standard claims (`jti`, `iat`, `exp`, `iss`, `aud`).
- **Typed Tokens**: Built-in support for different token types (`access`, `refresh`, `reset`, `verification`) preventing a refresh token from being used as an access token.
- **Token Pairs**: High-level helpers to generate and rotate Access/Refresh token pairs.
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
- `generateTokenPair(payload, [options])`: Returns `{ accessToken, refreshToken }`.
- `refreshTokenPair(refreshToken, [options])`: Verifies a refresh token and issues a new pair.

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

### `refreshTokenPair(refreshToken, secret)`

1. Verifies the provided token as `refresh` type.
2. Strips standard JWT claims (`iat`, `exp`, `jti`, `type`, `aud`, `iss`) from the payload.
3. Generates a fresh `accessToken` and `refreshToken` pair holding the exact same business schema payload as the original.
