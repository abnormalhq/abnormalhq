/** Test-only boundary for Worker entry tests. OpenNext is generated after tests, not checked in. */
const handler = {
  fetch(): Promise<Response> {
    throw new Error("This API request must not reach OpenNext");
  },
};
export default handler;
