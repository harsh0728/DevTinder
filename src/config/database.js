// const mongoose = require("mongoose");

// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI, //{autoIndex: true,}
//     );
//     console.log("MongoDB connected");
//   } catch (error) {
//     console.error("MongoDB connection failed:", error.message);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;

// Updated one

const mongoose = require("mongoose");

// 1. Clean, reusable delay helper
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 2. The core connection wrapper (removes process.exit so it can retry!)
const connect = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected successfully!");
};

// 3. The orchestration function handling the retry mechanism
const connectDB = async (retries = 3, delay = 2000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Try to connect
      await connect();
      return; // Connection succeeded! Exit the whole function early.
    } catch (error) {
      console.error(`MongoDB attempt ${attempt} failed:`, error.message);

      // If we are on the very last attempt and it still fails, crash the app safely
      if (attempt === retries) {
        console.error("All database retry attempts exhausted. Exiting application...");
        process.exit(1); 
      }

      // Pause before running the next loop iteration
      console.log(`Waiting ${delay}ms before next retry...`);
      await wait(delay);
    }
  }
};

module.exports = connectDB;
