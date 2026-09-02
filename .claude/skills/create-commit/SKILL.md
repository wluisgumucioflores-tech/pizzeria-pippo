---
name: create-commit
description: Analyze staged changes, generate a Conventional Commit message, configure the Git author, create the commit, and report the result.
---

# Create Commit

## Goal

Create a high-quality Git commit based on the staged changes.

Never push to any remote repository.

---

## Git Author

Always configure the repository author before committing.

```bash
git config user.name "Luis Gumucio"
git config user.email "luisgumucioflores@gmail.com"
```

Do not modify the global Git configuration.

---

## Analyze Changes

Before creating the commit:

1. Check repository status.

```bash
git status
```

2. Review staged files.

```bash
git diff --cached --stat
git diff --cached
```

Understand:

- Why the change exists.
- Which feature or bug it belongs to.
- Whether unrelated changes are mixed together.

---

## Validate

If unrelated changes are detected:

- Explain why.
- Suggest splitting them into multiple commits.
- Do not create the commit until confirmed.

---

## Commit Message Rules

Follow Conventional Commits.

Possible types:

- feat
- fix
- refactor
- docs
- style
- test
- chore
- perf
- ci
- build

Format:

type(scope): short description

Examples:

feat(auth): add refresh token support

fix(pos): prevent duplicate payment

refactor(order): simplify validation

docs(api): update endpoint examples

---

## Commit Body

When appropriate, include:

Why this change was made.

Important implementation details.

Breaking changes.

---

## Create Commit

Execute:

```bash
git commit -m "<generated message>"
```

If a body exists:

```bash
git commit \
  -m "<title>" \
  -m "<body>"
```

---

## Result

After committing:

Show:

- Commit hash
- Commit message
- Files included

Example:

Commit created successfully

Hash:
4af91cd

Message:
feat(payment): add QR payment flow

Files:
- PaymentService.java
- PaymentController.java
- payment.ts

---

## Never

Never execute:

git push

git push --force

git reset --hard

git clean -fd

unless explicitly requested by the user.