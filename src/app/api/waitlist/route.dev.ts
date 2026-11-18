import { handleWaitlist } from "@/lib/waitlist";
import { createWaitlistMock } from "@/lib/waitlist-mock";

// Next development only (next.config.ts). Never connects to D1 or sends email.
const mock = createWaitlistMock();
export const POST = (request: Request) => handleWaitlist(request, mock);
export const GET = (request: Request) => handleWaitlist(request, mock);
