const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
app.use(express.json())

const dbPath = path.join(__dirname, 'syoft.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

//Register User API
app.post('/users/', async (request, response) => {
  const {user_firstname, user_email, user_phone, user_password, role} =
    request.body
  const hashedPassword = await bcrypt.hash(request.body.user_password, 10)
  const selectUserQuery = `SELECT * FROM user WHERE user_firstname = '${user_firstname}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (user_firstname, user_email, user_phone, user_password, role) 
      VALUES 
        (
          '${user_firstname}', 
          '${user_email}',
          '${user_phone}', 
          '${hashedPassword}',
          '${role}'
        )`
    const dbResponse = await db.run(createUserQuery)
    const newUserId = dbResponse.lastID
    response.send(`Created new user with ${newUserId}`)
  } else {
    response.status = 400
    response.send('User already exists')
  }
})

//login
app.post('/login', async (request, response) => {
  const {user_firstname, user_password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE user_firstname = '${user_firstname}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid User')
  } else {
    const isPasswordMatched = await bcrypt.compare(
      user_password,
      dbUser.user_password,
    )
    if (isPasswordMatched === true) {
      const payload = {
        user_firstname: user_firstname,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid Password')
    }
  }
})

//API with token authentication
app.get('/userdetails/', (request, response) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid Access Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.send('Invalid Access Token')
      } else {
        const getuserdetailsQuery = `
            SELECT
              *
            FROM
             User;`
        const userDetailsArray = await db.all(getuserdetailsQuery)
        response.send(userDetailsArray)
      }
    })
  }
})
