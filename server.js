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
const { userAgentMiddleware } = require('@aws-sdk/middleware-user-agent');

// Create and configure the app

const app = express();
const { createHash } = require('crypto'); // For use in function for hashing postId
const { MongoBulkWriteError } = require('mongodb');
const { update } = require('lodash');


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

  app.use(function(req, res, next) {
    res.locals.username = req.session.username;
    next();
  });
  
// app.use('/uploads', express.static('uploads'));

function hash(string) {
    return createHash('sha256').update(string).digest('hex');
  }

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

bcrypt = require('bcrypt');
salt = bcrypt.genSaltSync();
// collections in the user's personal database


const mongoUri = cs304.getMongoUri();

// ================================================================
// custom routes here

// Use these constants and mispellings become errors
const kdb = "kapchiydb";
const FILEOWNERS = 'fileOwners';
const POSTS = "posts";
const USERS = "users";

// main page. just has links to two other pages
app.get('/', async (req, res) => {
    const username = req.session.username;
    console.log("session username", username);
    if (!username) {
        // Not logged in / signed up case
        console.log("not logged in");
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    } else {
        // Signed in case
        const db = await Connection.open(mongoUri, kdb);
        const allPosts = await db.collection(POSTS).find().toArray();
        return res.render('index.ejs', {
                                    username : username,
                                    userPosts : allPosts});
    }
});



/* app.get('/posts' , async (req,res) => {
    const db = await Connection.open(mongoUri, kdb);
    const allPosts = await db.collection(POSTS).find().toArray();
    return res.render('posts.ejs', {postDesc  : "All Posts",
                                    userPosts : allPosts});
}); */

app.get('/login',(req,res) => {
    return res.render('login.ejs');
});

app.get('/logout',(req,res) => {
    console.log("req.session: ", req.session);
    req.session.username = null;
    req.session.userId = null;
    req.flash('info',
                  "You have been successfully logged out.");
    return res.redirect('/login');
});

app.post('/register', async (req,res) => {
    const username = req.body.username;
    const db = await Connection.open(mongoUri, kdb);
    const usersCol = db.collection(USERS);
    const existingUsers = await usersCol.find({username: username}).toArray();
    console.log("existingUsers:", existingUsers);
    if (existingUsers.length > 0 ) {
        console.log("already exists");
        req.flash('error',
                  "A user with that username already exists.");
        return res.render('login.ejs');
    } else {
        const password = req.body.password;
        //hashing the password
        const hashed = bcrypt.hashSync(password,salt);
        const results = await usersCol.insertOne({username, hashed: hashed, bio: "", followers: [], following: []});
        console.log('created user', results);
        req.session.username = req.body.username;
        req.session.userId = results.insertedId.toString();
        return res.redirect('/userpage/' + req.session.username);
    }
});

app.post('/login', async (req,res) => {
    const username = req.body.username;
    const password = req.body.password;
    console.log(password);
    const db = await Connection.open(mongoUri, kdb);
    var existingUsers = await db.collection(USERS).find({username: username}).toArray();
    if (existingUsers.length === 0 ) {
        console.log("Username not found");
        req.flash('error', "Username not found");
        return res.render('login.ejs')
    }
    existingUser = existingUsers[0];
    const match = await bcrypt.compare(password, existingUser.hashed);
    if (!match) {
        console.log("Incorrect password");
        req.flash('error', "Incorrect password");
        return res.render('login.ejs');
    }
    req.session.userId = existingUser._id.toString();
    req.session.username = existingUser.username;
    req.flash('info', 'successfully logged in as ' + req.session.username);
    console.log('logged in as', username, existingUser);
    return res.redirect('/userpage/' + username);
});

//renderes userpage with specific id
app.get('/userpage/:userId', async (req,res)=> {
    const username = req.session.username;
    if (!username) {
        // Not logged in / signed up case
        console.log("not logged in");
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    } else {
    const db = await Connection.open(mongoUri, kdb);
    const user = req.params.userId;
    // const uploads = await db.collection(POSTS).find({owner: user}).toArray();
    let user_db = await db.collection(USERS).find({username : user}).toArray();
    user_db = user_db[0];
    console.log("user_db is: ", user_db);
    let userBio = user_db.bio;
    console.log("user's bio: ", userBio);
    let userPosts = await db.collection(POSTS).find({owner: user}).toArray();
    console.log("list of file owned by user", user);
    console.log("userPosts", userPosts);
    let followers = user_db.followers;
    let following = user_db.following;
    return res.render('userpage.ejs', {user, userPosts, userBio, followers, following});
    }
});

app.get('/posts/:postid', async (req, res) => {
    const username = req.session.username;
    if (!username) {
        // Not logged in / signed up case
        console.log("not logged in");
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    } else {
    let id = req.query.postid;
    const db = await Connection.open(mongoUri, kdb);
    let posts = db.collection(POSTS);
    let check = await posts.find().toArray();
    console.log("check", check);
    let postResult = await posts.find({"postId" : parseInt(id)}).toArray();
    console.log(postResult);
    return res.render('post.ejs', {post: postResult});
    }
});


app.get('/search/', (req, res) => {
    const username = req.session.username;
    if (!username) {
        // Not logged in / signed up case
        console.log("not logged in");
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    } else {
        res.render("search.ejs");
    }
});

app.get('/explore/', async (req,res) => {
    const username = req.session.username;
    if (!username) {
        // Not logged in / signed up case
        console.log("not logged in");
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    } else {
        let kind = req.query.kind;
        let searchTerm = req.query.term;

        const db = await Connection.open(mongoUri, kdb);
        let regSearch = new RegExp(searchTerm, 'i');
        let regString = regSearch.toString();
        regString = regString.slice(1, regString.length - 2);

        if (kind == "user"){
            const users = db.collection(USERS);
            const found = await users.find({username:{$regex:regSearch}}).toArray();
            if(found.length> 1){
                let userArray = found.map(function(user){return [`${user.username}`];});
                console.log("userarray match found:", userArray);
                let listH = 'Users matching ' + regString+':';
                let uType = 'userpage';
                return res.render('users.ejs', {
                                    listHeader: listH,
                                    users: userArray,
                                    urlType: uType,
                                    error:''
                                    });
            }
            else if (found.length ==1){
                res.redirect('/userpage/'+ regString);
            }
            else {
                req.flash('error', "User not found");
                return res.render('users.ejs', {
                    listHeader: '',
                    users: [],
                    urlType: ''
                    });
            }
        }

        else if (kind == "tag"){
            const posts = db.collection(POSTS);
            let matches = await posts.find({tags: {$regex:regSearch}}).toArray();
            if(matches.length >1){
                return res.render('posts.ejs', {postDesc : "Posts matching " + regString,
                                     userPosts: matches});
            }
            else{
                req.flash('error', "No posts with that tag found");
                return res.render('posts.ejs',{postDesc:'',
                userPosts: [] });
            }
        }
    }
});

app.get('/create', (req, res) => {
    const username = req.session.username;
    if (!username) {
        // Not logged in / signed up case
        console.log("not logged in");
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    } else {
    return res.render('create.ejs');
    }
})

app.post('/create', upload.single('photo'), async (req, res) => {
    const username = req.session.username;
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
                      tags: tagString,
                      likes: [],
                      postId: hash(req.file.filename)});
    console.log('insertOne result', result);
    // always nice to confirm with the user
    req.flash('info', 'file uploaded');
    return res.redirect('/');
});

app.post('/delete/:postId', async (req, res) => {
    const db = await Connection.open(mongoUri, kdb);
    let postId = req.params.postId;
    let post = await db.collection(POSTS).deleteOne({"postId": postId});
    req.flash('info', 'Post has been deleted successfully');
    return res.redirect('/userpage/' + req.session.username)
})


app.get('/update/:postId', async (req, res) => {
    let postId = req.params.postId;
    const username = req.session.username;
    if (!username) {
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    }
    const db = await Connection.open(mongoUri, kdb);
    let updatePost = await db.collection(POSTS).find({
        'postId': postId}).toArray();
    let result = updatePost[0];;
    console.log(result);
    console.log(result.title);
    return res.render("update.ejs", {post: result});
})

app.post('/update/:postId', async (req, res)=> {
    const username = req.session.username;
    if (!username) {
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    }
    let tagString = req.body.tags.replaceAll("\\s", "");
    console.log('updated data', req.body);
    // insert file data into mongodb
    const db = await Connection.open(mongoUri, kdb);
    const result = await db.collection(POSTS)
          .updateOne({postId: req.params.postId}, {$set: 
                    {title: req.body.title,
                    caption: req.body.caption}});
    console.log('insertOne result', result);
    // always nice to confirm with the user
    req.flash('info', 'file uploaded');
    return res.redirect('/');
})

app.post('/addFollower/:user', async (req,res) => {
    let user = req.params.user;
    const db = await Connection.open(mongoUri, kdb);
    console.log('req.session.username is', req.session.username);
    let session_user = await db.collection(USERS).find({username: req.session.username}).toArray();
    session_user = session_user[0];
    let num_following = session_user.following.length
    console.log("session_user:", session_user);
    console.log("session_user is ", session_user.username);
    let num_followers = await db.collection(USERS).find({username : user}).toArray();
    num_followers = num_followers[0].followers.length;
    console.log("num_followers: ", num_followers);
    let already_following = await db.collection(USERS).count(
        {username : user,
         followers: { $in: [session_user.username]}
        });
    console.log("already following is: ", already_following);
    if (already_following !== 1) {
        console.log("already following not 1");
        const update = await db.collection(USERS).updateOne({username : user}, {$push: {followers: session_user.username}});
        console.log("update: ", update);
        const update2 = await db.collection(USERS).updateOne({username : req.session.username}, {$push: {following: user}});
        console.log("update2: ", update2);
        return res.json({error: false, followers: num_followers + 1});
    }
    console.log("already following is 0");
    return res.json({error : "you are already following this person!", followers : (num_followers === 0) ? 0 : num_followers});
});

app.post('/editBio/:user', async (req,res) => {
    console.log("req.body", req.body);
    let bio = req.body.bio;
    console.log("bio is", bio);
    let user = req.params.user;
    console.log("user is ", user);
    const db = await Connection.open(mongoUri, kdb);
    let update = await db.collection(USERS).updateOne({username : user}, {$set: {bio: bio}});
    console.log("update: ", update);
    return res.json({error : false, bio : bio});
});



//increments the likes for a post and returns the updated document
app.post('/like/:postId', async (req, res) => {
    console.log(req.body);
    let postId = req.body.postId;
    console.log("req.body.postId is", postId);
    let user = req.body.user;
    console.log("req.body.user is", user);

    const db = await Connection.open(mongoUri, kdb);
    let doc = await db.collection(POSTS).find({"postId":postId}).toArray();
    console.log("doc", doc);
    let already_liked = await db.collection(POSTS).count(
        {postId : postId,
         likes: { $in: [user]}
        });
    console.log("already liked is: ", already_liked);
    if (already_liked !== 1) {
        const updateLike = await db.collection(POSTS)
                            .updateOne({"postId": postId},
                                {$push: {likes: user}},
                                {upsert: false});
        console.log("update status: ", updateLike);
        return res.json({error : false, likes : doc[0].likes.length + 1});
    } else {
    console.log("already liked is 1");
    return res.json({error : "you have already liked this post!", likes : doc[0].likes.length});
    //req.flash('info', `Post now has  ${doc.allPosts.likes} likes`);
    }
})

// app.post('/userpage/:userId/editBio', async (req,res) =>{
//     let newBio = req.body.bio;
//     console.log(newBio);
//     let user = req.params.userId;
//     const db = await Connection.open(mongoUri, kdb);
//     console.log(await db.collection(USERS).find({username:user}).toArray());
//     const update = await db.collection(USERS).updateOne({username:user}, {$set:{bio:newBio}});
//     console.log(await db.collection(USERS).find({username:user}).toArray());
//     return res.render("/userpage/");
    
// })
    


// // ================================================================
// // postlude

// Route for getting images/other files from uploads
app.get('/uploads/:file', async (req, res) => {
    const username = req.session.username;
    if (!username) {
        // Not logged in / signed up case
        console.log("not logged in");
        req.flash('info', "You are not logged in");
        return res.redirect('/login');
    } else {
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
    }
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
