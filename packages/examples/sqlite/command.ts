import { type FactShape, type FactStore, SqliteFactStore, ParseError } from "@aminnairi/facts"
import { randomUUID } from "crypto"
import { z, ZodType } from "zod";

const todoAddedV1FactSchema = z.object({
  date: z.coerce.date(),
  identifier: z.string(),
  name: z.literal("todo-added"),
  position: z.number(),
  streamIdentifier: z.string(),
  streamName: z.literal("todo"),
  version: z.literal(1),
  payload: z.object({
    name: z.string(),
    done: z.boolean(),
  }),
}) satisfies ZodType<FactShape>;

const todoRemovedV1FactSchema = z.object({
  date: z.coerce.date(),
  identifier: z.string(),
  name: z.literal("todo-removed"),
  position: z.number(),
  streamIdentifier: z.string(),
  streamName: z.literal("todo"),
  version: z.literal(1),
  payload: z.null(),
}) satisfies ZodType<FactShape>;

const todoFactSchema = z.union([
  todoAddedV1FactSchema,
  todoRemovedV1FactSchema,
]);

type TodoAddedV1Fact = z.infer<typeof todoAddedV1FactSchema>;
type TodoRemovedV1Fact = z.infer<typeof todoRemovedV1FactSchema>;
type TodoFact = TodoAddedV1Fact | TodoRemovedV1Fact;

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

const factStore = SqliteFactStore.for(":memory:", {
  parser: fact => {
    const validation = todoFactSchema.safeParse(fact);

    if (!validation.success) {
      return new ParseError(validation.error.message);
    }

    return validation.data;
  }
})

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
