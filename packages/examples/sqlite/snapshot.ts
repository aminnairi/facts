import { randomUUID } from "crypto";
import { SqliteFactStore } from "@aminnairi/facts";

interface TodoAddedV1Fact {
  name: "todo-added"
  identifier: string
  position: number
  version: 1
  stream: {
    name: "todo"
    identifier: string
  }
  date: Date
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

interface TodoSnapshotV1Fact {
  name: "todo-snapshot"
  date: Date
  identifier: string
  position: number
  version: 1
  stream: {
    name: "todo"
    identifier: string
  }
  payload: {
    name: string
    done: boolean
  }
}

type TodoFact =
  | TodoAddedV1Fact
  | TodoRemovedV1Fact
  | TodoSnapshotV1Fact

const factStore = new SqliteFactStore<TodoFact>(":memory:")
const streamIdentifier = randomUUID()

await factStore.save({
  stream: {
    name: "todo",
    identifier: streamIdentifier
  },
  identifier: randomUUID(),
  date: new Date(),
  name: "todo-added",
  position: 0,
  version: 1,
  payload: {
    done: false,
    name: "Do the dishes"
  }
})

await factStore.save({
  stream: {
    name: "todo",
    identifier: streamIdentifier
  },
  identifier: randomUUID(),
  date: new Date(),
  name: "todo-snapshot",
  position: 1,
  version: 1,
  payload: {
    name: "Do the dishes",
    done: false
  }
})

await factStore.save({
  stream: {
    name: "todo",
    identifier: streamIdentifier
  },
  date: new Date(),
  identifier: randomUUID(),
  name: "todo-removed",
  position: 2,
  version: 1,
  payload: null
})

const facts = await factStore.findFromLast(fact => {
  return fact.name === "todo-snapshot"
})

console.log("List of facts stored")

for (const fact of facts) {
  console.log(fact)
}
