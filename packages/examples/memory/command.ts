import { FactShape, Command, CommandListener, MemoryFactStore, ConcurrencyError } from "@aminnairi/facts"
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

class AddTodoCommand implements Command<TodoAddedV1Fact> {
  public constructor(private readonly listeners: Set<CommandListener<TodoAddedV1Fact>> = new Set) { }

  public async send(fact: TodoAddedV1Fact): Promise<void | ConcurrencyError> {
    for (const listen of this.listeners) {
      const error = await listen(fact)

      if (error instanceof Error) {
        return error
      }
    }
  }

  public listen(listener: CommandListener<TodoAddedV1Fact>): void {
    this.listeners.add(listener)
  }
}

class RemoveTodoCommand implements Command<TodoRemovedV1Fact> {
  public constructor(private readonly listeners: Set<CommandListener<TodoRemovedV1Fact>> = new Set) { }

  public async send(fact: TodoRemovedV1Fact): Promise<void | ConcurrencyError> {
    for (const listen of this.listeners) {
      const error = await listen(fact)

      if (error instanceof Error) {
        return error
      }
    }
  }

  public listen(listener: CommandListener<TodoRemovedV1Fact>): void {
    this.listeners.add(listener)
  }
}

const addTodoCommand = new AddTodoCommand
const removeTodoCommand = new RemoveTodoCommand
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
