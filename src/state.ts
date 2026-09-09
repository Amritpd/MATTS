import { Annotation } from "@langchain/langgraph";
import { ParsedRequest, FlightOption } from "./types.js";

/**
 * Centralized State Object defining the shared agent data bus.
 * Agents are isolated and communicate only by reading/mutating this State.
 */
/**
 * Pure policy reducer: Once corporate policy is established, downstream nodes cannot overwrite or raise the cap.
 */
export function maxBudgetReducer(prev: number, next: number): number {
  return prev > 0 ? prev : next;
}

export const TravelStateAnnotation = Annotation.Root({
  intentId: Annotation<string>({
    reducer: (prev, next) => next || prev,
    default: () => "",
  }),
  userInput: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  parsedRequest: Annotation<ParsedRequest>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({ intentId: "", origin: "", destination: "", date: "" }),
  }),
  maxBudget: Annotation<number>({
    reducer: maxBudgetReducer,
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


