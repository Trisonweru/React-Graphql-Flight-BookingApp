const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const flightSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("Flight", flightSchema);
