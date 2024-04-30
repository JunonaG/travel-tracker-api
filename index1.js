import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

const db = new pg.Client({
  user: process.env.DB_USERNAME,
  host: process.env.DB_HOST,
  database: process.env.DB_DB,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

async function checkVisitedCountries(userId) {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1;",
    [userId]
  );
  const countries = result.rows.map((country) => {
    return country.country_code;
  });
  return countries;
}

async function checkDuplicateUsers() {
  let users = [];
  const allUsersResult = await db.query("SELECT id, name, color FROM users;");
  let dbUsers = allUsersResult.rows;
  let nonDupUsers = dbUsers
    .map((obj) => {
      let isDup = users.some((item) => item.id === obj.id);
      return isDup ? null : obj;
    })
    .filter(Boolean);
  users.push(...nonDupUsers);
  return users;
}

//GET for all users
app.get("/users", async (req, res) => {
  try {
    const users = await checkDuplicateUsers();
    const usersNames = users.map((item) => {
      return item.name;
    });
    res.send(users);
    // console.log(usersNames);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

//GET for one user by userId
app.get("/users/id/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const users = await checkDuplicateUsers();
    const chosenUser = users.find((item) => {
      return item.id === Number(userId);
    });
    if (!chosenUser) {
      return res.status(404).send("User not found");
    }
    // console.log(chosenUser);
    res.send(chosenUser);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

//GET for one user by userName
app.get("/users/name/:userName", async (req, res) => {
  try {
    const userName = req.params.userName;
    const users = await checkDuplicateUsers();
    const chosenUser = users.find((item) => {
      return item.name === userName;
    });
    if (!chosenUser) {
      return res.status(404).send("User not found");
    }
    // console.log(chosenUser);
    res.send(chosenUser);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

//POST for new user

//POST for new country to user's list

//PUT for one user

//DELETE for one user

//GET countries by userId as that's already in the visited_countries table
app.get("/users/countries/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const users = await checkDuplicateUsers(userId);
    const userExists = users.find((user) => user.id === Number(userId));
    if (!userExists) {
      return res.status(404).send("User not found");
    }
    const countries = await checkVisitedCountries(userId);
    if (countries.length === 0) {
      return res.status(404).send("No countries visited");
    }
    console.log(countries);
    res.send(countries);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
