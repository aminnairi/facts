import { FactShape, MemoryFactStore } from "@aminnairi/facts"

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

const factStore = new MemoryFactStore<TodoFact>

const error = await factStore.save({
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

const facts = await factStore.find()

console.log("List of facts")

for (const fact of facts) {
  console.log(JSON.stringify(fact))
}
