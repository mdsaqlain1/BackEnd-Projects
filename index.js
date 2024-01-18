import express from 'express'
const app = express();
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken'
import { config } from 'dotenv';
config();

app.use(express.json());

const authenticateJwt = (req, res, next) =>{
  const authHeaders = req.headers.authorization;
  const authKey = authHeaders.split(' ')[1];
  if(authKey){
    jwt.verify(authKey, SECRET, (err, user)=>{
      if(err){
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  }
}

let SECRET = process.env.SECRET_KEY;

const userSchema = new mongoose.Schema({
  username : String,
  password : String,
  purchasedCourses : [{ type : mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

const adminSchema = new mongoose.Schema({
  username : String,
  password : String
})

const courseSchema = new mongoose.Schema({
  title : String,
  description : String,
  price : Number,
  imageLink : String,
  published : Boolean
})

let Admin = mongoose.model('Admin', adminSchema);
let User = mongoose.model('User', userSchema);
let Course = mongoose.model('Course', courseSchema);



mongoose.connect(process.env.DB_URL, { dbName: "courses" })
  .then(() => {
    console.log("Connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

// Admin routes
app.post('/admin/signup', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (admin) {
    res.status(403).json({ message: "Admin Already Exists" });
  } else {
    const newAdmin = new Admin(req.body);
    newAdmin.save();
    const token = jwt.sign({ username, role: 'admin' }, SECRET, { expiresIn: "1hr" });
    res.json({ message: "Admin created succesfully", token });
  }
});

app.post('/admin/login', async (req, res) => {
  const {username, password} = req.body;
  const admin = await Admin.findOne({username, password});
  if(admin){
    const token = jwt.sign({username, role:"admin"}, SECRET, {expiresIn: '1hr'});
    res.json({message: "Admin logged in successfully", token});
  }else{
    res.json({message:"Admin not found"});
  }
});

app.post('/admin/courses', authenticateJwt, async (req, res) => {
  const course = new Course(req.body);
  await course.save();
  res.json({message : "Course created sucessfully", courseId : course.id});
});

app.put('/admin/courses/:courseId',authenticateJwt, async (req, res) => {
  const courseId = req.params.courseId;
  const course = await Course.findByIdAndUpdate(courseId, req.body);
  if(course){
    res.json({message : "Course updated successfully"});
  }else{
    res.json({message : "Course not found"});
  }
});

app.get('/admin/courses', authenticateJwt, async (req, res) => {
  const courses = await Course.find({});
  res.json({courses});
});

// User routes
app.post('/users/signup', async (req, res) => {
  const {username} = req.body;
  const user = await User.findOne({username});
  if(user){
    res.status(403).json({message : "User already exists"});
  }else{
    const newUser = new User(req.body);
    newUser.save();
    jwt.sign({newUser, role : 'user'}, SECRET, {expiresIn : '1hr'});
    res.json({message : "User created sucessfully"});
  }
});

app.post('/users/login', async (req, res) => {
  const {username, password} = req.body;
  const user = await User.findOne({username, password});
  if(user){
    jwt.sign({username, role : 'user'}, SECRET, {expiresIn : '1hr'});
    res.json({message : "User logged in sucessfully"});
  }else{
    res.status(403).json({message : "Invalid username or password"});
  }
});

app.get('/users/courses', authenticateJwt, async(req, res) => {
  const courses = await Course.find({published : true});
  res.json({courses});
});

app.post('/users/courses/:courseId', authenticateJwt, async(req, res) => {
  const course = await Course.findOne(req.params.courseId);
  if(course){
    const user = await User.findOne({username : req.user.username});
    if(user){
      user.purchasedCourses.push(course);
      await user.save();
      res.json({message : "Course purchases sucessfully"});
    }else{
      req.json({message : "User not found"});
    }
  }else{
    req.status(403).json({message : "Course not found"});
  }
});

app.get('/users/purchasedCourses', authenticateJwt, async (req, res) => {
  const user = await User.findOne({username}).populate('purchasedCourses');
  if(user){
    res.json({courses : user.purchasedCourses || []});
  }else{
    res.send(403).json({message : 'No course found'});
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server is listening on port ${process.env.PORT}`);
});