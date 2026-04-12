---
id: architecture-testing
title: Testing Architecture
sidebar_position: 10
---

# Testing Architecture

The **xnapify** platform is tested through two distinct methodologies natively: 

1. **E2E Browser Automation** (`tools/e2e` utilizing Puppeteer)
2. **Automated Unit & Integration Tests** (utilizing Jest)

---

## 1. End-to-End (E2E) Browser Testing

xnapify integrates a powerful E2E framework built around **Puppeteer**. However, xnapify abstracts raw Puppeteer scripts behind an AI-interpreting SPA Stability Engine capable of reading markdown definitions and executing UI actions autonomously.

For a deep dive into writing test cases, the LLM compilation flow, and the SPA Stability Engine, see [E2E Test Automation](/guides/11-e2e-automation).

---

## 2. Unit and Integration Tests

For granular logic verification against isolated components (Sequelize database logic, Helper utilities, Backend Services), the framework utilizes **Jest**. 

### Test Hierarchy 
Jest tests frequently live directly alongside their implemented code counterpart ending with `.test.js`:

```text
src/apps/users/api/services/
├── UserActivationService.js
└── UserActivationService.test.js
```

### Best Practices

> [!NOTE]
> **Mocking Extraneous Engines**: Since Backend logic leans heavily on the DI `container`, integration tests inside xnapify should build mock Containers passing exclusively the explicitly needed engines allowing rapid test isolation.

> [!TIP]
> **In-Memory SQLite**: When testing `models()` and their respective persistence mechanics, leverage the SQLite engine dynamically overriding connections locally to avoid deploying tests into persistent DB stores.
