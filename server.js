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
const cookieSession = require('cookie-session');
const flash = require('express-flash');

// our modules loaded from cwd

const { Connection } = require('./connection');
const cs304 = require('./cs304');

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
    maxAge: 60 * 1000 // 24 hours
  }))

const mongoUri = cs304.getMongoUri();

// ================================================================
// custom routes here

// Use these constants and mispellings become errors
const kdb = "kapchiydb";

// main page. just has links to two other pages
app.get('/', (req, res) => {
    return res.render('index.ejs');
});

app.get('/posts/:postid', async (req, res) => {
    const db = await Connection.open(mongoUri, kdb);
    return res.render(list.ejs);
});

// app.get('/nm/:personid', async (req, res) => {
//     // Generate URL type for people in the WMDB database
//     // Renders the person_list.ejs page with the queried person's WMDB information
//     const personid = req.params.personid;
//     const db = await Connection.open(mongoUri, WMDB);
//     const people = db.collection(PEOPLE);
//     let person_list = await people.find({nm: parseInt(personid)}).toArray();
//     console.log('personid', person_list);
//     return res.render('person_list.ejs',
//                       {list: person_list});
// });

// app.get('/tt/:movieid', async (req, res) => {
//     // Generate URL type for movies in the WMDB database
//     // Renders the movie_list.ejs page with the queried movie's WMDB information
//     const movieid = req.params.movieid;
//     const db = await Connection.open(mongoUri, WMDB);
//     const movies = db.collection(MOVIES);
//     let movie_list = await movies.find({tt: parseInt(movieid)}).toArray();
//     // res.send('id: ' + req.params.personid);
//     return res.render('movie_list.ejs',
//                       {list: movie_list});
// });
    
// app.get('/search', async (req, res) => {
//     /*Takes in two fields, term and kind, from
//       the form located on the landing page,
//       given by index.ejs. Returns a user to the
//       main page if their query had no results,
//       directs them to the correct page for the
//       person or movie in question if there is only
//       one match to their query, or otherwise
//       generates a series of URLs linking to various
//       pages matching the user's query.
//     */ 
//     let id = req.query.term;
//     let kind = req.query.kind;
//     const db = await Connection.open(mongoUri, WMDB);
    
//     if (kind === "person") {
//         const people = db.collection(PEOPLE);
//         const reg = new RegExp(id, "i");
//         let person_list = await people.find({name: reg}).toArray();
//         console.log("length:", person_list.length)
//         switch (person_list.length) {
//             case 0:
//                 console.log("No results!");
//                 req.session.id = id;
//                 req.flash('info', `No results found for people with name ${req.session.id}`);
//                 return res.redirect('/');
//             case 1:
//                 let idno = person_list[0].nm;
//                 return res.redirect("/nm/" + idno);
//             default:
//                 return res.render('list.ejs', {id,
//                                                kind,
//                                                list: person_list});
//         }
//     } else if (kind === "movie") {
//         const movies = db.collection(MOVIES);
//         const reg = new RegExp(id, "i");
//         let movie_list = await movies.find({title: reg}).toArray();
//         switch (movie_list.length) {
//             case 0:
//                 req.session.id = id;
//                 req.flash('info', `No results found for movies with title ${req.session.id}`);
//                 res.redirect('/');
//                 return;
//             case 1:
//                 let idno = movie_list[0].tt;
//                 return res.redirect("/tt/" + idno);
//             default:
//                 return res.render('list.ejs', {listDescription: "List of movies matching" + id,
//                                                id,
//                                                kind,
//                                                list: movie_list});
//         }
//     }
// }
// );

// // ================================================================
// // postlude

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function() {
    console.log(`listening on ${serverPort}`);
    console.log(`visit http://cs.wellesley.edu:${serverPort}/`);
    console.log(`or http://localhost:${serverPort}/`);
    console.log('^C to exit');
});
