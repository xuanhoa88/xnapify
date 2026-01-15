# Contributing

## Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/rapid-rsk.git
cd rapid-rsk

# Install and run
npm install
npm run dev

# Create branch
git checkout -b feature/your-feature
```

## Development

```bash
npm run dev          # Dev server with HMR
npm run test         # Run tests
npm run lint         # Check code style
npm run fix          # Auto-fix issues
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: fix bug
docs: update documentation
refactor: refactor code
test: add tests
chore: update dependencies
```

## Pull Requests

**Before submitting:**

- Tests pass (`npm test`)
- Linting passes (`npm run lint`)
- Commit messages follow convention

**PR should include:**

- Clear title and description
- Reference to related issues
- Screenshots for UI changes

## Reporting Issues

**Bug reports should include:**

- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Node version, browser)

## License

By contributing, you agree your contributions are licensed under MIT.
