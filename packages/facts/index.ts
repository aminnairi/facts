import { randomUUID } from "crypto"
import { DatabaseSync } from "node:sqlite"

export interface FactShape {
  identifier: string
  name: string
  version: number
  position: number
  date: Date
  stream: {
    name: string
    identifier: string
  }
  payload: unknown
}

export class ConcurrencyError extends Error {
  public override readonly name = "ConcurrencyError"
}

type Accept<Fact extends FactShape> = (fact: Fact) => boolean
type Stop<Fact extends FactShape> = (fact: Fact) => boolean

export interface FactStore<Fact extends FactShape> {
  // TODO: return an unexpected error if something goes wrong
  save(fact: Fact): Promise<void | ConcurrencyError>
  // TODO: return an aysnc iterator
  // TODO: return an error when the parser fails
  // TODO: return an unexpected error if something goes wrong
  find(stop: Stop<Fact>): Promise<Fact[]>
  // TODO: return an async iterator
  // TODO: return an error when the parser fails
  // TODO: return an unexpected error if something goes wrong
  findFromLast(accept: Accept<Fact>): Promise<Fact[]>
  register(listener: Query<Fact, unknown>): void
  // TODO: return an unexpected error if something goes wrong
  initialize(): Promise<void>
}

export interface Query<Fact extends FactShape, Data> {
  handle(fact: Fact): Promise<void>
  fetch(): Promise<Data>
}

export function until<Value>(values: Value[], stop: (value: Value) => boolean): Value[] {
  const [value, ...remainingValues] = values

  if (!value) {
    return []
  }

  if (stop(value)) {
    return [value]
  }

  return [
    value,
    ...until(remainingValues, stop)
  ]
}

export function match<Output, Fact extends FactShape>(fact: Fact, options: { [Key in Fact["name"]]: (fact: Extract<Fact, { name: Key }>) => Output }): Output {
  return options[fact.name](fact)
}

export class MemoryFactStore<Fact extends FactShape> implements FactStore<Fact> {
  public constructor(
    private readonly facts: Map<string, Fact> = new Map(),
    private readonly queries: Set<Query<Fact, unknown>> = new Set()
  ) { }

  public register(query: Query<Fact, unknown>): void {
    this.queries.add(query)
  }

  public async find(accept: Accept<Fact> = () => true): Promise<Fact[]> {
    return Array.from(this.facts.values()).filter(accept)
  }

  public async findFromLast(stop: Stop<Fact>) {
    return until(Array.from(this.facts.values()).reverse(), stop).reverse()
  }

  public async save(fact: Fact): Promise<void | ConcurrencyError> {
    const key = `${fact.stream.name}-${fact.stream.identifier}-${fact.position}`

    if (this.facts.has(key)) {
      return new ConcurrencyError
    }

    this.queries.forEach(query => {
      query.handle(fact)
    })

    this.facts.set(key, fact)
  }

  public async initialize(): Promise<void> {
    this.facts.forEach(fact => {
      this.queries.forEach(query => {
        query.handle(fact)
      })
    })
  }
}

export class SqliteFactStore<Fact extends FactShape> implements FactStore<Fact> {
  private readonly queries: Set<Query<Fact, unknown>> = new Set();

  private constructor(private readonly database: DatabaseSync, private readonly parser: (fact: unknown) => Fact) { }

  public static for<Fact extends FactShape>(path: string, options: { parser: (fact: unknown) => Fact }) {
    const database = new DatabaseSync(path)

    database.exec("CREATE TABLE IF NOT EXISTS migrations(identifier TEXT PRIMARY KEY, version UNSIGNED INTEGER NOT NULL)")

    const getLatestMigrationStatement = database.prepare("SELECT version FROM migrations ORDER BY version DESC LIMIT 1")

    const latestMigrationRow = getLatestMigrationStatement.get()
    const latestMigrationVersion = Number(latestMigrationRow?.version ?? 0) || 0

    if (latestMigrationVersion < 1) {
      database.exec("CREATE TABLE IF NOT EXISTS facts(identifier TEXT PRIMARY KEY, stream_name TEXT NOT NULL, stream_identifier TEXT NOT NULL, position INTEGER NOT NULL, fact TEXT NOT NULL, UNIQUE(stream_name, stream_identifier, position))");

      const migrationStatement = database.prepare("INSERT INTO migrations(identifier, version) VALUES(?, ?)")
      const migrationIdentifier = randomUUID()
      const migrationVersion = 1

      migrationStatement.run(migrationIdentifier, migrationVersion)
    }

    return new SqliteFactStore<Fact>(database, options.parser)
  }

  public async save(fact: Fact): Promise<void | ConcurrencyError> {
    try {
      const statement = this.database.prepare("INSERT INTO facts(identifier, stream_name, stream_identifier, position, fact) VALUES(:identifier, :stream_name, :stream_identifier, :position, :fact)")

      statement.run({
        identifier: fact.identifier,
        stream_name: fact.stream.name,
        stream_identifier: fact.stream.identifier,
        position: fact.position,
        fact: JSON.stringify(fact)
      });

      this.queries.forEach(query => {
        query.handle(fact);
      });
    } catch (error) {
      return new ConcurrencyError();
    }
  }

  public async find(accept: (fact: Fact) => boolean = () => true): Promise<Fact[]> {
    const statement = this.database.prepare("SELECT fact FROM facts");
    const facts = statement.all().map((row: any) => this.parser(JSON.parse(row.fact)));
    return facts.filter(accept);
  }

  public async findFromLast(stop: Stop<Fact>): Promise<Fact[]> {
    const statement = this.database.prepare("SELECT fact FROM facts ORDER BY rowid DESC");
    const facts: Fact[] = []

    for (const row of statement.iterate()) {
      const untrustedFact = JSON.parse(String(row.fact))
      const fact = this.parser(untrustedFact)

      facts.unshift(fact)

      if (stop(fact)) {
        break
      }
    }

    return facts;
  }

  public register(listener: Query<Fact, unknown>): void {
    this.queries.add(listener);
  }

  public async initialize(): Promise<void> {
    const statement = this.database.prepare("SELECT fact from facts")

    for (const row of statement.iterate()) {
      const untrustedFact = JSON.parse(String(row.fact))
      const fact = this.parser(untrustedFact)

      this.queries.forEach(query => {
        query.handle(fact)
      })
    }
  }

  public close(): void {
    this.database.close()
  }
}

