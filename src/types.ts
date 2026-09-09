export interface ParsedRequest {
  intentId?: string;
  origin: string;
  destination: string;
  date: string;
}

export interface FlightOption {
  id: string;
  cost: number;
  airline: string;
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TravelStateType {
  intentId: string;
  userInput: string;
  parsedRequest: ParsedRequest;
  maxBudget: number;
  flightOptions: FlightOption[];
  approvalStatus: string;
  finalBookingId: string | null;
}

