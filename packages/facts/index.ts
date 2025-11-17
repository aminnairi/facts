import { DatabaseSync } from "node:sqlite"

export interface FactShape {
  identifier: string
  name: string
  version: number
  sequence: number
  date: Date
  aggregate: string
  aggregateIdentifier: string
  data: unknown
}

export class ConcurrencyError extends Error {
  public override readonly name = "ConcurrencyError"
}

type Accept<Fact extends FactShape> = (fact: Fact) => boolean
type Stop<Fact extends FactShape> = (fact: Fact) => boolean

export interface FactStore<Fact extends FactShape> {
  save(fact: Fact): Promise<void | ConcurrencyError>
  // TODO: return an aysnc iterator
  find(stop: Stop<Fact>): Promise<Fact[]>
  // TODO: return an async iterator
  findFromLast(accept: Accept<Fact>): Promise<Fact[]>
  register(listener: Query<Fact, unknown>): void
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
    const key = `${fact.aggregate}-${fact.aggregateIdentifier}-${fact.sequence}`

    if (this.facts.has(key)) {
      return new ConcurrencyError
    }

    this.queries.forEach(query => {
      query.handle(fact)
    })

    this.facts.set(key, fact)
  }
}

export class SqliteFactStore<Fact extends FactShape> implements FactStore<Fact> {
  private readonly queries: Set<Query<Fact, unknown>> = new Set();

  public constructor(path: string, private readonly database: DatabaseSync = new DatabaseSync(path)) {
    this.database.exec("CREATE TABLE IF NOT EXISTS facts(identifier TEXT PRIMARY KEY, aggregate_name TEXT NOT NULL, aggregate_identifier TEXT NOT NULL, sequence INTEGER NOT NULL, fact TEXT NOT NULL, UNIQUE(aggregate_name, aggregate_identifier, sequence))");
  }

  public async save(fact: Fact): Promise<void | ConcurrencyError> {
    try {
      const preparedStatement = this.database.prepare("INSERT INTO facts(identifier, aggregate_name, aggregate_identifier, sequence, fact) VALUES(:identifier, :aggregate_name, :aggregate_identifier, :sequence, :fact)")

      preparedStatement.run({
        identifier: fact.identifier,
        aggregate_name: fact.aggregate,
        aggregate_identifier: fact.aggregateIdentifier,
        sequence: fact.sequence,
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
    const facts = statement.all().map((row: any) => JSON.parse(row.fact));
    return facts.filter(accept);
  }

  public async findFromLast(stop: Stop<Fact>): Promise<Fact[]> {
    const statement = this.database.prepare("SELECT fact FROM facts ORDER BY rowid DESC");
    const facts = statement.all().map((row: any) => JSON.parse(row.fact));
    return until(facts, isSnapshot).reverse();
  }

  public register(listener: Query<Fact, unknown>): void {
    this.queries.add(listener);
  }
}

