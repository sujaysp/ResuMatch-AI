import { env } from "./config/env.js";
import app from "./app.js";

import {
  connectDB,
  disconnectDB,
} from "./config/db.js";

// Start the application.
const startServer = async () => {
  try {
    // First connect to MongoDB.
    await connectDB();

    // Start Express only after successful DB connection.
    const server = app.listen(env.PORT, () => {
      console.log("------------------------------------");
      console.log("       ResuMatch AI Backend");
      console.log("------------------------------------");
      console.log(`Server running on port ${env.PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
      console.log(
        `Health: http://localhost:${env.PORT}/api/health`
      );
      console.log("------------------------------------");
    });

    // Prevent multiple shutdown operations.
    let isShuttingDown = false;

    // Gracefully shut down the application.
    const shutdown = (signal) => {
      if (isShuttingDown) return;

      isShuttingDown = true;

      console.log(`\n${signal} received. Shutting down...`);

      server.close(async (error) => {
        try {
          if (error) {
            throw error;
          }

          await disconnectDB();

          console.log("Server closed successfully.");
          process.exit(0);

        } catch (shutdownError) {
          console.error(
            "Shutdown error:",
            shutdownError.message
          );

          process.exit(1);
        }
      });
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));

  } catch (error) {
    console.error(
      "Unable to start ResuMatch AI:",
      error.message
    );

    process.exit(1);
  }
};

startServer();