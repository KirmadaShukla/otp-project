const express = require("express");
const cors = require("cors");
require("dotenv").config();
const databaseConnection = require("./db/databaseConnection");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/home", (req, res) => {
  res.send("Welcome to Home!");
});
app.use("/auth", require("./routes/routes"));

databaseConnection().then(() => {
  app.listen(process.env.BACKEND_PORT, () => {
    console.log(`SERVER IS LISTENING AT ${process.env.BACKEND_PORT}`);
  });
});
