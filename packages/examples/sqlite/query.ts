import { type FactShape, SqliteFactStore, ParseError, type Query, QueryInitializeError } from "@aminnairi/facts"
import { z, ZodType } from "zod";
import { DatabaseSync } from "node:sqlite"

const todoAddedV1FactSchema = z.object({
  date: z.coerce.date(),
  identifier: z.string(),
  name: z.literal("todo-added"),
  position: z.number(),
  streamIdentifier: z.string(),
  streamName: z.literal("todo"),
  version: z.literal(1),
  payload: z.object({
    name: z.string(),
    done: z.boolean(),
  }),
}) satisfies ZodType<FactShape>;

const todoRemovedV1FactSchema = z.object({
  date: z.coerce.date(),
  identifier: z.string(),
  name: z.literal("todo-removed"),
  position: z.number(),
  streamIdentifier: z.string(),
  streamName: z.literal("todo"),
  version: z.literal(1),
  payload: z.null(),
}) satisfies ZodType<FactShape>;

const invoiceCreatedV1FactSchema = z.object({
  date: z.coerce.date(),
  identifier: z.string(),
  name: z.literal("invoice-created"),
  position: z.number(),
  streamIdentifier: z.string(),
  streamName: z.literal("invoice"),
  version: z.literal(1),
  payload: z.object({
    amount: z.number(),
  }),
}) satisfies ZodType<FactShape>;

const todoFactSchema = z.union([
  todoAddedV1FactSchema,
  todoRemovedV1FactSchema,
  invoiceCreatedV1FactSchema,
]);

type TodoFact = z.infer<typeof todoFactSchema>;

interface TodoRow {
  identifier: string
  description: string
  created_at: string
}

class SqliteTodoQuery implements Query<TodoFact> {
  public constructor(private readonly database: DatabaseSync) { }

  public async initialize(): Promise<void | QueryInitializeError> {
    try {
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS todos (
          identifier TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `)
    } catch (error) {
      return new QueryInitializeError(String(error))
    }
  }

  public async handle(fact: TodoFact): Promise<void> {
    if (fact.streamName !== "todo") {
      return
    }

    if (fact.name === "todo-added") {
      const statement = this.database.prepare(`
        INSERT INTO todos (identifier, description, created_at)
        VALUES (?, ?, ?)
      `)

      statement.run(
        fact.streamIdentifier,
        `[${fact.payload.done ? "Done" : "Todo"}] ${fact.payload.name}`,
        fact.date.toISOString()
      )
    }

    if (fact.name === "todo-removed") {
      const statement = this.database.prepare(`DELETE FROM todos WHERE identifier = ?`)
      statement.run(fact.streamIdentifier)
    }
  }

  public async getDescribedTodos(): Promise<TodoRow[]> {
    const statement = this.database.prepare(`SELECT identifier, description, created_at FROM todos`)
    return statement.all() as unknown as TodoRow[]
  }
}

interface InvoiceRow {
  identifier: string
  amount: number
  created_at: string
}

class SqliteInvoiceQuery implements Query<TodoFact> {
  public constructor(private readonly database: DatabaseSync) { }

  public async initialize(): Promise<void | QueryInitializeError> {
    try {
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
          identifier TEXT PRIMARY KEY,
          amount INTEGER NOT NULL,
          created_at TEXT NOT NULL
        )
      `)
    } catch (error) {
      return new QueryInitializeError(String(error))
    }
  }

  public async handle(fact: TodoFact): Promise<void> {
    if (fact.streamName !== "invoice") {
      return
    }

    if (fact.name === "invoice-created") {
      const statement = this.database.prepare(`
        INSERT INTO invoices (identifier, amount, created_at)
        VALUES (?, ?, ?)
      `)

      statement.run(
        fact.streamIdentifier,
        fact.payload.amount,
        fact.date.toISOString()
      )
    }
  }

  public async getInvoices(): Promise<InvoiceRow[]> {
    const statement = this.database.prepare(`SELECT identifier, amount, created_at FROM invoices`)
    return statement.all() as unknown as InvoiceRow[]
  }
}

const dbPath = ":memory:"

const factStore = SqliteFactStore.for<TodoFact>(dbPath, {
  parser: fact => {
    const result = todoFactSchema.safeParse(fact)

    if (!result.success) {
      return new ParseError(result.error.message)
    }

    return result.data
  }
})

// @ts-expect-error - Accessing private database property for demonstration
const database: DatabaseSync = factStore.database

const describedTodoQuery = new SqliteTodoQuery(database)
const invoicesQuery = new SqliteInvoiceQuery(database)

factStore.registerQuery(describedTodoQuery)
factStore.registerQuery(invoicesQuery)

await factStore.initialize()

let error = await factStore.save({
  streamName: "todo",
  streamIdentifier: "123",
  name: "todo-added",
  identifier: "123",
  date: new Date(),
  position: 0,
  version: 1,
  payload: {
    name: "Do the dishes",
    done: false
  }
})

if (error instanceof Error) {
  console.error("Failed to add the todo")
  process.exit(1)
}

error = await factStore.save({
  streamName: "todo",
  streamIdentifier: "456",
  name: "todo-added",
  identifier: "456",
  position: 0,
  version: 1,
  date: new Date(),
  payload: {
    name: "Publish this library",
    done: true
  }
})

if (error instanceof Error) {
  console.error("Failed to add the todo")
  process.exit(1)
}

error = await factStore.save({
  streamName: "invoice",
  streamIdentifier: "789",
  name: "invoice-created",
  identifier: "101112",
  position: 0,
  version: 1,
  date: new Date(),
  payload: {
    amount: 42069,
  }
})

if (error instanceof Error) {
  console.error("Failed to add the invoice")
  process.exit(1)
}

console.log("List of todos")

const todos = await describedTodoQuery.getDescribedTodos()

for (const todo of todos) {
  console.log(`Todo#${todo.identifier}: ${todo.description} (${new Date(todo.created_at).toLocaleDateString()})`)
}

console.log("List of invoices")

const invoices = await invoicesQuery.getInvoices()

for (const invoice of invoices) {
  console.log(`Invoice#${invoice.identifier} (${new Date(invoice.created_at).toLocaleDateString()}): $${invoice.amount}`)
}

factStore.close()
