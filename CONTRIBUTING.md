# Contributing

## Requirements

- [Bash](https://www.gnu.org/software/bash/)
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org)
- [NPM](https://npmjs.com)

## Clone

> [!NOTE]
> This command needs to be run inside of a terminal, Bash is recommended as for
> the shell to execute your commands.

```bash
git clone https://github.com/aminnairi/facts
cd facts
```

> [!WARNING]
> If you forked the project, you'll need to replace the URL with the URL
> pointing to your own fork of this project.

## Installation

```bash
npm install
```

> [!TIP]
> This needs to be run only if you cloned the project or pulled updates.

## Test

```bash
npm test
```

> [!INFO]
> Tests are located in the [`./index.test.ts`](./index.test.ts) file.

## Example

```bash
npx tsx examples/memory/store.ts
```

> [!NOTE]
> Replace `examples/memory/store.ts` with the path of the file to run.
