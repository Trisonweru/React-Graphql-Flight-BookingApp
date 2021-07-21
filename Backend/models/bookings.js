const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const bookingSchema = new Schema(
  {
    flight: {
      type: Schema.Types.ObjectId,
      ref: "Flight",
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
