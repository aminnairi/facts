import { randomUUID } from "crypto";
import { type FactShape, ParseError, SqliteFactStore } from "@aminnairi/facts";
import { z, ZodType } from "zod"

const todoAddedV1FactSchema = z.object({
  name: z.literal("todo-added"),
  identifier: z.string(),
  position: z.number(),
  version: z.literal(1),
  date: z.coerce.date(),
  streamName: z.literal("todo"),
  streamIdentifier: z.string(),
  payload: z.object({
    name: z.string(),
    done: z.boolean()
  })
}) satisfies ZodType<FactShape>

const todoRemovedV1FactSchema = z.object({
  name: z.literal("todo-removed"),
  date: z.coerce.date(),
  identifier: z.string(),
  position: z.number(),
  version: z.literal(1),
  payload: z.null(),
  streamName: z.literal("todo"),
  streamIdentifier: z.string()
}) satisfies ZodType<FactShape>

const todoSnapshotV1FactSchema = z.object({
  name: z.literal("todo-snapshot"),
  date: z.coerce.date(),
  identifier: z.string(),
  position: z.number(),
  version: z.literal(1),
  streamName: z.literal("todo"),
  streamIdentifier: z.string(),
  payload: z.object({
    name: z.string(),
    done: z.boolean()
  })
}) satisfies ZodType<FactShape>

const todoFactSchema = z.union([
  todoAddedV1FactSchema,
  todoRemovedV1FactSchema,
  todoSnapshotV1FactSchema
])

type TodoFact = z.infer<typeof todoFactSchema>

const factStore = SqliteFactStore.for<TodoFact>(":memory:", {
  parser: fact => {
    const validation = todoFactSchema.safeParse(fact)

    if (validation.success) {
      return validation.data
    }

    return new ParseError(validation.error.message)
  }
})
const streamIdentifier = randomUUID()

await factStore.save({
  streamName: "todo",
  streamIdentifier: streamIdentifier,
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
  streamName: "todo",
  streamIdentifier: streamIdentifier,
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
  streamName: "todo",
  streamIdentifier: streamIdentifier,
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

if (facts instanceof Error) {
  console.error(facts)
  process.exit(1)
}

console.log("List of facts stored")

for (const fact of facts) {
  console.log(fact)
}
