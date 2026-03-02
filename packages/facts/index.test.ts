import { test, expect, vi } from "vitest"
import { ConcurrencyError, type FactShape, match, MemoryCommand, MemoryFactStore, ParseError, QueryInitializeError, type Query, SqliteFactStore, UnexpectedError, until } from "."
import { randomUUID } from "crypto"
import { z, ZodType } from "zod"
import { rm } from "node:fs/promises"

const userCreatedV1FactSchema = z.object({
  identifier: z.string(),
  name: z.literal("user-created"),
  version: z.literal(1),
  date: z.coerce.date(),
  position: z.number(),
  streamName: z.literal("user"),
  streamIdentifier: z.string(),
  payload: z.object({
    email: z.string(),
    password: z.string()
  })
}) satisfies ZodType<FactShape>

const userDeletedV1FactSchema = z.object({
  identifier: z.string(),
  name: z.literal("user-deleted"),
  version: z.literal(1),
  date: z.coerce.date(),
  position: z.number(),
  streamName: z.literal("user"),
  streamIdentifier: z.string(),
  payload: z.null()
}) satisfies ZodType<FactShape>

const userSnapshotV1FactSchema = z.object({
  identifier: z.string(),
  name: z.literal("user-snapshot"),
  date: z.coerce.date(),
  version: z.literal(1),
  position: z.number(),
  streamName: z.literal("user"),
  streamIdentifier: z.string(),
  payload: z.object({
    email: z.string(),
    password: z.string()
  })
})

const userFactSchema = z.union([
  userSnapshotV1FactSchema,
  userCreatedV1FactSchema,
  userDeletedV1FactSchema
])

const zodParser = (fact: unknown): UserFact | ParseError => {
  const result = userFactSchema.safeParse(fact)
  if (result.success) {
    return result.data as UserFact
  }
  return new ParseError("Invalid fact shape", result.error);
};

type UserCreatedV1Fact = z.infer<typeof userCreatedV1FactSchema>

type UserDeletedV1Fact = z.infer<typeof userDeletedV1FactSchema>

type UserFact = z.infer<typeof userFactSchema>

interface UserWithEmail {
  email: string
}

class MemoryUsersWithEmailQuery implements Query<UserFact, UserWithEmail[]> {
  public constructor(private readonly usersWithEmail: Map<string, UserWithEmail> = new Map()) { }

  public async handle(fact: UserFact): Promise<void> {
    if (fact.name === "user-created") {
      this.usersWithEmail.set(fact.streamIdentifier, {
        email: fact.payload.email
      })

      return
    }

    this.usersWithEmail.delete(fact.streamIdentifier)
  }

  public async fetch(): Promise<UserWithEmail[]> {
    return Array.from(this.usersWithEmail.values())
  }
}

test("It should return all elements until another one", () => {
  expect(until([], value => value >= 3)).toStrictEqual([])
  expect(until([1, 2, 3, 4, 5], value => value >= 3)).toStrictEqual([1, 2, 3])
})

test("It should create an UnexpectedError", () => {
  const error = new UnexpectedError(new Error("Something went wrong"))

  expect(error.name).toStrictEqual("UnexpectedError")
  expect(error.error).toBeInstanceOf(Error)
})

test("It should create a ParseError", () => {
  const error = new ParseError("Because reasons")

  expect(error.name).toStrictEqual("ParseError")
  expect(error.message).toStrictEqual("Because reasons")
})

test("", async () => {
  const factStore = new MemoryFactStore<UserCreatedV1Fact>
  const factIdentifier = randomUUID()
  const streamIdentifier = randomUUID()

  await factStore.save({
    identifier: factIdentifier,
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "email@domain.com",
      password: "supersecret"
    }
  })

  const facts = await factStore.find()

  expect(facts).toStrictEqual([
    {
      identifier: factIdentifier,
      name: "user-created",
      position: 0,
      version: 1,
      date: new Date("2025-01-01"),
      streamName: "user",
      streamIdentifier: streamIdentifier,
      payload: {
        email: "email@domain.com",
        password: "supersecret"
      }
    }
  ])
})

test("It should return one event among many others", async () => {
  const factStore = new MemoryFactStore<UserFact>
  const factIdentifier = randomUUID()

  const firstUser = {
    identifier: randomUUID()
  }

  const secondUser = {
    identifier: randomUUID()
  }

  await factStore.save({
    identifier: factIdentifier,
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: firstUser.identifier,
    payload: {
      email: "first@domain.com",
      password: "supersecret"
    }
  })

  await factStore.save({
    identifier: factIdentifier,
    name: "user-created",
    position: 1,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: secondUser.identifier,
    payload: {
      email: "second@domain.com",
      password: "anotherpass"
    }
  })

  const facts = await factStore.find(fact => {
    return fact.streamIdentifier === firstUser.identifier
  })

  expect(facts).toStrictEqual([
    {
      identifier: factIdentifier,
      name: "user-created",
      position: 0,
      version: 1,
      date: new Date("2025-01-01"),
      streamName: "user",
      streamIdentifier: firstUser.identifier,
      payload: {
        email: "first@domain.com",
        password: "supersecret"
      }
    }
  ])
})

test("It should return all events from a snpashot only", async () => {
  const factStore = new MemoryFactStore<UserFact>
  const snapshotIdentifier = randomUUID()
  const snapshotStreamIdentifier = randomUUID()
  const identifier = randomUUID()
  const streamIdentifier = randomUUID()

  await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: randomUUID(),
    payload: {
      email: "first@domain.com",
      password: "supersecret"
    }
  })

  await factStore.save({
    identifier: snapshotIdentifier,
    name: "user-snapshot",
    position: 0,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: snapshotStreamIdentifier,
    payload: {
      email: "first@domain.com",
      password: "supersecret"
    }
  })

  await factStore.save({
    identifier,
    name: "user-created",
    position: 0,
    version: 1,
    streamName: "user",
    streamIdentifier: streamIdentifier,
    date: new Date("2025-01-01"),
    payload: {
      email: "second@domain.com",
      password: "anotherpass"
    }
  })

  const facts = await factStore.findFromLast(fact => {
    return fact.name === "user-snapshot"
  })

  expect(facts).toStrictEqual([
    {
      identifier: snapshotIdentifier,
      name: "user-snapshot",
      position: 0,
      version: 1,
      streamName: "user",
      streamIdentifier: snapshotStreamIdentifier,
      date: new Date("2025-01-01"),
      payload: {
        email: "first@domain.com",
        password: "supersecret"
      }
    },
    {
      identifier,
      name: "user-created",
      position: 0,
      version: 1,
      streamName: "user",
      streamIdentifier: streamIdentifier,
      date: new Date("2025-01-01"),
      payload: {
        email: "second@domain.com",
        password: "anotherpass"
      }
    }
  ])
})

test("It should return a concurrency error if two similar events are added", async () => {
  const factStore = new MemoryFactStore<UserFact>
  const identifier = randomUUID()
  const streamIdentifier = randomUUID()


  const firstError = await factStore.save({
    identifier,
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date(),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "first@domain.com",
      password: "supersecret"
    }
  })

  const secondError = await factStore.save({
    identifier,
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date(),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "second@domain.com",
      password: "anotherpass"
    }
  })

  expect(firstError).toBeUndefined()
  expect(secondError).toBeInstanceOf(ConcurrencyError)
})

test("It should trigger the listen function for queries", async () => {
  const factStore = new MemoryFactStore<UserFact>
  const usersWithEmailQuery = new MemoryUsersWithEmailQuery
  const streamIdentifier = randomUUID()
  const identifier = randomUUID()

  factStore.registerQuery(usersWithEmailQuery)

  await factStore.save({
    streamName: "user",
    streamIdentifier: streamIdentifier,
    identifier,
    position: 0,
    date: new Date(),
    name: "user-created",
    version: 1,
    payload: {
      email: "email@domain.com",
      password: "nothingtoseehere"
    }
  })

  const users = await usersWithEmailQuery.fetch()

  expect(users).toStrictEqual([
    {
      email: "email@domain.com"
    }
  ])
})

test("It should match the correct fact", () => {
  const streamIdentifier = randomUUID()
  const identifier = randomUUID()

  const fact = {
    streamName: "user",
    streamIdentifier: streamIdentifier,
    identifier,
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date("2025-01-01"),
    payload: {
      email: "first@domain.com",
      password: "password"
    }
  } as UserFact

  const output = match(fact, {
    "user-created": () => {
      return true
    },
    "user-deleted": () => {
      return false
    },
    "user-snapshot": () => {
      return false
    }
  })

  expect(output).toStrictEqual(true)
})

test("It should work with the SQLite implementation", async () => {
  const factStore = SqliteFactStore.for(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  const identifier = randomUUID()
  const streamIdentifier = randomUUID()
  const query = new MemoryUsersWithEmailQuery()

  factStore.registerQuery(query)

  let error = await factStore.save({
    identifier,
    name: "user-created",
    position: 0,
    version: 1,
    streamName: "user",
    streamIdentifier: streamIdentifier,
    date: new Date("2025-01-01"),
    payload: {
      email: "user@domain.com",
      password: "password"
    }
  })

  expect(error).toBeUndefined()

  error = await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 0,
    version: 1,
    streamName: "user",
    streamIdentifier: streamIdentifier,
    date: new Date(),
    payload: {
      email: "user@domain.com",
      password: "password"
    }
  })

  expect(error).toBeInstanceOf(ConcurrencyError)

  const output = await query.fetch()

  expect(output).toStrictEqual([
    {
      email: "user@domain.com"
    }
  ])

  const facts = await factStore.find()

  expect(facts).toStrictEqual([
    {
      identifier,
      name: "user-created",
      position: 0,
      version: 1,
      streamName: "user",
      streamIdentifier: streamIdentifier,
      date: new Date("2025-01-01"),
      payload: {
        email: "user@domain.com",
        password: "password"
      }
    }
  ])

  const noFacts = await factStore.find(() => false);
  expect(noFacts).toStrictEqual([]);

  const snapshotIdentifier = randomUUID()
  const snapshotStreamIdentifier = randomUUID()

  await factStore.save({
    identifier: snapshotIdentifier,
    name: "user-snapshot",
    position: 0,
    version: 1,
    streamName: "user",
    streamIdentifier: snapshotStreamIdentifier,
    date: new Date("2025-01-01"),
    payload: {
      email: "user@domain.com",
      password: "password"
    }
  })

  const anotherIdentifier = randomUUID()
  const anotherStreamIdentifier = randomUUID()

  await factStore.save({
    identifier: anotherIdentifier,
    name: "user-created",
    position: 0,
    version: 1,
    streamName: "user",
    streamIdentifier: anotherStreamIdentifier,
    date: new Date("2025-01-01"),
    payload: {
      email: "another@domain.com",
      password: "pass"
    }
  })

  const factsWithSnapshot = await factStore.findFromLast(fact => {
    return fact.name === "user-snapshot"
  })

  expect(factsWithSnapshot).toStrictEqual([
    {
      identifier: snapshotIdentifier,
      name: "user-snapshot",
      position: 0,
      version: 1,
      streamName: "user",
      streamIdentifier: snapshotStreamIdentifier,
      date: new Date("2025-01-01"),
      payload: {
        email: "user@domain.com",
        password: "password"
      }
    },
    {
      identifier: anotherIdentifier,
      name: "user-created",
      position: 0,
      version: 1,
      streamName: "user",
      streamIdentifier: anotherStreamIdentifier,
      date: new Date("2025-01-01"),
      payload: {
        email: "another@domain.com",
        password: "pass"
      }
    }
  ])

  factStore.close()
})

test("It should initialize the store correctly", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  const query = new MemoryUsersWithEmailQuery()

  const streamIdentifier = randomUUID()
  const identifier = randomUUID()

  await factStore.save({
    identifier,
    name: "user-created",
    position: 0,
    version: 1,
    streamName: "user",
    streamIdentifier: streamIdentifier,
    date: new Date("2025-01-01"),
    payload: {
      email: "init@domain.com",
      password: "password"
    }
  })

  factStore.registerQuery(query)

  await factStore.initialize()

  const users = await query.fetch()

  expect(users).toStrictEqual([
    {
      email: "init@domain.com"
    }
  ])

  factStore.close()
})

test("It should throw an error when using a closed store", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  factStore.close()

  const error = await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 0,
    version: 1,
    streamName: "user",
    streamIdentifier: randomUUID(),
    date: new Date(),
    payload: {
      email: "test@domain.com",
      password: "password"
    }
  })

  expect(error).toBeInstanceOf(Error)
})

test("It should be running as usual even if all migrations have been played", async () => {
  const factStore = SqliteFactStore.for<UserFact>("test.sqlite", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  factStore.close()

  const factStore2 = SqliteFactStore.for<UserFact>("test.sqlite", {
    parser: zodParser
  })

  if (factStore2 instanceof Error) {
    throw factStore2
  }

  await rm("test.sqlite")
})

test("It should initialize the memory store correctly", async () => {
  const factStore = new MemoryFactStore<UserFact>()
  const query = new MemoryUsersWithEmailQuery()
  const streamIdentifier = randomUUID()
  const identifier = randomUUID()

  await factStore.save({
    identifier,
    name: "user-created",
    position: 0,
    version: 1,
    streamName: "user",
    streamIdentifier: streamIdentifier,
    date: new Date("2025-01-01"),
    payload: {
      email: "init@domain.com",
      password: "password"
    }
  })

  factStore.registerQuery(query)

  await factStore.initialize()

  const users = await query.fetch()

  expect(users).toStrictEqual([
    {
      email: "init@domain.com"
    }
  ])
})

// TODO: generated by gemini, to review
test("It should return a ParseError when finding a malformed fact", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  // @ts-expect-error
  const db = factStore.database;
  db.exec(`INSERT INTO facts(identifier, stream_name, stream_identifier, position, fact) VALUES('id', 'user', 'sid', 0, '{"invalid":"json"}')`);

  const error = await factStore.find();

  expect(error).toBeInstanceOf(ParseError);

  factStore.close()
});

// TODO: generated by gemini, to review
test("It should return an UnexpectedError when find is called on a closed store", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  factStore.close()

  const error = await factStore.find();
  expect(error).toBeInstanceOf(UnexpectedError);
});

// TODO: generated by gemini, to review
test("It should return a ParseError when finding from last a malformed fact", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  // @ts-expect-error
  const db = factStore.database;
  db.exec(`INSERT INTO facts(identifier, stream_name, stream_identifier, position, fact) VALUES('id', 'user', 'sid', 0, '{"invalid":"json"}')`);

  const error = await factStore.findFromLast(() => false);
  expect(error).toBeInstanceOf(ParseError);

  factStore.close()
});

// TODO: generated by gemini, to review
test("It should return an UnexpectedError when findFromLast is called on a closed store", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  factStore.close()

  const error = await factStore.findFromLast(() => false);
  expect(error).toBeInstanceOf(UnexpectedError);
});

// TODO: generated by gemini, to review
test("It should return an UnexpectedError when initialize is called on a closed store", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  factStore.close()

  const error = await factStore.initialize();
  expect(error).toBeInstanceOf(UnexpectedError);
});

// TODO: generated by gemini, to review
test("It should return a concurrency error for sqlite", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  });

  if (factStore instanceof Error) {
    throw factStore;
  }

  const streamIdentifier = randomUUID();

  await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date(),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "first@domain.com",
      password: "supersecret"
    }
  });

  const error = await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date(),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "second@domain.com",
      password: "anotherpass"
    }
  });

  expect(error).toBeInstanceOf(ConcurrencyError);

  factStore.close();
});

// TODO: generated by gemini, to review
test("It should return a ParseError when initializing with a malformed fact", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  // @ts-expect-error
  const db = factStore.database;
  db.exec(`INSERT INTO facts(identifier, stream_name, stream_identifier, position, fact) VALUES('id', 'user', 'sid', 0, '{"invalid":"json"}')`);

  const error = await factStore.initialize();
  expect(error).toBeInstanceOf(ParseError);

  factStore.close()
});

test("It should create a command correctly", () => {
  const command = new MemoryCommand<UserCreatedV1Fact>

  expect(command).toBeInstanceOf(MemoryCommand)
})

test("It should create a command with listeners correctly", async () => {
  const command = new MemoryCommand<UserCreatedV1Fact>
  const callback = vi.fn()

  command.listen(callback)

  const identifier = randomUUID()
  const date = new Date()
  const name = "user-created"
  const streamName = "user"
  const streamIdentifier = randomUUID()
  const position = 0
  const version = 1
  const payload = {
    email: "user@example.com",
    password: "pass123"
  }

  const error = await command.send({
    identifier,
    date,
    name,
    payload,
    position,
    version,
    streamIdentifier,
    streamName
  })

  expect(callback).toHaveBeenCalledWith({
    identifier,
    date,
    name,
    payload,
    position,
    version,
    streamIdentifier,
    streamName
  })

  expect(error).toBeUndefined()
})

test("It should create a command with listeners correctly", async () => {
  const command = new MemoryCommand<UserCreatedV1Fact>
  const callback = vi.fn(async () => new ConcurrencyError)

  command.listen(callback)

  const identifier = randomUUID()
  const date = new Date()
  const name = "user-created"
  const streamName = "user"
  const streamIdentifier = randomUUID()
  const position = 0
  const version = 1
  const payload = {
    email: "user@example.com",
    password: "pass123"
  }

  const error = await command.send({
    identifier,
    date,
    name,
    payload,
    position,
    version,
    streamIdentifier,
    streamName
  })

  expect(callback).toHaveBeenCalledWith({
    identifier,
    date,
    name,
    payload,
    position,
    version,
    streamIdentifier,
    streamName
  })

  expect(error).toBeInstanceOf(ConcurrencyError)
})

test("registerCommand should work as expected for the in memory fact store", async () => {
  const factStore = new MemoryFactStore<UserFact>
  const createUserCommand = new MemoryCommand<UserCreatedV1Fact>

  factStore.registerCommand(createUserCommand)

  const identifier = randomUUID()
  const date = new Date()
  const streamIdentifier = randomUUID()

  const error = await createUserCommand.send({
    date,
    identifier,
    name: "user-created",
    position: 0,
    streamIdentifier,
    streamName: "user",
    version: 1,
    payload: {
      email: "email@domain.com",
      password: "pass123"
    }
  })

  const facts = await factStore.find()

  expect(error).toBeUndefined()

  expect(facts).toStrictEqual([
    {
      date,
      identifier,
      name: "user-created",
      position: 0,
      streamIdentifier,
      streamName: "user",
      version: 1,
      payload: {
        email: "email@domain.com",
        password: "pass123"
      }
    }
  ])
})


test("It should return a QueryInitializeError when initialize throws", async () => {
  const factStore = new MemoryFactStore<UserFact>()
  const queryWithInitialize: Query<UserFact, unknown> = {
    handle: async () => {},
    fetch: async () => ({}),
    initialize: () => {
      throw new Error("Initialization failed")
    }
  }

  const result = await factStore.registerQuery(queryWithInitialize)

  expect(result).toBeInstanceOf(QueryInitializeError)
})

test("It should return a QueryInitializeError when initialize returns an error", async () => {
  const factStore = new MemoryFactStore<UserFact>()
  const queryWithInitialize: Query<UserFact, unknown> = {
    handle: async () => {},
    fetch: async () => ({}),
    initialize: async () => {
      return new QueryInitializeError("Initialization failed")
    }
  }

  const result = await factStore.registerQuery(queryWithInitialize)

  expect(result).toBeInstanceOf(QueryInitializeError)
})

test("It should find with discriminated fact type predicate", async () => {
  const factStore = new MemoryFactStore<UserFact>()
  const streamIdentifier = randomUUID()

  await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "email@domain.com",
      password: "password"
    }
  })

  await factStore.save({
    identifier: randomUUID(),
    name: "user-deleted",
    position: 1,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: null
  })

  const facts = await factStore.find((fact): fact is UserCreatedV1Fact => {
    return fact.name === "user-created"
  }) as UserCreatedV1Fact[]

  expect(facts).toHaveLength(1)
  expect(facts[0].name).toStrictEqual("user-created")
})

test("It should find from last with discriminated fact type predicate", async () => {
  const factStore = new MemoryFactStore<UserFact>()
  const streamIdentifier = randomUUID()

  await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "email@domain.com",
      password: "password"
    }
  })

  await factStore.save({
    identifier: randomUUID(),
    name: "user-deleted",
    position: 1,
    version: 1,
    date: new Date("2025-01-02"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: null
  })

  await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 2,
    version: 1,
    date: new Date("2025-01-03"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "another@domain.com",
      password: "password"
    }
  })

  const facts = await factStore.findFromLast((fact): fact is UserDeletedV1Fact => {
    return fact.name === "user-deleted"
  })

  expect(facts).toHaveLength(2)
  expect(facts[0].name).toStrictEqual("user-deleted")
  expect(facts[1].name).toStrictEqual("user-created")
})

test("It should find with discriminated fact type predicate in SQLite", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  const streamIdentifier = randomUUID()

  await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "email@domain.com",
      password: "password"
    }
  })

  await factStore.save({
    identifier: randomUUID(),
    name: "user-deleted",
    position: 1,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: null
  })

  const facts = await factStore.find((fact): fact is UserCreatedV1Fact => {
    return fact.name === "user-created"
  }) as UserCreatedV1Fact[]

  expect(facts).toHaveLength(1)
  expect(facts[0].name).toStrictEqual("user-created")

  factStore.close()
})

test("It should find from last with discriminated fact type predicate in SQLite", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  if (factStore instanceof Error) {
    throw factStore
  }

  const streamIdentifier = randomUUID()

  await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date("2025-01-01"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "email@domain.com",
      password: "password"
    }
  })

  await factStore.save({
    identifier: randomUUID(),
    name: "user-deleted",
    position: 1,
    version: 1,
    date: new Date("2025-01-02"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: null
  })

  await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 2,
    version: 1,
    date: new Date("2025-01-03"),
    streamName: "user",
    streamIdentifier: streamIdentifier,
    payload: {
      email: "another@domain.com",
      password: "password"
    }
  })

  const facts = await factStore.findFromLast((fact): fact is UserDeletedV1Fact => {
    return fact.name === "user-deleted"
  }) as UserDeletedV1Fact[]

  expect(facts).toHaveLength(2)
  expect(facts[0].name).toStrictEqual("user-deleted")
  expect(facts[1].name).toStrictEqual("user-created")

  factStore.close()
})

test("registerCommand should work as expected for the sqlite fact store", async () => {
  const factStore = SqliteFactStore.for<UserFact>(":memory:", {
    parser: zodParser
  })

  const createUserCommand = new MemoryCommand<UserCreatedV1Fact>

  factStore.registerCommand(createUserCommand)

  const identifier = randomUUID()
  const date = new Date()
  const streamIdentifier = randomUUID()

  const error = await createUserCommand.send({
    date,
    identifier,
    name: "user-created",
    position: 0,
    streamIdentifier,
    streamName: "user",
    version: 1,
    payload: {
      email: "email@domain.com",
      password: "pass123"
    }
  })

  const facts = await factStore.find()

  expect(error).toBeUndefined()

  expect(facts).toStrictEqual([
    {
      date,
      identifier,
      name: "user-created",
      position: 0,
      streamIdentifier,
      streamName: "user",
      version: 1,
      payload: {
        email: "email@domain.com",
        password: "pass123"
      }
    }
  ])
})
