export interface ParsedRequest {
  intentId?: string;
  origin: string;
  destination: string;
  date: string;
  isValid?: boolean;
  errorMessage?: string | null;
}

export interface FlightOption {
  id: string;
  cost: number;
  airline: string;
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "REJECTED_INVALID_INPUT";

export interface TravelStateType {
  intentId: string;
  userInput: string;
  parsedRequest: ParsedRequest;
  maxBudget: number;
  flightOptions: FlightOption[];
  approvalStatus: string;
  finalBookingId: string | null;
  error?: string | null;
}

