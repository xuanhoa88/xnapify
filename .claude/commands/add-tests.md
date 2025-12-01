Add tests to the React Starter Kit application using Jest and React Testing Library:

## Test Setup

The project already has Jest configured. Key files:

- `jest.config.js` - Jest configuration
- `src/setupTests.js` - Test setup and global mocks

## Component Testing

### 1. Basic Component Test

```javascript
// src/components/Button/Button.test.js
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(<Button className='custom'>Click me</Button>);
    expect(container.firstChild).toHaveClass('custom');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDisabled();
  });
});
```

### 2. Component with CSS Modules

```javascript
// src/routes/home/Home.test.js
import React from 'react';
import { render, screen } from '@testing-library/react';
import Home from './Home';

// Mock useAppContext
jest.mock('../../hooks/useAppContext', () => ({
  useAppContext: () => ({
    insertCss: jest.fn(() => jest.fn()),
    fetch: jest.fn(),
    pathname: '/',
  }),
}));

describe('Home', () => {
  it('renders home page', () => {
    const data = {
      reactjsGetAllNews: {
        map: [
          { title: 'News 1', link: 'http://example.com/1' },
          { title: 'News 2', link: 'http://example.com/2' },
        ],
      },
    };

    render(<Home data={data} />);
    expect(screen.getByText('News 1')).toBeInTheDocument();
    expect(screen.getByText('News 2')).toBeInTheDocument();
  });

  it('renders without data', () => {
    render(<Home />);
    // Should not crash
  });
});
```

### 3. Component with Redux

```javascript
// src/components/UserProfile/UserProfile.test.js
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import UserProfile from './UserProfile';

const mockStore = createStore(() => ({
  user: {
    id: '123',
    display_name: 'John Doe',
    email: 'john@example.com',
  },
}));

describe('UserProfile', () => {
  it('displays user information', () => {
    render(
      <Provider store={mockStore}>
        <UserProfile />
      </Provider>,
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });
});
```

### 4. Component with Hooks

```javascript
// src/components/Counter/Counter.test.js
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Counter from './Counter';

describe('Counter', () => {
  it('increments counter', () => {
    render(<Counter />);

    const button = screen.getByText('Increment');
    const count = screen.getByText(/Count: \d+/);

    expect(count).toHaveTextContent('Count: 0');

    fireEvent.click(button);
    expect(count).toHaveTextContent('Count: 1');

    fireEvent.click(button);
    expect(count).toHaveTextContent('Count: 2');
  });
});
```

### 5. Async Component

```javascript
// src/components/UserList/UserList.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import UserList from './UserList';

// Mock useAppContext
jest.mock('../../hooks/useAppContext', () => ({
  useAppContext: () => ({
    insertCss: jest.fn(() => jest.fn()),
    fetch: jest.fn(() =>
      Promise.resolve([
        { id: '1', name: 'User 1' },
        { id: '2', name: 'User 2' },
      ]),
    ),
  }),
}));

describe('UserList', () => {
  it('loads and displays users', async () => {
    render(<UserList />);

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument();
      expect(screen.getByText('User 2')).toBeInTheDocument();
    });
  });
});
```

## Route Testing

### 1. Test Route Action

```javascript
// src/routes/home/index.test.js
import route from './index';

describe('Home route', () => {
  it('has correct path', () => {
    expect(route.path).toBe('/');
  });

  it('returns component', async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        reactjsGetAllNews: { map: [] },
      }),
    );

    const result = await route.action({
      fetch: mockFetch,
      params: {},
      query: {},
    });

    expect(result).toHaveProperty('component');
    expect(result).toHaveProperty('title');
  });
});
```

## API Testing

### 1. Test Express Endpoints

```javascript
// src/server.test.js
import request from 'supertest';
import app from './server';

describe('API Endpoints', () => {
  describe('GET /api/users', () => {
    it('returns users list', async () => {
      const response = await request(app).get('/api/users').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/users', () => {
    it('creates a new user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(userData.name);
    });

    it('returns 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Protected endpoints', () => {
    it('returns 401 without token', async () => {
      await request(app).get('/api/profile').expect(401);
    });

    it('returns user profile with valid token', async () => {
      // First login to get token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password' });

      const token = loginResponse.headers['set-cookie'];

      // Then access protected endpoint
      const response = await request(app)
        .get('/api/profile')
        .set('Cookie', token)
        .expect(200);

      expect(response.body).toHaveProperty('email');
    });
  });
});
```

## Database Model Testing

### 1. Test Sequelize Models

```javascript
// src/data/models/User.test.js
import { User } from './index';
import sequelize from '../sequelize';

describe('User model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  afterEach(async () => {
    await User.destroy({ where: {}, truncate: true });
  });

  it('creates a user', async () => {
    const user = await User.create({
      email: 'test@example.com',
      display_name: 'Test User',
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.display_name).toBe('Test User');
  });

  it('validates email format', async () => {
    await expect(
      User.create({
        email: 'invalid-email',
        display_name: 'Test User',
      }),
    ).rejects.toThrow();
  });

  it('requires email', async () => {
    await expect(
      User.create({
        display_name: 'Test User',
      }),
    ).rejects.toThrow();
  });
});
```

## Utility Function Testing

### 1. Test Pure Functions

```javascript
// src/utils/format.test.js
import { formatDate, formatCurrency, slugify } from './format';

describe('Format utilities', () => {
  describe('formatDate', () => {
    it('formats date correctly', () => {
      const date = new Date('2024-01-15');
      expect(formatDate(date)).toBe('January 15, 2024');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD currency', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('handles zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('slugify', () => {
    it('converts string to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(slugify('Hello @#$ World!')).toBe('hello-world');
    });
  });
});
```

## Integration Testing

### 1. Test Full User Flow

```javascript
// src/__tests__/integration/auth.test.js
import request from 'supertest';
import app from '../../server';

describe('Authentication flow', () => {
  it('completes full auth flow', async () => {
    // 1. Register
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'password123',
        display_name: 'New User',
      })
      .expect(200);

    const token = registerResponse.headers['set-cookie'];
    expect(token).toBeDefined();

    // 2. Access protected route
    const profileResponse = await request(app)
      .get('/api/profile')
      .set('Cookie', token)
      .expect(200);

    expect(profileResponse.body.email).toBe('newuser@example.com');

    // 3. Logout
    await request(app).post('/auth/logout').set('Cookie', token).expect(200);

    // 4. Verify token is invalid
    await request(app).get('/api/profile').set('Cookie', token).expect(401);
  });
});
```

## Snapshot Testing

### 1. Component Snapshots

```javascript
// src/components/Header/Header.test.js
import React from 'react';
import { render } from '@testing-library/react';
import Header from './Header';

describe('Header', () => {
  it('matches snapshot', () => {
    const { container } = render(<Header />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

## Test Coverage

### 1. Run Tests with Coverage

```bash
# Run all tests with coverage
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

### 2. Coverage Thresholds

Already configured in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50,
  },
}
```

## Mocking

### 1. Mock Modules

```javascript
// Mock entire module
jest.mock('../../utils/api', () => ({
  fetchUsers: jest.fn(() => Promise.resolve([])),
}));

// Mock specific function
import * as api from '../../utils/api';
jest.spyOn(api, 'fetchUsers').mockResolvedValue([]);
```

### 2. Mock CSS Modules

Already configured in `jest.config.js`:

```javascript
moduleNameMapper: {
  '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
}
```

### 3. Mock Static Assets

```javascript
moduleNameMapper: {
  '\\.(jpg|jpeg|png|gif|svg)$': 'jest-transform-stub',
}
```

## Best Practices

1. **Test behavior, not implementation**
2. **Use descriptive test names**
3. **Follow AAA pattern** (Arrange, Act, Assert)
4. **Mock external dependencies**
5. **Test edge cases and error states**
6. **Keep tests isolated and independent**
7. **Use data-testid for complex queries**
8. **Avoid testing implementation details**
9. **Write tests before fixing bugs**
10. **Maintain high test coverage**

## Useful Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- Button.test.js

# Run tests matching pattern
npm test -- --testNamePattern="Button"

# Update snapshots
npm test -- --updateSnapshot

# Run tests in CI mode
npm run test:ci

# Debug tests
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Test File Organization

```
src/
├── components/
│   └── Button/
│       ├── Button.js
│       ├── Button.css
│       └── Button.test.js          # Component tests
├── routes/
│   └── home/
│       ├── index.js
│       ├── Home.js
│       ├── Home.css
│       ├── index.test.js           # Route tests
│       └── Home.test.js            # Component tests
├── utils/
│   ├── format.js
│   └── format.test.js              # Utility tests
└── __tests__/
    ├── integration/                # Integration tests
    │   └── auth.test.js
    └── e2e/                        # End-to-end tests
        └── user-flow.test.js
```
