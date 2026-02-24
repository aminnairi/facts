import { type FactShape, ParseError, SqliteFactStore } from "@aminnairi/facts";
import { z, ZodType } from "zod";
import { exhaustive } from "exhaustive";

const userCreatedV1FactSchema = z.object({
  date: z.coerce.date(),
  identifier: z.string(),
  name: z.literal("user-created"),
  position: z.number(),
  streamIdentifier: z.string(),
  streamName: z.literal("user"),
  version: z.literal(1),
  payload: z.object({
    username: z.string()
  }),
}) satisfies ZodType<FactShape>;

const expenseCreatedV1FactSchema = z.object({
  date: z.coerce.date(),
  identifier: z.string(),
  name: z.literal("expense-created"),
  position: z.number(),
  streamIdentifier: z.string(),
  streamName: z.literal("expense"),
  version: z.literal(1),
  payload: z.object({
    amount: z.number()
  }),
}) satisfies ZodType<FactShape>;

const factSchema = z.union([
  userCreatedV1FactSchema,
  expenseCreatedV1FactSchema
]);

export const store = SqliteFactStore.for(":memory:", {
  parser: fact => {
    const validation = factSchema.safeParse(fact);

    if (!validation.success) {
      return new ParseError(validation.error.message);
    }

    return validation.data;
  }
});

const userFacts = await store.find((fact) => {
  return fact.streamName === "user";
});

if (userFacts instanceof Error) {
  console.error("Failed to retrieve user facts");
  process.exit(1);
}

const expenseFacts = await store.find(fact => {
  return fact.streamName === "expense"
});

if (expenseFacts instanceof Error) {
  console.error("Failed to retrieve expense facts");
  process.exit(1);
}

userFacts.forEach(userFact => {
  exhaustive(userFact.name, {
    "user-created": () => {
      console.log("User created fact");
    }
  });
})

expenseFacts.forEach(expenseFact => {
  exhaustive(expenseFact.name, {
    "expense-created": () => {
      console.log("Expense created fact");
    }
  });
})
