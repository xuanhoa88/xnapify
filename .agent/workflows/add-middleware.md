---
description: Add an auth middleware guard to the authentication engine
---

Add a new auth middleware to `shared/api/engines/auth/middlewares/`.

## Middleware Structure

```
shared/api/engines/auth/middlewares/
├── index.js                # Barrel re-exports all middlewares
├── requireAuth.js          # Existing: JWT authentication
├── requirePermission.js    # Existing: RBAC permission check
├── requireRole.js          # Existing: Role-based guard
├── requireGroup.js         # Existing: Group membership check
├── requireOwnership.js     # Existing: Resource ownership verification
├── optionalAuth.js         # Existing: Optional JWT (sets req.user if present)
├── refreshToken.js         # Existing: Token refresh logic
└── {newMiddleware}.js      # Your new middleware
```

## Step-by-Step

### 1. Create Middleware File

```javascript
// shared/api/engines/auth/middlewares/{newMiddleware}.js

/**
 * {Description of what this middleware guards}
 *
 * @example
 * router.get('/endpoint', {newMiddleware}(options), controller.handler);
 */
export function {newMiddleware}(options) {
  return async (req, res, next) => {
    try {
      // 1. Check preconditions (req.user, req.params, etc.)
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // 2. Perform authorization check
      const allowed = await checkAuthorization(req, options);

      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // 3. Pass through
      next();
    } catch (error) {
      next(error);
    }
  };
}
```

### 2. Export from Barrel

```javascript
// shared/api/engines/auth/middlewares/index.js
// Add your export:
export * from './{newMiddleware}';
```

### 3. Write Tests

// turbo
```bash
npm run test -- middlewares
```

```javascript
import { {newMiddleware} } from '../middlewares';

describe('{newMiddleware}', () => {
  const mockReq = { user: { id: '1' } };
  const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const mockNext = jest.fn();

  it('should pass when authorized', async () => {
    const mw = {newMiddleware}(options);
    await mw(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should return 403 when not authorized', async () => {
    const mw = {newMiddleware}(options);
    await mw({ user: null }, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});
```

### 4. Run Full Suite

// turbo
```bash
npm test
```

## Conventions

- Middleware functions should be **higher-order**: return a function `(req, res, next)`.
- Always handle the `!req.user` case (authentication) before authorization.
- Use consistent HTTP status codes: `401` for unauthenticated, `403` for unauthorized.
- Export from the barrel `index.js` so it's available via `import { ... } from '@shared/api/auth/middlewares'`.
