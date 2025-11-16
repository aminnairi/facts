# @aminnairi/facts

Database agnostic implementation of the Event Sourcing design pattern

## ✨ Features

- Default memory implementation for testing & easy adoption
- SQLite implementation for persistence
- 100% TypeScript source-code & functional programming in mind
- Ready for deployment in clusters thanks to optimistic locking
- Database agnostic, can work with memory, files, SQL, NoSQL, ...
- Event Sourcing inspired to prevent data loss and enable smarted analytics
- No migration script required, evolve your data model as your project evolve

## ✋ Requirements

- [Node.js](https://nodejs.org)
- [NPM](https://npmjs.com)

## ⬇️ Installation

```bash
npm install @aminnairi/facts
```

## 💻 Usage

```typescript
import { MemoryFactStore } from "@aminnairi/facts";
import { randomUUID } from "node:crypto"

interface TodoAddedV1Fact {
  identifier: string
  name: "todo-added"
  aggregate: "todo"
  version: 1
  date: Date
  aggregateIdentifier: string
  sequence: number
  data: {
    name: string
    done: false
  }
}

interface TodoRemovedV1Fact {
  identifier: string
  name: "todo-removed"
  aggregate: "todo"
  version: 1
  date: Date
  aggregateIdentifier: string
  sequence: number
  data: {
    name: string
    done: false
  }
}

interface TodoFact =
  | TodoAddedV1Fact
  | TodoRemovedV1Fact

const factStore = new MemoryFactStore<TodoFact>()

await factStore.save({
  identifier: randomUUID(),
  name: "todo-added",
  version: 1,
  date: new Date(),
  aggregate: "todo",
  aggregateIdentifier: randomUUID(),
  sequence: 0,
  data: {
    name: "Do the dishes",
    done: false
  }
})

await factStore.save({
  identifier: randomUUID(),
  name: "todo-removed",
  version: 1,
  aggregate: "todo",
  date: new Date(),
  aggregateIdentifier: randomUUID(),
  sequence: 0,
  data: {
    name: "Do the dishes",
    done: false
  }
})
```

## ✍️ Examples

- [Fact store implemented using `node:sqlite`](./examples/sqlite/store.ts)
- [Fact store using the default RAM implementation](./examples/memory/store.ts)
- [Query implemented using RAM](./examples/memory/query.ts)

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Security

See [`SECURITY.md`](./SECURITY.md).

## License

See [`LICENSE`](./LICENSE).
