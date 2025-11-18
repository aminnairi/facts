import { match, Query, MemoryFactStore } from "@aminnairi/facts";
import { randomUUID } from "node:crypto"

interface TodoAddedV1Fact {
  name: "todo-added"
  identifier: string
  position: number
  version: 1
  date: Date
  stream: {
    name: "todo",
    identifier: string
  }
  payload: {
    name: string
    done: boolean
  }
}

interface TodoRemovedV1Fact {
  name: "todo-removed"
  date: Date
  identifier: string
  position: number
  version: 1
  stream: {
    name: "todo"
    identifier: string
  }
  payload: null
}

type TodoFact =
  | TodoAddedV1Fact
  | TodoRemovedV1Fact

interface Todo {
  identifier: string
  name: string
  done: boolean
  createdAt: Date
}

class MemoryTodosQuery implements Query<TodoFact, Todo[]> {
  public constructor(private readonly todos: Map<string, Todo> = new Map()) { }

  public async handle(fact: TodoFact): Promise<void> {
    match(fact, {
      "todo-added": todoAddedFact => {
        this.todos.set(todoAddedFact.stream.identifier, {
          identifier: todoAddedFact.stream.identifier,
          name: todoAddedFact.payload.name,
          done: todoAddedFact.payload.done,
          createdAt: todoAddedFact.date
        })
      },
      "todo-removed": todoRemovedFact => {
        this.todos.delete(todoRemovedFact.stream.identifier)
      }
    })
  }

  public async fetch(): Promise<Todo[]> {
    return Array.from(this.todos.values())
  }
}

const identifier = randomUUID()

const factStore = new MemoryFactStore<TodoFact>(new Map([
  [
    identifier,
    {
      name: "todo-added",
      date: new Date(),
      identifier: randomUUID(),
      position: 0,
      version: 1,
      stream: {
        name: "todo",
        identifier
      },
      payload: {
        done: false,
        name: "Do the dishes"
      }
    }
  ]
]))

const query = new MemoryTodosQuery()

factStore.register(query)

await factStore.initialize()

const todos = await query.fetch()

for (const todo of todos) {
  console.log(`Todo#${todo.identifier.slice(0, 6)}: (${todo.done ? "Done" : "Todo"}) ${todo.name}`)
}
