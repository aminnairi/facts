import { test, expect } from "vitest"
import { ConcurrencyError, match, MemoryFactStore, Query, SqliteFactStore, until } from "."
import { randomUUID } from "crypto"

interface UserCreatedV1Fact {
  identifier: string
  name: "user-created"
  version: 1
  date: Date
  position: number
  stream: {
    name: "user"
    identifier: string
  }
  payload: {
    email: string
    password: string
  }
}

interface UserDeletedV1Fact {
  identifier: string
  name: "user-deleted"
  version: 1
  date: Date
  position: number
  stream: {
    name: "user"
    identifier: string
  }
  payload: null
}

interface UserSnapshotV1Fact {
  identifier: string
  name: "user-snapshot"
  date: Date
  version: 1
  position: number
  stream: {
    name: "user"
    identifier: string
  }
  payload: {
    email: string
    password: string
  }[]
}

type UserFact =
  | UserCreatedV1Fact
  | UserDeletedV1Fact
  | UserSnapshotV1Fact

interface UserWithEmail {
  email: string
}

class MemoryUsersWithEmailQuery implements Query<UserFact, UserWithEmail[]> {
  public constructor(private readonly usersWithEmail: Map<string, UserWithEmail> = new Map()) { }

  public async handle(fact: UserFact): Promise<void> {
    if (fact.name === "user-created") {
      this.usersWithEmail.set(fact.stream.identifier, {
        email: fact.payload.email
      })

      return
    }

    this.usersWithEmail.delete(fact.stream.identifier)
  }

  public async fetch(): Promise<UserWithEmail[]> {
    return Array.from(this.usersWithEmail.values())
  }
}

test("It should return all elements until another one", () => {
  expect(until([], value => value >= 3)).toStrictEqual([])
  expect(until([1, 2, 3, 4, 5], value => value >= 3)).toStrictEqual([1, 2, 3])
})

test("It should return the events after adding them to the store", async () => {
  const factStore = new MemoryFactStore<UserCreatedV1Fact>
  const factIdentifier = randomUUID()
  const streamIdentifier = randomUUID()

  await factStore.save({
    identifier: factIdentifier,
    name: "user-created",
    position: 0,
    version: 1,
    date: new Date("2025-01-01"),
    stream: {
      name: "user",
      identifier: streamIdentifier
    },
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
      stream: {
        name: "user",
        identifier: streamIdentifier
      },
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
    stream: {
      name: "user",
      identifier: firstUser.identifier
    },
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
    stream: {
      name: "user",
      identifier: secondUser.identifier
    },
    payload: {
      email: "second@domain.com",
      password: "anotherpass"
    }
  })

  const facts = await factStore.find(fact => {
    return fact.stream.identifier === firstUser.identifier
  })

  expect(facts).toStrictEqual([
    {
      identifier: factIdentifier,
      name: "user-created",
      position: 0,
      version: 1,
      date: new Date("2025-01-01"),
      stream: {
        name: "user",
        identifier: firstUser.identifier
      },
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
    stream: {
      name: "user",
      identifier: randomUUID()
    },
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
    stream: {
      name: "user",
      identifier: snapshotStreamIdentifier
    },
    payload: [
      {
        email: "first@domain.com",
        password: "supersecret"
      }
    ]
  })

  await factStore.save({
    identifier,
    name: "user-created",
    position: 0,
    version: 1,
    stream: {
      name: "user",
      identifier: streamIdentifier
    },
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
      stream: {
        name: "user",
        identifier: snapshotStreamIdentifier
      },
      date: new Date("2025-01-01"),
      payload: [
        {
          email: "first@domain.com",
          password: "supersecret"
        }
      ]
    },
    {
      identifier,
      name: "user-created",
      position: 0,
      version: 1,
      stream: {
        name: "user",
        identifier: streamIdentifier
      },
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
    stream: {
      name: "user",
      identifier: streamIdentifier
    },
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
    stream: {
      name: "user",
      identifier: streamIdentifier
    },
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

  factStore.register(usersWithEmailQuery)

  await factStore.save({
    stream: {
      name: "user",
      identifier: streamIdentifier
    },
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
    stream: {
      name: "user",
      identifier: streamIdentifier
    },
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
  const factStore = new SqliteFactStore<UserFact>(":memory:")
  const identifier = randomUUID()
  const streamIdentifier = randomUUID()
  const query = new MemoryUsersWithEmailQuery()

  factStore.register(query)

  let error = await factStore.save({
    identifier,
    name: "user-created",
    position: 0,
    version: 1,
    stream: {
      name: "user",
      identifier: streamIdentifier
    },
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
    stream: {
      name: "user",
      identifier: streamIdentifier
    },
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
      stream: {
        name: "user",
        identifier: streamIdentifier
      },
      date: new Date("2025-01-01").toISOString(),
      payload: {
        email: "user@domain.com",
        password: "password"
      }
    }
  ])

  const snapshotIdentifier = randomUUID()
  const snapshotStreamIdentifier = randomUUID()

  await factStore.save({
    identifier: snapshotIdentifier,
    name: "user-snapshot",
    position: 0,
    version: 1,
    stream: {
      name: "user",
      identifier: snapshotStreamIdentifier
    },
    date: new Date("2025-01-01"),
    payload: [
      {
        email: "user@domain.com",
        password: "password"
      }
    ]
  })

  const anotherIdentifier = randomUUID()
  const anotherStreamIdentifier = randomUUID()

  await factStore.save({
    identifier: anotherIdentifier,
    name: "user-created",
    position: 0,
    version: 1,
    stream: {
      name: "user",
      identifier: anotherStreamIdentifier
    },
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
      stream: {
        name: "user",
        identifier: snapshotStreamIdentifier
      },
      date: new Date("2025-01-01").toISOString(),
      payload: [
        {
          email: "user@domain.com",
          password: "password"
        }
      ]
    },
    {
      identifier: anotherIdentifier,
      name: "user-created",
      position: 0,
      version: 1,
      stream: {
        name: "user",
        identifier: anotherStreamIdentifier
      },
      date: new Date("2025-01-01").toISOString(),
      payload: {
        email: "another@domain.com",
        password: "pass"
      }
    }
  ])

  factStore.close()
})

test("It should initialize the store correctly", async () => {
  const factStore = new SqliteFactStore<UserFact>(":memory:")
  const query = new MemoryUsersWithEmailQuery()

  const streamIdentifier = randomUUID()
  const identifier = randomUUID()

  await factStore.save({
    identifier,
    name: "user-created",
    position: 0,
    version: 1,
    stream: {
      name: "user",
      identifier: streamIdentifier
    },
    date: new Date("2025-01-01"),
    payload: {
      email: "init@domain.com",
      password: "password"
    }
  })

  factStore.register(query)

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
  const factStore = new SqliteFactStore<UserFact>(":memory:")

  factStore.close()

  const error = await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    position: 0,
    version: 1,
    stream: {
      name: "user",
      identifier: randomUUID()
    },
    date: new Date(),
    payload: {
      email: "test@domain.com",
      password: "password"
    }
  })

  expect(error).toBeInstanceOf(Error)
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
    stream: {
      name: "user",
      identifier: streamIdentifier
    },
    date: new Date("2025-01-01"),
    payload: {
      email: "init@domain.com",
      password: "password"
    }
  })

  factStore.register(query)

  await factStore.initialize()

  const users = await query.fetch()

  expect(users).toStrictEqual([
    {
      email: "init@domain.com"
    }
  ])
})
