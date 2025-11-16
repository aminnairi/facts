
import { MemoryFactStore, Query } from "../.."

interface TodoAddedV1Fact {
  identifier: string
  date: Date
  name: "todo-added"
  version: 1
  sequence: number
  aggregate: "todo"
  aggregateIdentifier: string
  data: {
    name: string
    done: boolean
  }
}

interface TodoRemovedV1Fact {
  identifier: string
  date: Date
  name: "todo-removed"
  version: 1
  sequence: number
  aggregate: "todo"
  aggregateIdentifier: string
  data: null
}

type TodoFact =
  | TodoAddedV1Fact
  | TodoRemovedV1Fact

interface DescribedTodo {
  identifier: string
  description: string
}

class MemoryDescribedTodoQuery implements Query<TodoFact, DescribedTodo[]> {
  public constructor(private readonly todos: Map<string, DescribedTodo> = new Map()) { }

  public async handle(fact: TodoFact): Promise<void> {
    if (fact.name === "todo-added") {
      this.todos.set(fact.aggregateIdentifier, {
        identifier: fact.aggregateIdentifier,
        description: `[${fact.data.done ? "Done" : "Todo"}] ${fact.data.name}`
      })
    }

    if (fact.name === "todo-removed") {
      this.todos.delete(fact.aggregateIdentifier)
    }
  }

  public async fetch(): Promise<DescribedTodo[]> {
    return Array.from(this.todos.values())
  }
}

const factStore = new MemoryFactStore<TodoFact>
const describedTodoQuery = new MemoryDescribedTodoQuery

factStore.register(describedTodoQuery)

let error = await factStore.save({
  aggregate: "todo",
  aggregateIdentifier: "123",
  name: "todo-added",
  identifier: "123",
  date: new Date(),
  sequence: 0,
  version: 1,
  data: {
    name: "Do the dishes",
    done: false
  }
})

if (error instanceof Error) {
  console.error("Failed to add the todo")
  process.exit(1)
}

error = await factStore.save({
  aggregate: "todo",
  aggregateIdentifier: "456",
  name: "todo-added",
  identifier: "456",
  sequence: 0,
  version: 1,
  date: new Date(),
  data: {
    name: "Publish this library",
    done: true
  }
})

if (error instanceof Error) {
  console.error("Failed to add the todo")
  process.exit(1)
}

console.log("List of facts")

const todos = await describedTodoQuery.fetch()

for (const todo of todos) {
  console.log(todo)
}
