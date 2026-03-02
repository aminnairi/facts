
import { type FactShape, match, MemoryFactStore, type Query } from "@aminnairi/facts"

interface TodoAddedV1Fact extends FactShape {
  name: "todo-added"
  version: 1
  streamName: "todo"
  payload: {
    name: string
    done: boolean
  }
}

interface TodoRemovedV1Fact extends FactShape {
  name: "todo-removed"
  version: 1
  streamName: "todo"
  payload: null
}

interface InvoiceCreatedV1Fact extends FactShape {
  name: "invoice-created"
  version: 1
  streamName: "invoice"
  payload: {
    amount: number
  }
}

type TodoFact =
  | TodoAddedV1Fact
  | TodoRemovedV1Fact
  | InvoiceCreatedV1Fact

interface DescribedTodo {
  identifier: string
  description: string
  createdAt: Date
}

class MemoryDescribedTodoQuery implements Query<TodoFact> {
  public constructor(private readonly todos: Map<string, DescribedTodo> = new Map()) { }

  public async handle(fact: TodoFact): Promise<void> {
    if (fact.streamName === "todo") {
      match(fact, {
        "todo-added": todoAddedFact => {
          this.todos.set(fact.streamIdentifier, {
            identifier: fact.streamIdentifier,
            description: `[${todoAddedFact.payload.done ? "Done" : "Todo"}] ${todoAddedFact.payload.name}`,
            createdAt: todoAddedFact.date
          })
        },
        "todo-removed": todoRemovedFact => {
          this.todos.delete(todoRemovedFact.streamIdentifier)
        },
      })
    }
  }

  public async getDescribedTodos(): Promise<DescribedTodo[]> {
    return Array.from(this.todos.values())
  }
}

interface Invoice {
  identifier: string
  amount: number
  createdAt: Date
}

class MemoryInvoicesQuery implements Query<TodoFact> {
  public constructor(private readonly invoices: Map<string, Invoice> = new Map()) { }

  public async handle(fact: TodoFact): Promise<void> {
    if (fact.streamName === "invoice") {
      match(fact, {
        "invoice-created": invoiceCreatedFact => {
          this.invoices.set(fact.streamIdentifier, {
            identifier: fact.streamIdentifier,
            amount: fact.payload.amount,
            createdAt: invoiceCreatedFact.date
          })
        },
      })
    }
  }

  public async getInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values())
  }
}

const factStore = new MemoryFactStore<TodoFact>
const describedTodoQuery = new MemoryDescribedTodoQuery
const invoicesQuery = new MemoryInvoicesQuery

factStore.registerQuery(describedTodoQuery)
factStore.registerQuery(invoicesQuery)

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

console.log("List of facts")

const todos = await describedTodoQuery.getDescribedTodos()

for (const todo of todos) {
  console.log(`Todo#${todo.identifier}: ${todo.description} (${todo.createdAt})`)
}

console.log("List of invoices")

const invoices = await invoicesQuery.getInvoices()

for (const invoice of invoices) {
  console.log(`Invoice#${invoice.identifier} (${invoice.createdAt}): $${invoice.amount}`)
}
