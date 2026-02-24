import { type FactShape, MemoryCommand, SqliteFactStore, ParseError } from "@aminnairi/facts"
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

const addTodoCommand = new MemoryCommand<TodoAddedV1Fact>
const removeTodoCommand = new MemoryCommand<TodoRemovedV1Fact>

const factStore = SqliteFactStore.for(":memory:", {
  parser: fact => {
    const validation = todoFactSchema.safeParse(fact);

    if (!validation.success) {
      return new ParseError(validation.error.message);
    }

    return validation.data;
  }
})

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
