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

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
