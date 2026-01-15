# Rapid RSK

Modern React SSR application with Express backend, Redux state management, and comprehensive tooling.

## Tech Stack

| Frontend      | Backend           | Build     |
| ------------- | ----------------- | --------- |
| React 18      | Express 4         | Webpack 5 |
| Redux Toolkit | Sequelize 6       | Babel 7   |
| react-i18next | SQLite/PostgreSQL | PostCSS   |

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.rsk .env

# Start development server
npm run dev
```

Open [http://localhost:1337](http://localhost:1337)

## Scripts

| Command          | Description                 |
| ---------------- | --------------------------- |
| `npm run dev`    | Development server with HMR |
| `npm run build`  | Production build            |
| `npm run test`   | Run tests                   |
| `npm run lint`   | Lint JS and CSS             |
| `npm run fix`    | Auto-fix linting issues     |
| `npm run format` | Format with Prettier        |

## Project Structure

```
src/
├── api/              # Express routes and Sequelize models
│   ├── engines/      # Core API infrastructure
│   └── modules/      # Feature modules (users, auth, etc.)
├── components/       # Reusable React components
├── pages/            # Page components (routes)
├── redux/            # Redux store, slices, and thunks
├── shared/           # Shared utilities (fetch, ws, navigator)
├── client.js         # Client entry point
└── server.js         # Server entry point
```

## Environment Variables

Key variables in `.env`:

```bash
# Server
RSK_PORT=1337
RSK_HOST=localhost

# Database
RSK_DATABASE_URL=sqlite:database.sqlite

# Authentication
RSK_JWT_SECRET=your-secret-key
RSK_JWT_EXPIRES_IN=1d
```

See `.env.rsk` for all available options.

## Production

```bash
# Build
npm run build

# Run from build directory
cd build
npm install --production
NODE_ENV=production node server.js
```

### Docker

```bash
docker build -t rapid-rsk .
docker run -p 1337:1337 -e NODE_ENV=production -e RSK_JWT_SECRET=secret rapid-rsk
```

## License

MIT
