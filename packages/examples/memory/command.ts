import { type FactShape, type FactStore, MemoryFactStore } from "@aminnairi/facts"
import { randomUUID } from "crypto"

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

type TodoFact =
  | TodoAddedV1Fact
  | TodoRemovedV1Fact

class AddTodoCommand {
  constructor(private readonly store: FactStore<TodoFact>) {}

  async execute(name: string, done: boolean) {
    return this.store.save({
      name: "todo-added",
      date: new Date(),
      identifier: randomUUID(),
      position: 0,
      version: 1,
      streamName: "todo",
      streamIdentifier: randomUUID(),
      payload: { name, done }
    })
  }
}

class RemoveTodoCommand {
  constructor(private readonly store: FactStore<TodoFact>) {}

  async execute(streamIdentifier: string) {
    return this.store.save({
      name: "todo-removed",
      date: new Date(),
      identifier: randomUUID(),
      position: 0,
      version: 1,
      streamName: "todo",
      streamIdentifier,
      payload: null
    })
  }
}

const factStore = new MemoryFactStore<TodoFact>

const addTodoCommand = new AddTodoCommand(factStore)
const removeTodoCommand = new RemoveTodoCommand(factStore)

let error = await addTodoCommand.execute("Do the dishes", true)

if (error instanceof Error) {
  console.error(error)
  process.exit(1)
}

const streamIdentifier = randomUUID()

await factStore.save({
  name: "todo-added",
  date: new Date(),
  identifier: randomUUID(),
  position: 0,
  version: 1,
  streamName: "todo",
  streamIdentifier,
  payload: { name: "Buy milk", done: false }
})

error = await removeTodoCommand.execute(streamIdentifier)

if (error instanceof Error) {
  console.error(error)
  process.exit(1)
}

const facts = await factStore.find()

console.log(facts)
