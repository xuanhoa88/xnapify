# React Starter Kit - Source Directory (`src/`)

This directory contains the root source code and entry points for the React Starter Kit application. It orchestrates the initialization and rendering of the application on both the client and server sides.

## Directory Structure

- `apps/`: The various modular applications containing business logic, APIs, and Views (e.g., users, auth, webhooks).
- `bootstrap/`: Application initialization scripts (e.g., resolving nested Views and APIs).
- `extensions/`: Standalone extensions that can interact with the app via hooks and dependency injection.
- `benchmarks/`: Performance benchmarks for application subsystems.
- `__tests__/`: Global integration tests.

## Entry Points

- `client.js`: The React client entrypoint. Handles hydration, chunk routing, WebSocket initialization, Redux store setup, extension initialization, and browser history tracking.
- `server.js`: The Node.js server entrypoint. Sets up the Express application with rate limiting, SSR cache, locale management, Redux hydration, request routing, and the WebSocket server.
