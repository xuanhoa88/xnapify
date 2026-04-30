---
id: architecture-testing
title: Testing Architecture
sidebar_position: 10
---

# Testing Architecture

The **xnapify** platform is tested natively utilizing **Jest** for Automated Unit & Integration Tests.

---

## Unit and Integration Tests

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
