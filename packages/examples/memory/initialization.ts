import { match, Query, MemoryFactStore } from "@aminnairi/facts";
import { randomUUID } from "node:crypto"

interface TodoAddedV1Fact {
  name: "todo-added"
  identifier: string
  sequence: number
  version: 1
  aggregate: "todo"
  date: Date
  aggregateIdentifier: string
  data: {
    name: string
    done: boolean
  }
}

interface TodoRemovedV1Fact {
  name: "todo-removed"
  date: Date
  identifier: string
  sequence: number
  version: 1
  aggregate: "todo"
  aggregateIdentifier: string
  data: null
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
        this.todos.set(todoAddedFact.aggregateIdentifier, {
          identifier: todoAddedFact.aggregateIdentifier,
          name: todoAddedFact.data.name,
          done: todoAddedFact.data.done,
          createdAt: todoAddedFact.date
        })
      },
      "todo-removed": todoRemovedFact => {
        this.todos.delete(todoRemovedFact.aggregateIdentifier)
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
      aggregateIdentifier: identifier,
      aggregate: "todo",
      name: "todo-added",
      date: new Date(),
      identifier: randomUUID(),
      sequence: 0,
      version: 1,
      data: {
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
