import { Annotation } from "@langchain/langgraph";
import { ParsedRequest, FlightOption } from "./types.js";

/**
 * Centralized State Object defining the shared agent data bus.
 * Agents are isolated and communicate only by reading/mutating this State.
 */
export const TravelStateAnnotation = Annotation.Root({
  userInput: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  parsedRequest: Annotation<ParsedRequest>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({ origin: "", destination: "", date: "" }),
  }),
  maxBudget: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  flightOptions: Annotation<FlightOption[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  approvalStatus: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "PENDING",
  }),
  finalBookingId: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

export type TravelState = typeof TravelStateAnnotation.State;
