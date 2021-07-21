const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const { graphqlHTTP } = require("express-graphql");
const { buildSchema } = require("graphql");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

//importing mongoose models
const Flight = require("./models/flights");
const User = require("./models/users");
const Booking = require("./models/bookings");

//import the midleware to check for every incoming request if user is authenticated
const isAuth = require("./middleware/is-auth");

const app = express();
app.use(express.json());
app.use(isAuth);
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
//dynamic relationships
const singleFlight = async (flightID) => {
  try {
    const flight = await Flight.findById(flightID);
    return {
      ...flight._doc,
      _id: flight.id,
    };
  } catch (err) {
    throw err;
  }
};

const singleUser = async (userID) => {
  try {
    const user = await User.findById(userID);
    return {
      ...user._doc,
      _id: user.id,
    };
  } catch (err) {
    throw err;
  }
};

app.use(
  "/graphql",
  graphqlHTTP({
    schema: buildSchema(`
        type Booking{
            _id:ID!
            user:User!
            flight:Flight!
            createdAt:String!
            updatedAt:String!
        }
        type Flight{
            _id: ID!
            name:String!
            description:String!
            price:String!
            date:String!
        }
        type User{
            _id:ID!
            email: String!
            password:String
        }
        type AuthData{
            userId:ID!
            token:String!
            tokenExpiration:Int! 
        }       
        input FlightInput{
            name:String!
            description:String!
            price:String!
            date:String!
        }
        input UserInput{
            email: String!
            password:String!
        }
         type RootQuery{
            flights:[Flight!]!
            users:[User!]!
            bookings:[Booking!]!
            login(email: String, password:String!):AuthData!
        }
        type RootMutation{
            createFlight(flightInput:FlightInput):Flight
            createUser(userInput:UserInput):User
            bookFlight(flightID:ID!): Booking!
            cancelBooking(bookingID:ID!): Booking!      
        }
        schema{
            query:RootQuery
            mutation:RootMutation
        }
    `),
    rootValue: {
      flights: () => {
        return Flight.find()
          .then((flights) => {
            return flights.map((flight) => {
              return { ...flight._doc };
            });
          })
          .catch((err) => {
            console.log(err);
            throw err;
          });
      },
      createFlight: (args, req) => {
        if (!req.isAuth) {
          throw new Error("Not authenticated.");
        }
        const flight = new Flight({
          name: args.flightInput.name,
          description: args.flightInput.description,
          price: +args.flightInput.price,
          date: new Date(args.flightInput.date),
        });
        flight
          .save()
          .then((result) => {
            console.log(result);
            return { ...result._doc, _id: result.id };
          })
          .catch((err) => {
            console.log(err);
            throw err;
          });
      },
      bookings: async (args, req) => {
        if (!req.isAuth) {
          throw new Error("Not authenticated.");
        }
        const bookings = await Booking.find({ user: req.userId });
        return bookings.map((booking) => {
          return {
            ...booking._doc,
            _id: booking.id,
            user: singleUser.bind(this, booking._doc.user),
            flight: singleFlight.bind(this, booking._doc.flight),
            createdAt: new Date(booking._doc.createdAt).toISOString(),
            updatedAt: new Date(booking._doc.updatedAt).toISOString(),
          };
        });
      },
      createUser: (args) => {
        return User.findOne({ email: args.userInput.email })
          .then((user) => {
            if (user) {
              throw new Error("The user already exists");
            }
            return bcrypt.hash(args.userInput.password, 12);
          })
          .then((hashedPass) => {
            const user = new User({
              email: args.userInput.email,
              password: hashedPass,
            });
            return user.save();
          })

          .then((result) => {
            console.log(result);
            return { ...result._doc, _id: result.id, password: null };
          })
          .catch((err) => {
            console.log(err);
            throw err;
          });
      },
      bookFlight: async (args, req) => {
        if (!req.isAuth) {
          throw new Error("Not authenticated.");
        }
        const fetchedFlight = await Flight.findOne({ _id: args.flightID });
        const booking = new Booking({
          user: req.userId,
          flight: fetchedFlight,
        });

        const result = await booking.save();
        return {
          ...result._doc,
          _id: result.id,
          user: singleUser.bind(this, result._doc.user),
          flight: singleFlight.bind(this, result._doc.flight),
          createdAt: new Date(result._doc.createdAt).toISOString(),
          updatedAt: new Date(result._doc.updatedAt).toISOString(),
        };
      },
      cancelBooking: async (args, req) => {
        if (!req.isAuth) {
          throw new Error("Not authenticated.");
        }
        const booking = await Booking.findById(args.bookingID);
        const result = {
          ...booking.flight,
          flight: singleFlight.bind(this, booking.flight),
        };
        await Booking.deleteOne({ _id: args.bookingID });
        return result;
      },
      login: async ({ email, password }) => {
        const user = await User.findOne({ email: email });
        if (!user) {
          throw new Error("Invalid credentials. Please try again!");
        }
        const isEqual = await bcrypt.compare(password, user.password);
        if (!isEqual) {
          throw new Error("Invalid credentials. Please try again!");
        }
        const token = await jwt.sign(
          { userId: user.id, email: user.email },
          "thisissupposedtobemysecret",
          {
            expiresIn: "1h",
          }
        );
        return { userId: user.id, token: token, tokenExpiration: 1 };
      },
    },

    graphiql: true,
  })
);
mongoose
  .connect(
    `mongodb+srv://Waweru:${process.env.PASSWORD}@cluster0.qcdgk.mongodb.net/flightBookingDB?retryWrites=true&w=majority`
  )
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`The server is running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
