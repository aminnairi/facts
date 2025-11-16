import { MemoryFactStore } from "../.."

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

const factStore = new MemoryFactStore<TodoFact>

const error = await factStore.save({
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

const facts = await factStore.find()

console.log("List of facts")

for (const fact of facts) {
  console.log(JSON.stringify(fact))
}
