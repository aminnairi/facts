# @aminnairi/facts

[![GitHub License](https://img.shields.io/github/license/aminnairi/facts)](/LICENSE) [![NPM Version](https://img.shields.io/npm/v/%40aminnairi%2Ffacts)](https://www.npmjs.com/package/@aminnairi/facts) [![Test](https://github.com/aminnairi/facts/actions/workflows/test.yml/badge.svg?branch=production)](https://github.com/aminnairi/facts/actions/workflows/test.yml) [![Codecov (with branch)](https://img.shields.io/codecov/c/github/aminnairi/facts)](https://app.codecov.io/github/aminnairi/facts)

Database agnostic implementation of the Event Sourcing & CQRS design pattern

## 🤔 Presentation

Some businesses have a legal obligation to store data as a never-ending stream of
facts generated from application usage.

Others need to empower their analytics teams by storing every fact that has ever
happened in their application.

However, it can be challenging to model your data, especially if you are used
to relational databases.

This package was created to help you leverage the benefits of the Event
Sourcing & CQRS design patterns while reducing the friction of implementation.

## ✨ Features

- Default memory implementation for testing & easy adoption
- SQLite implementation for persistence
- 100% TypeScript source-code & functional programming in mind
- Ready for deployment in clusters thanks to optimistic locking
- Database agnostic, use files, SQL, NoSQL, IndexedDB, LocalStorage, etc...
- Event Sourcing inspired to prevent data loss and enable smarter analytics
- Query & Command implementation for CQRS applications
- Easy initialization of Queries from past events useful after application restart
- No migration script required, evolve your data model as your project evolve

## 💻 Usage

### Install the requirements

- [Node.js](https://nodejs.org)
- [NPM](https://npmjs.com)

### Install the packages

```bash
npm install tsx @aminnairi/facts zod
```

Note: `zod` is used here and in some examples for robust parsing, but it is entirely optional. You can use any parsing library or method you prefer.

### Import the package

```typescript
import {
  MemoryFactStore,
  SqliteFactStore,
  ParseError,
  FactShape,
  Query,
} from "@aminnairi/facts";
import { randomUUID } from "crypto";
import { z } from "zod";
```

### Define facts

First, define the structure of your facts using TypeScript interfaces.

```typescript
import { FactShape } from "@aminnairi/facts";

const streamIdentifier = randomUUID();

interface TodoAddedV1Fact extends FactShape {
  name: "todo-added";
  version: 1;
  streamName: "todo";
  payload: {
    name: string;
    done: boolean;
  };
}

interface TodoRemovedV1Fact extends FactShape {
  name: "todo-removed";
  version: 1;
  streamName: "todo";
  payload: null;
}

type TodoFact = TodoAddedV1Fact | TodoRemovedV1Fact;
```

### Initialize the store

You can use the in-memory store for development and testing, or the SQLite store for production.

```typescript
import { FactShape, MemoryFactStore } from "@aminnairi/facts";
import { ZodType, z } from "zod";

const factStore = new MemoryFactStore<TodoFact>();
```

### Define a query

Queries are used to build read models from your facts.

```typescript
import { Query, match } from "@aminnairi/facts";

interface Todo {
  identifier: string;
  name: string;
  done: boolean;
}

class MemoryTodosQuery implements Query<TodoFact, Todo[]> {
  public constructor(private readonly todos: Map<string, Todo> = new Map()) {}

  public async handle(fact: TodoFact): Promise<void> {
    match(fact, {
      "tood-added": (todoAddedFact) => {
        this.todos.set(fact.stream.identifier, {
          identifier: fact.stream.identifier,
          name: fact.payload.name,
          done: fact.payload.done,
        });
      },
      "todo-removed": (todoRemovedFact) => {
        this.todos.delete(fact.stream.identifier);
      },
    });
  }

  public async fetch(): Promise<Todo[]> {
    return Array.from(this.todos.values());
  }
}

const todosQuery = new MemoryTodosQuery();
```

### Define commands

```typescript
import { MemoryCommand } from "@aminnairi/facts";

const addTodoCommand = new MemoryCommand<TodoAddedV1Fact>();
const removeTodoCommand = new MemoryCommand<todoRemovedFact>();
```

### Initialize the store

```typescript
factStore.register(todosQuery);

factStore.registerCommand(addTodoCommand);
factStore.registerCommand(removeTodoCommand);

const error = await factStore.initialize();

if (error instanceof Error) {
  console.error("Failed to initialize queries:", error);
}
```

### Save facts

Save facts to the store. The `position` property is used for optimistic locking.

```typescript
await addTodoCommand.run({
  identifier: randomUUID(),
  name: "todo-added",
  version: 1,
  date: new Date(),
  stream: {
    name: "todo",
    identifier: streamIdentifier,
  },
  position: 0,
  payload: {
    name: "Do the dishes",
    done: false,
  },
});

await removeTodoCommand.run({
  identifier: randomUUID(),
  name: "todo-removed",
  version: 1,
  date: new Date(),
  stream: {
    name: "todo",
    identifier: streamIdentifier,
  },
  position: 1,
  payload: null,
});
```

### List facts

You can retrieve facts from the store using `find` and `findFromLast`.

```typescript
const result = await factStore.find((fact) => {
  fact.stream.identifier === streamIdentifier;
});

if (result instanceof Error) {
  console.error("Failed to find facts:", result);
  process.exit(1);
}

for (const fact of result) {
  console.log(fact.name, fact.payload);
}
```

### Fetch data

Fetch the read model from your query.

```typescript
const todos = await todosQuery.fetch();

for (const todo of todos) {
  console.log(todo.name);
}
```

## ✍️ Examples

- [Fact store using the provided SQLite implementation](packages/examples/sqlite/store.ts)
- [Fact store using the provided SQLite implementation with snapshotting](packages/examples/sqlite/snapshot.ts)
- [Fact store using the provided RAM implementation](packages/examples/memory/store.ts)
- [Query implemented using RAM](packages/examples/memory/query.ts)
- [Query initialization using RAM](packages/examples/memory/initialization.ts)

## API

### FactShape

This is the base interface for any fact. It defines the common properties that
every fact must have.

```typescript
interface FactShape {
  identifier: string;
  name: string;
  version: number;
  position: number;
  date: Date;
  stream: {
    name: string;
    identifier: string;
  };
  payload: unknown;
}
```

### ConcurrencyError

This is a custom error class that is thrown when there is a position conflict
when saving a fact, which is part of the optimistic locking mechanism.

```typescript
class ConcurrencyError extends Error {
  public override readonly name = "ConcurrencyError";
}
```

### UnexpectedError

This is a custom error class that is thrown for unexpected errors during fact
retrieval, usually wrapping a database or filesystem error.

```typescript
class UnexpectedError extends Error {
  public override readonly name = "UnexpectedError";

  public constructor(public readonly error: unknown) {
    super();
  }
}
```

### ParseError

This is a custom error class that is thrown when a fact cannot be parsed
correctly from the database.

```typescript
class ParseError extends Error {
  public override readonly name = "ParseError";
}
```

### FactStore

This is an interface that defines the contract for a fact store.

```typescript
interface FactStore<Fact extends FactShape> {
  save(fact: Fact): Promise<void | ConcurrencyError>;
  find(
    accept?: (fact: Fact) => boolean,
  ): Promise<Fact[] | UnexpectedError | ParseError>;
  findFromLast(
    stop: (fact: Fact) => boolean,
  ): Promise<Fact[] | UnexpectedError | ParseError>;
  register(listener: Query<Fact, unknown>): void;
  initialize(): Promise<void | ParseError | UnexpectedError>;
}
```

### Query

This interface defines the contract for a query that can handle facts and can
be used to build read models.

```typescript
interface Query<Fact extends FactShape, Data> {
  handle(fact: Fact): Promise<void>;
  fetch(): Promise<Data>;
}
```

### until

This is a utility function that takes an array and a stop condition, and
returns a new array with all the elements until the stop condition is met. It's
used by `findFromLast`.

```typescript
function until<Value>(
  values: Value[],
  stop: (value: Value) => boolean,
): Value[];
```

### match

This is a utility function that provides a way to do pattern matching on a
fact's `name` property.

```typescript
function match<Fact extends FactShape, Output>(
  fact: Fact,
  options: {
    [Key in Fact["name"]]: (fact: Extract<Fact, { name: Key }>) => Output;
  },
): Output;
```

### MemoryFactStore

Create a store for saving facts in RAM. This should not be used in a
production environment.

```typescript
class MemoryFactStore<Fact extends FactShape> implements FactStore<Fact>
```

### SqliteFactStore

Create a store for saving facts in a SQLite database. This implementation is
suitable for production environments. It is constructed using the `for` static method.

```typescript
class SqliteFactStore<Fact extends FactShape> {
  public static for<Fact extends FactShape>(
    path: string,
    options: { parser: (fact: unknown) => Fact | ParseError },
  ): SqliteFactStore<Fact>;

  public close(): void;
}
```

## Contributing

See [`CONTRIBUTING.md`](/CONTRIBUTING.md).

## Security

See [`SECURITY.md`](/SECURITY.md).

## License

See [`LICENSE`](./LICENSE).
