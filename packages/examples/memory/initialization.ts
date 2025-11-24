import { match, Query, MemoryFactStore, FactShape } from "@aminnairi/facts";
import { randomUUID } from "node:crypto"

interface TodoAddedV1Fact extends FactShape {
  name: "todo-added"
  version: 1
  date: Date
  streamName: "todo",
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
        this.todos.set(todoAddedFact.streamIdentifier, {
          identifier: todoAddedFact.streamIdentifier,
          name: todoAddedFact.payload.name,
          done: todoAddedFact.payload.done,
          createdAt: todoAddedFact.date
        })
      },
      "todo-removed": todoRemovedFact => {
        this.todos.delete(todoRemovedFact.streamIdentifier)
      }
    })
  }

  public async fetch(): Promise<Todo[]> {
    return Array.from(this.todos.values())
  }
}

const streamIdentifier = randomUUID()

const factStore = new MemoryFactStore<TodoFact>(new Map([
  [
    streamIdentifier,
    {
      name: "todo-added",
      date: new Date(),
      identifier: randomUUID(),
      position: 0,
      version: 1,
      streamName: "todo",
      streamIdentifier,
      payload: {
        done: false,
        name: "Do the dishes"
      }
    }
  ]
]))

const query = new MemoryTodosQuery()

factStore.registerQuery(query)

await factStore.initialize()

const todos = await query.fetch()

for (const todo of todos) {
  console.log(`Todo#${todo.identifier.slice(0, 6)}: (${todo.done ? "Done" : "Todo"}) ${todo.name}`)
}
