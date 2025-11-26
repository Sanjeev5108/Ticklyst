import serverless from "serverless-http";

import { createServer } from "../../server";

// Enable binary responses for Excel and other binary content to prevent corruption
export const handler = serverless(createServer(), {
  binary: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
    "application/zip",
  ],
});
