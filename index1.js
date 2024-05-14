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

async function checkCountryExists(country) {
  const result = await db.query(
    "SELECT country_code FROM world_countries WHERE (country_name) ILIKE '%' || $1 || '%';",
    [country]
  );
  if (result.rows.length === 0) {
    return [];
  }
  const newCountry = result.rows[0];
  return newCountry;
}

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
    const result = await db.query("SELECT * FROM users WHERE id = $1;", [
      Number(userId),
    ]);
    const users = result.rows[0];
    if (!users) {
      return res.status(404).send("User not found");
    }
    res.send(users);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

//GET for one user by userName
app.get("/users/name/:userName", async (req, res) => {
  try {
    const userName = req.params.userName;
    const result = await db.query("SELECT * FROM users WHERE name = $1;", [
      userName,
    ]);
    const users = result.rows[0];
    if (!users) {
      return res.status(404).send("User not found");
    }
    console.log(users);
    res.send(users);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

//POST for new user
app.post("/users/newUser", async (req, res) => {
  try {
    const userName = req.body.name;
    const userColor = req.body.color;
    const newUser = await db.query(
      "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING id, name, color;",
      [userName, userColor]
    );
    console.log(newUser.rows);
    res.send(newUser.rows);
  } catch (error) {
    if (error.code === "23502") {
      return res.status(412).send("User name and color data required");
    }
    console.log(err);
    res.redirect("/");
  }
});

//GET countries by userId as that's already in the visited_countries table
app.get("/users/countries/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    //TODO: Only query countries by one user by id from database
    const users = await checkDuplicateUsers(userId);
    const userExists = users.find((user) => user.id === Number(userId));
    if (!userExists) {
      return res.status(404).send("User not found");
    }
    const countries = await checkVisitedCountries(userId);
    if (countries.length === 0) {
      return res.status(404).send("No countries visited");
    }
    // console.log(countries);
    res.send(countries);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

//POST for new country to user's list
app.post("/users/newCountry", async (req, res) => {
  try {
    const userId = req.body.id;
    const userCountryInput = req.body.country;
    const country = userCountryInput.toLowerCase();
    const newCountry = await checkCountryExists(country);
    const addCountry = await db.query(
      "INSERT INTO visited_countries (user_id, country_code) values ($1, $2) RETURNING user_id, country_code;",
      [userId, newCountry.country_code]
    );
    console.log(addCountry.rows);
    res.send(addCountry.rows);
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(412)
        .send("This country already exists in your list of visited countries");
    }
    console.log(err);
    res.redirect("/");
  }
});

//PUT for a user's name identified by userId
app.put("/users/id/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const oldName = req.body.name;
    const newName = req.body.newName;
    const changeName = await db.query(
      "UPDATE users SET name = $1 WHERE name = $2 AND id = $3 RETURNING *;",
      [newName.toString(), oldName.toString(), Number(userId)]
    );
    console.log(changeName.rows);
    res.send(changeName.rows);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

//PUT for a user's color identified by userId
app.put("/users/color/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const newColor = req.body.color;
    const changeColor = await db.query(
      "UPDATE users SET color = $1 WHERE id = $2 RETURNING *;",
      [newColor.toString(), Number(userId)]
    );
    console.log(changeColor.rows);
    res.send(changeColor.rows);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

//No need for a user's countries PUT as it would be easier to delete the country and re-add it

//DELETE for one user's complete information by userId
app.delete("/users/id/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const deleteUser = await db.query("DELETE FROM users WHERE id = $1;", [
      userId,
    ]);
    res.send("User successfully deleted.");
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

//DELETE for one user's country by userId
app.delete("/users/countries/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const country = req.body.country;
    const capitalizedCountry =
      country.charAt(0).toUpperCase() + country.slice(1);
    const result = await db.query(
      "SELECT country_code FROM world_countries WHERE country_name = $1;",
      [capitalizedCountry]
    );
    if (!result.rows.length) {
      res.status(404).send("The country doesn't exist.");
    }
    const countryResult = result.rows[0];
    const countryCode = countryResult.country_code;
    const checkIfInUserVisitedCountriesList = await db.query(
      "SELECT * FROM visited_countries WHERE user_id = $1 AND country_code = $2;",
      [Number(userId), countryCode.trim()]
    );
    if (!checkIfInUserVisitedCountriesList.rows.length) {
      return res
        .status(404)
        .send(
          "Country cannot be deleted as it's not in the visited countries list."
        );
    }
    const deleteCountry = await db.query(
      "DELETE FROM visited_countries WHERE user_id = $1 AND country_code = $2",
      [Number(userId), countryCode.trim()]
    );
    console.log(deleteCountry);
    res.send("Country successfully deleted.");
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
