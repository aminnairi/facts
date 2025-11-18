
import { match, MemoryFactStore, Query } from "@aminnairi/facts"

interface TodoAddedV1Fact {
  identifier: string
  date: Date
  name: "todo-added"
  version: 1
  position: number
  stream: {
    name: "todo"
    identifier: string
  }
  payload: {
    name: string
    done: boolean
  }
}

interface TodoRemovedV1Fact {
  identifier: string
  date: Date
  name: "todo-removed"
  version: 1
  position: number
  stream: {
    name: "todo"
    identifier: string
  }
  payload: null
}

type TodoFact =
  | TodoAddedV1Fact
  | TodoRemovedV1Fact

interface DescribedTodo {
  identifier: string
  description: string
  createdAt: Date
}

class MemoryDescribedTodoQuery implements Query<TodoFact, DescribedTodo[]> {
  public constructor(private readonly todos: Map<string, DescribedTodo> = new Map()) { }

  public async handle(fact: TodoFact): Promise<void> {
    match(fact, {
      "todo-added": todoAddedFact => {
        this.todos.set(fact.stream.identifier, {
          identifier: fact.stream.identifier,
          description: `[${todoAddedFact.payload.done ? "Done" : "Todo"}] ${todoAddedFact.payload.name}`,
          createdAt: todoAddedFact.date
        })
      },
      "todo-removed": todoRemovedFact => {
        this.todos.delete(todoRemovedFact.stream.identifier)
      }
    })
  }

  public async fetch(): Promise<DescribedTodo[]> {
    return Array.from(this.todos.values())
  }
}

const factStore = new MemoryFactStore<TodoFact>
const describedTodoQuery = new MemoryDescribedTodoQuery

factStore.register(describedTodoQuery)

let error = await factStore.save({
  stream: {
    name: "todo",
    identifier: "123"
  },
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
  stream: {
    name: "todo",
    identifier: "456"
  },
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

console.log("List of facts")

const todos = await describedTodoQuery.fetch()

for (const todo of todos) {
  console.log(`Todo#${todo.identifier}: ${todo.description} (${todo.createdAt})`)
}
