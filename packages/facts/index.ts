import { randomUUID } from "crypto"
import { DatabaseSync } from "node:sqlite"

// TODO: return an async iterator for find and findFromLast

/**
 * Represents the shape of a fact, which is an event that has been stored in the
 * fact store.
 */
export interface FactShape {
  /**
   * Unique identifier for this fact.
   */
  identifier: string
  /**
   * The name of the fact, used to distinguish it from other facts.
   */
  name: string
  /**
   * The version of the fact, used for migrating facts over time.
   */
  version: number
  /**
   * The position of the fact in its stream.
   */
  position: number
  /**
   * The date when the fact was created.
   */
  date: Date
  /**
   * The name of the stream.
   */
  streamName: string
  /**
   * The unique identifier of the stream.
   */
  streamIdentifier: string
  /**
   * The payload of the fact, containing the actual data.
   */
  payload: unknown
}

/**
 * Error returned whenever a fact has already been saved and to prevent
 * duplicate facts from being stored.
 */
export class ConcurrencyError extends Error {
  public override readonly name = "ConcurrencyError"
}

/**
 * Error returned whenever something went wrong and is not a parse or
 * concurrency error.
 */
export class UnexpectedError extends Error {
  public override readonly name = "UnexpectedError"

  /**
   * @param error The original error that was thrown.
   */
  public constructor(public readonly error: unknown) {
    super()
  }
}

/**
 * Error returned whenever a fact is most likely corrupted and the database has
 * been altered outside of this program.
 */
export class ParseError extends Error {
  public override readonly name = "ParseError"
}

/**
 * Represents a store for facts, which can be used to save and retrieve facts.
 *
 * @template Fact The shape of the facts that are stored.
 */
export interface FactStore<Fact extends FactShape> {
  /**
   * Saves a fact in the store. Returns a concurrency error if the fact name,
   * identifier and position is similar to a previously saved fact, most likely
   * indicating an attempt at saving a duplicate fact.
   *
   * @param fact The fact to save.
   */
  save(fact: Fact): Promise<void | ConcurrencyError>

  /**
   * Find a list of fact according to a condition, which is a callback that is
   * called on each facts from the store.
   *
   * @param accept A function that returns true if the fact should be included
   * in the result.
   */
  find<DiscriminatedFact extends Fact>(accept: (fact: Fact) => fact is DiscriminatedFact): Promise<UnexpectedError | ParseError | DiscriminatedFact[]>
  find(accept?: (fact: Fact) => boolean): Promise<UnexpectedError | ParseError | Fact[]>

  /**
   * Find a list of fact from the most recent to the oldest, allowing you to stop at a
   * certain fact, useful for retrieving all facts until a snapshot has been
   * encountered.
   *
   * @param stop A function that returns true if the iteration should stop.
   */
  findFromLast<DiscriminatedFact extends Fact>(stop: (fact: Fact) => fact is DiscriminatedFact): Promise<UnexpectedError | ParseError | DiscriminatedFact[]>
  findFromLast(stop: (fact: Fact) => boolean): Promise<UnexpectedError | ParseError | Fact[]>

  /**
   * Saves a query in a local set of queries, which are then called each time a
   * fact is saved, triggered when calling the `save` method, using the
   * `handle` method of each query.
   *
   * @param listener The query to register.
   */
  registerQuery(listener: Query<Fact>): void

  /**
   * Call the `handle` method of each query which have been registered using
   * the `register` method, for each facts that has been previously stored.
   * Although this method has no usefulness when a query state when using a persistent store
   * from previous facts, like the `SqliteFactStore`.
   */
  initialize(): Promise<void | ParseError | UnexpectedError | QueryInitializeError>
}

export class QueryInitializeError extends Error {
  public override readonly name = "QueryInitializeError"

  public constructor(public readonly message: string) {
    super(message);
  }
}

/**
 * Represents a query that can be registered with a fact store to process facts
 * as they are saved.
 *
 * @template Fact The shape of the facts that are processed.
 */
export interface Query<Fact extends FactShape> {
  /**
   * Handles a fact that has been saved in the store.
   *
   * @param fact The fact that has been saved.
   */
  handle(fact: Fact): Promise<void>
  /**
   * Called once when registered using the FactStore.query method. Not useful if you are building an in-memory query, but proves itself useful when dealing with SQL databases for creating the schema.
   */
  initialize?: () => Promise<void | QueryInitializeError>
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

/**
 * A utility function that allows you to match a fact against a set of handlers
 * based on the fact's name, and return a value. This is useful for handling
 * different types of facts in a type-safe way.
 *
 * @param fact The fact to match.
 * @param options A map of handlers, where the key is the name of the fact and
 * the value is a function that handles that fact.
 *
 * @template Output The type of the value that is returned by the handlers.
 * @template Fact The shape of the facts that are matched.
 */
export function match<Output, Fact extends FactShape>(fact: Fact, options: { [Key in Fact["name"]]: (fact: Extract<Fact, { name: Key }>) => Output }): Output {
  return options[fact.name as Fact["name"]](fact as Extract<Fact, { name: Fact["name"] }>)
}

/**
 * An in-memory implementation of the `FactStore` interface. This is useful for
 * testing and development, but should not be used in production as it does not
 * persist facts.
 *
 * @template Fact The shape of the facts that are stored.
 */
export class MemoryFactStore<Fact extends FactShape> implements FactStore<Fact> {
  /**
   * @param facts A map of facts that are stored in memory.
   * @param queries A set of queries that are registered with the store.
   */
  public constructor(
    private readonly facts: Map<string, Fact> = new Map(),
    private readonly queries: Set<Query<Fact>> = new Set()
  ) { }

  public registerQuery(query: Query<Fact>) {
    this.queries.add(query)
  }

  public find<DiscriminatedFact extends Fact>(accept: (fact: Fact) => fact is DiscriminatedFact): Promise<DiscriminatedFact[]>
  public find(accept?: (fact: Fact) => boolean): Promise<Fact[]>
  public async find(accept: (fact: Fact) => boolean = () => true): Promise<Fact[]> {
    return Array.from(this.facts.values()).filter(accept)
  }

  public findFromLast<DiscriminatedFact extends Fact>(stop: (fact: Fact) => fact is DiscriminatedFact): Promise<DiscriminatedFact[]>
  public findFromLast(stop: (fact: Fact) => boolean): Promise<Fact[]>
  public async findFromLast(stop: (fact: Fact) => boolean): Promise<Fact[]> {
    return until(Array.from(this.facts.values()).reverse(), stop).reverse()
  }

  public async save(fact: Fact): Promise<void | ConcurrencyError> {
    const key = `${fact.streamName}-${fact.streamIdentifier}-${fact.position}`

    if (this.facts.has(key)) {
      return new ConcurrencyError
    }

    this.queries.forEach(query => {
      query.handle(fact)
    })

    this.facts.set(key, fact)
  }

  public async initialize(): Promise<void | QueryInitializeError> {
    try {
      for (const query of this.queries) {
        const result = await query.initialize?.()

        if (result instanceof QueryInitializeError) {
          return result
        }
      }

      this.facts.forEach(fact => {
        this.queries.forEach(query => {
          query.handle(fact)
        })
      })
    } catch (error) {
      return new QueryInitializeError(String(error))
    }
  }
}

/**
 * An implementation of the `FactStore` interface that uses a SQLite database
 * to persist facts.
 *
 * @template Fact The shape of the facts that are stored.
 */
export class SqliteFactStore<Fact extends FactShape> implements FactStore<Fact> {
  /**
   * A set of queries that are registered with the store.
   */
  private readonly queries: Set<Query<Fact>> = new Set();

  /**
   * @param database The SQLite database to use for storing facts.
   * @param parser A function that parses a fact from the database.
   */
  private constructor(private readonly database: DatabaseSync, private readonly parser: (fact: unknown) => Fact | ParseError) { }

  /**
   * Creates a new `SqliteFactStore` for the given database path.
   *
   * @param path The path to the SQLite database file.
   * @param options Options for creating the store.
   *
   * @template Fact The shape of the facts that are stored.
   */
  public static for<Fact extends FactShape>(path: string, options: { parser: (fact: unknown) => Fact | ParseError }) {
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
        stream_name: fact.streamName,
        stream_identifier: fact.streamIdentifier,
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


  public find<DiscriminatedFact extends Fact>(accept: (fact: Fact) => fact is DiscriminatedFact): Promise<UnexpectedError | ParseError | DiscriminatedFact[]>
  public find(accept?: (fact: Fact) => boolean): Promise<UnexpectedError | ParseError | Fact[]>
  public async find(accept: (fact: Fact) => boolean = () => true): Promise<UnexpectedError | ParseError | Fact[]> {
    try {
      const acceptedFacts: Fact[] = []
      const statement = this.database.prepare("SELECT fact FROM facts");
      const untrustedFacts = statement.all()

      for (const untrustedFact of untrustedFacts) {
        const fact = this.parser(JSON.parse(String(untrustedFact.fact)))

        if (fact instanceof ParseError) {
          return fact
        }

        if (accept(fact)) {
          acceptedFacts.push(fact)
        }
      }

      return acceptedFacts
    } catch (error) {
      return new UnexpectedError(error)
    }
  }

  public findFromLast<DiscriminatedFact extends Fact>(stop: (fact: Fact) => fact is DiscriminatedFact): Promise<UnexpectedError | ParseError | DiscriminatedFact[]>
  public findFromLast(stop: (fact: Fact) => boolean): Promise<UnexpectedError | ParseError | Fact[]>
  public async findFromLast(stop: (fact: Fact) => boolean): Promise<UnexpectedError | ParseError | Fact[]> {
    try {
      const statement = this.database.prepare("SELECT fact FROM facts ORDER BY rowid DESC");
      const facts: Fact[] = []

      for (const row of statement.iterate()) {
        const untrustedFact = JSON.parse(String(row.fact))
        const fact = this.parser(untrustedFact)

        if (fact instanceof ParseError) {
          return fact
        }

        facts.unshift(fact)

        if (stop(fact)) {
          break
        }
      }

      return facts
    } catch (error) {
      return new UnexpectedError(error)
    }
  }

  public registerQuery(listener: Query<Fact>): void {
    this.queries.add(listener);
  }

  public async initialize(): Promise<void | ParseError | UnexpectedError | QueryInitializeError> {
    try {
      for (const query of this.queries) {
        try {
          const result = await query.initialize?.()

          if (result instanceof QueryInitializeError) {
            return result
          }
        } catch (error) {
          return new QueryInitializeError(String(error))
        }
      }

      const statement = this.database.prepare("SELECT fact from facts")

      for (const row of statement.iterate()) {
        const untrustedFact = JSON.parse(String(row.fact))
        const fact = this.parser(untrustedFact)

        if (fact instanceof ParseError) {
          return fact
        }

        this.queries.forEach(query => {
          query.handle(fact)
        })
      }
    } catch (error) {
      return new UnexpectedError(error)
    }
  }

  /**
   * Closes the database connection.
   */
  public close(): void {
    this.database.close()
  }
}
