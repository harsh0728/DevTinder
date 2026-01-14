const mongoose = require("mongoose");

const connectionRequestSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    status: {
      type: String,
      enum: ["ignored", "interested", "accepted", "rejected"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/* ================= Index ================= */
// Prevent duplicate requests
connectionRequestSchema.index(
  { fromUserId: 1, toUserId: 1 },
  { unique: true }
);

/* ================= Validation ================= */
// connectionRequestSchema.pre("save", function (next) {
//   if (this.fromUserId.equals(this.toUserId)) {
//     return next(
//       new Error("You cannot send a connection request to yourself")
//     );
//   }
//   next();
// });

module.exports = mongoose.model(
  "ConnectionRequest",
  connectionRequestSchema
);
