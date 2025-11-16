import { randomUUID } from "crypto";
import { SqliteFactStore } from "../..";

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

const factStore = new SqliteFactStore<TodoFact>()
const aggregateIdentifier = randomUUID()

await factStore.save({
  aggregate: "todo",
  aggregateIdentifier,
  identifier: randomUUID(),
  date: new Date(),
  name: "todo-added",
  sequence: 0,
  version: 1,
  data: {
    done: false,
    name: "Do the dishes"
  }
})

await factStore.save({
  aggregate: "todo",
  aggregateIdentifier,
  date: new Date(),
  identifier: randomUUID(),
  name: "todo-removed",
  sequence: 1,
  version: 1,
  data: null
})

const facts = await factStore.find()

console.log("List of facts stored")

for (const fact of facts) {
  console.log(fact)
}
