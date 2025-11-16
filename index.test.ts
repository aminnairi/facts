import { test, expect } from "vitest"
import { ConcurrencyError, MemoryFactStore, Query, until } from "."
import { randomUUID } from "crypto"

interface UserCreatedV1Fact {
  identifier: string
  name: "user-created"
  version: 1
  sequence: number
  aggregateIdentifier: string
  aggregate: "user"
  data: {
    email: string
    password: string
  }
}

interface UserDeletedV1Fact {
  identifier: string
  name: "user-deleted"
  version: 1
  sequence: number
  aggregateIdentifier: string
  aggregate: "user"
  data: null
}

interface UserSnapshotV1Fact {
  identifier: string
  name: "user-snapshot"
  version: 1
  sequence: number
  aggregateIdentifier: string
  aggregate: "user"
  data: {
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
      this.usersWithEmail.set(fact.aggregateIdentifier, {
        email: fact.data.email
      })

      return
    }

    this.usersWithEmail.delete(fact.aggregateIdentifier)
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
  const aggregateIdentifier = randomUUID()

  await factStore.save({
    identifier: factIdentifier,
    name: "user-created",
    sequence: 0,
    version: 1,
    aggregateIdentifier: aggregateIdentifier,
    aggregate: "user",
    data: {
      email: "email@domain.com",
      password: "supersecret"
    }
  })

  const facts = await factStore.find()

  expect(facts).toStrictEqual([
    {
      identifier: factIdentifier,
      name: "user-created",
      sequence: 0,
      version: 1,
      aggregateIdentifier: aggregateIdentifier,
      aggregate: "user",
      data: {
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
    sequence: 0,
    version: 1,
    aggregateIdentifier: firstUser.identifier,
    aggregate: "user",
    data: {
      email: "first@domain.com",
      password: "supersecret"
    }
  })

  await factStore.save({
    identifier: factIdentifier,
    name: "user-created",
    sequence: 1,
    version: 1,
    aggregateIdentifier: secondUser.identifier,
    aggregate: "user",
    data: {
      email: "second@domain.com",
      password: "anotherpass"
    }
  })

  const facts = await factStore.find(fact => {
    return fact.aggregateIdentifier === firstUser.identifier
  })

  expect(facts).toStrictEqual([
    {
      identifier: factIdentifier,
      name: "user-created",
      sequence: 0,
      version: 1,
      aggregateIdentifier: firstUser.identifier,
      aggregate: "user",
      data: {
        email: "first@domain.com",
        password: "supersecret"
      }
    }
  ])
})

test("It should return all events from a snpashot only", async () => {
  const factStore = new MemoryFactStore<UserFact>
  const snapshotIdentifier = randomUUID()
  const snapshotAggregateIdentifier = randomUUID()
  const identifier = randomUUID()
  const aggregateIdentifier = randomUUID()

  await factStore.save({
    identifier: randomUUID(),
    name: "user-created",
    sequence: 0,
    version: 1,
    aggregateIdentifier: randomUUID(),
    aggregate: "user",
    data: {
      email: "first@domain.com",
      password: "supersecret"
    }
  })

  await factStore.save({
    identifier: snapshotIdentifier,
    name: "user-snapshot",
    sequence: 0,
    version: 1,
    aggregateIdentifier: snapshotAggregateIdentifier,
    aggregate: "user",
    data: [
      {
        email: "first@domain.com",
        password: "supersecret"
      }
    ]
  })

  await factStore.save({
    identifier,
    name: "user-created",
    sequence: 0,
    version: 1,
    aggregateIdentifier,
    aggregate: "user",
    data: {
      email: "second@domain.com",
      password: "anotherpass"
    }
  })

  const facts = await factStore.findFromSnapshot(fact => {
    return fact.name === "user-snapshot"
  })

  expect(facts).toStrictEqual([
    {
      identifier: snapshotIdentifier,
      name: "user-snapshot",
      sequence: 0,
      version: 1,
      aggregateIdentifier: snapshotAggregateIdentifier,
      aggregate: "user",
      data: [
        {
          email: "first@domain.com",
          password: "supersecret"
        }
      ]
    },
    {
      identifier,
      name: "user-created",
      sequence: 0,
      version: 1,
      aggregateIdentifier,
      aggregate: "user",
      data: {
        email: "second@domain.com",
        password: "anotherpass"
      }
    }
  ])
})

test("It should return a concurrency error if two similar events are added", async () => {
  const factStore = new MemoryFactStore<UserFact>
  const identifier = randomUUID()
  const aggregateIdentifier = randomUUID()


  const firstError = await factStore.save({
    identifier,
    name: "user-created",
    sequence: 0,
    version: 1,
    aggregateIdentifier,
    aggregate: "user",
    data: {
      email: "first@domain.com",
      password: "supersecret"
    }
  })

  const secondError = await factStore.save({
    identifier,
    name: "user-created",
    sequence: 0,
    version: 1,
    aggregateIdentifier,
    aggregate: "user",
    data: {
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
  const aggregateIdentifier = randomUUID()
  const identifier = randomUUID()

  factStore.register(usersWithEmailQuery)

  await factStore.save({
    aggregateIdentifier,
    identifier,
    aggregate: "user",
    sequence: 0,
    name: "user-created",
    version: 1,
    data: {
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
