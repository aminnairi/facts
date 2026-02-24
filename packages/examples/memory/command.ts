import { type FactShape, MemoryFactStore, MemoryCommand } from "@aminnairi/facts"
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

const addTodoCommand = new MemoryCommand<TodoAddedV1Fact>
const removeTodoCommand = new MemoryCommand<TodoRemovedV1Fact>
const factStore = new MemoryFactStore<TodoFact>

factStore.registerCommand(addTodoCommand)
factStore.registerCommand(removeTodoCommand)

let error = await addTodoCommand.send({
  name: "todo-added",
  date: new Date(),
  identifier: randomUUID(),
  position: 0,
  version: 1,
  streamName: "todo",
  streamIdentifier: randomUUID(),
  payload: {
    name: "Do the dishes",
    done: true
  }
})

if (error instanceof Error) {
  console.error(error)
  process.exit(1)
}

error = await removeTodoCommand.send({
  name: "todo-removed",
  date: new Date(),
  identifier: randomUUID(),
  position: 0,
  version: 1,
  streamName: "todo",
  streamIdentifier: randomUUID(),
  payload: null
})

if (error instanceof Error) {
  console.error(error)
  process.exit(1)
}

const facts = await factStore.find()

console.log(facts)
