const express = require("express");
require('dotenv').config();
const cors = require("cors");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

//middleware
// send from server side. otherwise cookie er policy same domain e kaj kore different port hoar jonno send korbe na.
app.use(cors({
  origin:['http://localhost:5173'],//single value ba array thakte pare production e jawar somoi falai dite hobe
  credentials:true //client side e cookie gula jabe
}));
app.use(express.json());
app.use(cookieParser()); //use cookieParser as a middleware to read cookie inside backend

const uri = "mongodb://0.0.0.0:27017/";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri);

// middlewares made by us
const logger = async(req,res,next)=>{
  console.log('called:',req.host,req.originalUrl)
  next();
}

const verifyToken = async(req,res,next)=>{
  const token = req.cookies?.token;
  console.log('value of token in middleware',token);
  if (!token) {
    return res.status(401).send({message:'unauthorized'})
  }
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    //error
    if (err) {
      console.log(err);
      return res.status(401).send({message:'unauthorized access'})
    }

    //if token is valid then it would be decoded
    console.log('value of the token',decoded)
    req.user = decoded;// req.user, req er por j kono name dilei hoi
    next();
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingCollection = client.db("carDoctor").collection("bookings");
    //auth related api
    app.post('/jwt',logger,async(req,res)=>{
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'})
      
      // set cookie
      res
      .cookie('token',token,{
        httpOnly:true,
        secure:false, // http://localhost:5173/login
        // sameSite:'none' // client port 5173 , server 5000 port
      })
      .send({success:true});
      // res.send(token)

    })
    
    //services related api
    app.get("/services",logger, async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {
        // Sort matched documents in descending order by rating
        //   sort: { "price": -1 },

        // Include only the `title` and `imdb` fields in the returned document
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };

      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    //bookings

    app.get("/bookings", logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log('tok tok token',req.cookies.token)
      console.log('user in the valid token',req.user)
      if (req.query.email !== req.user.email) {
        return res.status(403).send({message:'forbidden access'})
      }


      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });


    app.patch('/bookings/:id',async(req,res)=>{
        const id = req.params.id;
        const filter = {_id:new ObjectId(id)};
        const updatedBooking = req.body;
        console.log(updatedBooking);
        const updateDoc ={
            $set:{
                status:updatedBooking.status
            }
        }
        const result = await bookingCollection.updateOne(filter,updateDoc)
        res.send(result);
        
    })


    app.delete('/bookings/:id',async(req,res)=>{
        const id = req.params.id;
        const query = {_id:new ObjectId(id)}
        const result = await bookingCollection.deleteOne(query);
        res.send(result);
    })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("doctor is running");
});

app.listen(port, () => {
  console.log(`Port is running on ${port}`);
});
