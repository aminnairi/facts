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
- Query implementation for CQRS applications
- Easy initialization of Queries from past events useful after application restart
- No migration script required, evolve your data model as your project evolve

## 💻 Usage

### Install the requirements

- [Node.js](https://nodejs.org)
- [NPM](https://npmjs.com)

### Install the packages

```bash
npm install tsx @aminnairi/facts
```

### Create the source file

```bash
touch index.ts
```

### Define facts

First, define the structure of your facts using TypeScript interfaces.

```typescript
import { FactShape } from "@aminnairi/facts";

interface TodoAddedV1Fact extends FactShape {
  name: "todo-added";
  version: 1;
  streamName: "todo";
  streamIdentifier: string;
  payload: {
    name: string;
    done: boolean;
  };
}

interface TodoRemovedV1Fact extends FactShape {
  name: "todo-removed";
  version: 1;
  streamName: "todo";
  streamIdentifier: string;
  payload: null;
}

type TodoFact = TodoAddedV1Fact | TodoRemovedV1Fact;
```

### Initialize the store

You can use the in-memory store for development and testing, or the SQLite store for production.

```typescript
import { FactShape, MemoryFactStore } from "@aminnairi/facts";

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

class MemoryTodosQuery implements Query<TodoFact> {
  public constructor(private readonly todos: Map<string, Todo> = new Map()) {}

  public async handle(fact: TodoFact): Promise<void> {
    match(fact, {
      "todo-added": (todoAddedFact) => {
        this.todos.set(todoAddedFact.streamIdentifier, {
          identifier: todoAddedFact.streamIdentifier,
          name: todoAddedFact.payload.name,
          done: todoAddedFact.payload.done,
        });
      },
      "todo-removed": (todoRemovedFact) => {
        this.todos.delete(todoRemovedFact.streamIdentifier);
      },
    });
  }

  public async getTodos(): Promise<Todo[]> {
    return Array.from(this.todos.values());
  }
}

const todosQuery = new MemoryTodosQuery();
```

### Register queries

```typescript
factStore.registerQuery(todosQuery);

const error = await factStore.initialize();

if (error instanceof Error) {
  console.error("Failed to initialize queries:", error);
}
```

### Save facts

Save facts to the store using the adapter pattern. The `position` property is used for optimistic locking.

```typescript
import { randomUUID } from "crypto";

const streamIdentifier = randomUUID();

await factStore.save({
  identifier: randomUUID(),
  name: "todo-added",
  version: 1,
  date: new Date(),
  streamName: "todo",
  streamIdentifier: streamIdentifier,
  position: 0,
  payload: {
    name: "Do the dishes",
    done: false,
  },
});

await factStore.save({
  identifier: randomUUID(),
  name: "todo-removed",
  version: 1,
  date: new Date(),
  streamName: "todo",
  streamIdentifier: streamIdentifier,
  position: 1,
  payload: null,
});
```

### List facts

You can retrieve facts from the store using `find` and `findFromLast`.

```typescript
const result = await factStore.find((fact) => {
  return fact.streamIdentifier === streamIdentifier;
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

Fetch the read model from your query using your custom method.

```typescript
const todos = await todosQuery.getTodos();

for (const todo of todos) {
  console.log(todo.name);
}
```

### Commands

The `FactStore` acts as the Command side in CQRS. Define your commands as classes that depend on the store using the adapter pattern:

```typescript
class AddTodoCommand {
  constructor(private readonly store: FactStore<TodoFact>) {}

  async execute(name: string, done: boolean) {
    await this.store.save({
      identifier: randomUUID(),
      name: "todo-added",
      version: 1,
      date: new Date(),
      streamName: "todo",
      streamIdentifier: randomUUID(),
      position: 0,
      payload: { name, done },
    });
  }
}

const addTodoCommand = new AddTodoCommand(factStore);
await addTodoCommand.execute("Buy milk", false);
```

This approach makes your commands testable by allowing dependency injection.

## Run the script

```bash
npx tsx index.ts
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
  streamName: string;
  streamIdentifier: string;
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

### QueryInitializeError

This is a custom error class that is thrown when the query's `initialize` method
fails.

```typescript
class QueryInitializeError extends Error {
  public override readonly name = "QueryInitializeError";
}
```

### FactStore

This is an interface that defines the contract for a fact store.

```typescript
interface FactStore<Fact extends FactShape> {
  save(fact: Fact): Promise<void | ConcurrencyError>;
  find<DiscriminatedFact extends Fact>(
    accept: (fact: Fact) => fact is DiscriminatedFact,
  ): Promise<DiscriminatedFact[] | UnexpectedError | ParseError>;
  find(
    accept?: (fact: Fact) => boolean,
  ): Promise<Fact[] | UnexpectedError | ParseError>;
  findFromLast<DiscriminatedFact extends Fact>(
    stop: (fact: Fact) => fact is DiscriminatedFact,
  ): Promise<DiscriminatedFact[] | UnexpectedError | ParseError>;
  findFromLast(
    stop: (fact: Fact) => boolean,
  ): Promise<Fact[] | UnexpectedError | ParseError>;
  registerQuery(listener: Query<Fact>): void;
  initialize(): Promise<void | ParseError | UnexpectedError | QueryInitializeError>;
}
```

When calling `store.initialize()`, the `initialize` method of each registered query will be called.
This allows queries to set up their data model (e.g., create tables in SQLite).

### Query

This interface defines the contract for a query that can handle facts and can
be used to build read models.

```typescript
interface Query<Fact extends FactShape> {
  handle(fact: Fact): Promise<void>;
  initialize?: () => Promise<void | QueryInitializeError>;
}
```

The `initialize` method is optional and is called once when `store.initialize()` is called.
This is useful for databases like SQLite or PostgreSQL that need to create tables or
set up the data model before handling facts. It is not necessary for in-memory queries.

Define your own method to fetch data from your query:

```typescript
class MyQuery implements Query<MyFact> {
  async getData(): Promise<MyData> {
    // your implementation
  }
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
function match<Output, Fact extends FactShape>(
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
