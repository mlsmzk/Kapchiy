// start app with 'node server.js' or 'npm run dev' in a terminal window
// go to http://localhost:port/ to view your deployment!
// every time you change something in server.js and save, your deployment will automatically reload

// to exit, type 'ctrl + c', then press the enter key in a terminal window
// if you're prompted with 'terminate batch job (y/n)?', type 'y', then press the enter key in the same terminal

// standard modules, loaded from node_modules
const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const express = require('express');
const morgan = require('morgan');
const serveStatic = require('serve-static');
const bodyParser = require('body-parser');
const flash = require('express-flash');
const cookieSession = require('cookie-session');
const multer = require('multer');


// our modules loaded from cwd

const { Connection } = require('./connection');
const cs304 = require('./cs304');
const filefns = require('./file');

// Create and configure the app

const app = express();

// Morgan reports the final status code of a request's response
app.use(morgan('tiny'));

app.use(cs304.logStartRequest);

// This handles POST data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cs304.logRequestData);  // tell the user about any request data
app.use(flash()); // Use flash messages for the case where users' queries do not match any results in the database.
app.use(serveStatic('public'));
app.set('view engine', 'ejs');

app.use(cookieSession({
    name: 'session',
    keys: [cs304.randomString(20)],
    maxAge: 24* 60 * 60 * 1000// 24 hours
  }))


// app.use('/uploads', express.static('uploads'));

/* Functions for file uploading and security */
function timeString(dateObj) {
    if( !dateObj) {
        dateObj = new Date();
    }
    d2 = (val) => val < 10 ? '0'+val : ''+val;
    let hh = d2(dateObj.getHours())
    let mm = d2(dateObj.getMinutes())
    let ss = d2(dateObj.getSeconds())
    return hh+mm+ss
}

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads')
  },
  filename: function (req, file, cb) {
      let parts = file.originalname.split('.');
      let ext = parts[parts.length-1];
      let hhmmss = timeString();
      cb(null, file.fieldname + '-' + hhmmss + '.' + ext);
  }
})
var upload = multer({ storage: storage,
                      // max fileSize in bytes
                      limits: {fileSize: 1_000_000 }});


// collections in the user's personal database


const mongoUri = cs304.getMongoUri();

// ================================================================
// custom routes here

// Use these constants and mispellings become errors
const kdb = "kapchiydb";
const FILEOWNERS = 'fileOwners';
const POSTS = "posts";
const USERS = "users";

// Function for inserting posts: createPost.Post()
const createPost = require('./createPost');
const fileName = require('./file.js');

// main page. just has links to two other pages
app.get('/', async (req, res) => {
    const db = await Connection.open(mongoUri, kdb);
    const allPosts = await db.collection(POSTS).find().toArray();
    return res.render('index.ejs', {
                                    userPosts : allPosts});
});

/* app.get('/posts' , async (req,res) => {
    const db = await Connection.open(mongoUri, kdb);
    const allPosts = await db.collection(POSTS).find().toArray();
    return res.render('posts.ejs', {postDesc  : "All Posts",
                                    userPosts : allPosts});
}); */

//userpage with specific id
app.get('/userpage/:userId', async (req,res)=> {
    const db = await Connection.open(mongoUri, kdb);
    const username = req.session.username;
    if (!username) {
        console.log("not logged in");
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    }
    const uploads = await db.collection(FILESOWNED).find({owner: username}).toArray();
    const users = await db.collection(FILEOWNERS).find({}).toArray();
    const userId = req.session.userId;
    return res.render('userpage.ejs', {username, userId, users, uploads});
});

app.get('/posts/:postid', async (req, res) => {
    let id = req.query.postid;
    const db = await Connection.open(mongoUri, kdb);
    let posts = db.collection(POSTS);
    let check = await posts.find().toArray();
    console.log("check", check);
    let postResult = await posts.find({"postId" : parseInt(id)}).toArray();
    console.log(postResult);
    return res.render('post.ejs', {post: postResult});
});

app.get('/search/', (req, res) => {
    let term = req.query.term
    console.log('query' , req.query);
    return res.redirect('/search/' + term);
});

app.get('/search/:term', async (req, res) => {
    let term = req.params.term;
    const db = await Connection.open(mongoUri, kdb);
    console.log("term", term);
    const posts = db.collection(POSTS);
    const reg = new RegExp(term, "i");
    let regString = reg.toString();
    regString = regString.slice(1, regString.length - 2);
    let matches = await posts.find({tags: reg}).toArray();
    console.log("match found:", matches);
    return res.render('posts.ejs', {postDesc : "Posts matching " + regString,
                                    userPosts: matches});
});

app.get('/create', (req, res) => {
    return res.render('create.ejs');
})

app.post('/create', upload.single('photo'), async (req, res) => {
    // const username = req.session.username;
    const username = "miles";
    if (!username) {
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    }
    let tagString = req.body.tags.replaceAll("\\s", "");
    console.log('uploaded data', req.body);
    console.log('file', req.file);
    // insert file data into mongodb
    const db = await Connection.open(mongoUri, kdb);
    const result = await db.collection(POSTS)
          .insertOne({title: req.body.title,
                      owner: username,
                      path: '/uploads/'+req.file.filename,
                      caption: req.body.caption,
                      tags: tagString});
    console.log('insertOne result', result);
    // always nice to confirm with the user
    req.flash('info', 'file uploaded');
    return res.redirect('/');
});

// // ================================================================
// // postlude

// Route for getting images/other files from uploads
app.get('/uploads/:file', async (req, res) => {
    const filename = req.params.file;
    console.log('getting', filename);
    // const username = req.session.username;
    // if (!username) {
    //     req.flash('info', "You are not logged in");
    //     return res.redirect('/login');
    // }
    const db = await Connection.open(mongoUri, kdb);
    const pathname = '/uploads/'+filename;
    const fileDoc = await db.collection(POSTS).findOne({path: pathname});
    if(!fileDoc) {
        console.log("no such file");
        req.flash('error', "No such file");
        return res.redirect('/');
    }
    // if(!isAuthorizedToView(username, fileDoc.owner)) {
    //     console.log("not authorized");
    //     req.flash('info', "You are not authorized to view this file")
    //     return res.redirect('/myphotos');
    // }
    return res.sendFile(path.join(__dirname, pathname));
});

// Error route, belongs at end of code
app.use((err, req, res, next) => {
    console.log('error', err);
    if(err.code === 'LIMIT_FILE_SIZE') {
        console.log('file too big')
        req.flash('error', 'file too big')
        res.redirect('/')
    } else {
        console.error(err.stack)
        res.status(500).send('Something broke!')
    }
})

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function() {
    console.log(`listening on ${serverPort}`);
    console.log(`visit http://cs.wellesley.edu:${serverPort}/`);
    console.log(`or http://localhost:${serverPort}/`);
    console.log('^C to exit');
});
