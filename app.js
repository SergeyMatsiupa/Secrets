//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
// const md5 = require("md5");
const bcrypt = require("bcrypt");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const saltRounds = 10;

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: 'our little secret',
    resave: false,
    saveUninitialized: true,
  }));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/userDB", {useNewUrlParser: true});
//   mongoose.set("useCreateIndex", true);
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String,
});
userSchema.plugin(passportLocalMongoose);
// userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ['password']});
userSchema.plugin(findOrCreate);
const userModel = new mongoose.model("User", userSchema);
passport.use(userModel.createStrategy());
// passport.serializeUser(userModel.serializeUser());
// passport.deserializeUser(userModel.deserializeUser());
passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        // username: user.username,
        // picture: user.picture
      });
    });
});
passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
        console.log('profile11111 - ', profile);
    userModel.findOrCreate({ googleId: profile.id }, function (err, user) {
        // console.log('err', err);
        // console.log('user', user);
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
    res.render("home");
});

app.get("/auth/google", 
    passport.authenticate("google", {scope: ["profile"]}
));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets
    res.redirect('/secrets');
  });

app.get("/login", function(req, res){
    res.render("login");
});

app.get("/register", function(req, res){
    res.render("register");
});

app.get("/secrets", function(req, res){
    // if(req.isAuthenticated()) {
    //     res.render("secrets");
    // } else {
    //     res.redirect("/login");
    // }
    userModel.find({"secret": {$ne: null}})
    .then(function(foundUsers){
        if(foundUsers){
            res.render("secrets", {usersWithSecrets: foundUsers});
        }
    })
    .catch(function(err){
        console.log('err', err);
    });
});

app.get("/logout", function(req, res){
    req.logout(function(err) {
        if (err) { 
            console.log('err', err); 
        } else {
            res.redirect('/');
        }
      });
});

app.post("/register", function(req, res){
    // // let dfdf = "a9JjKRa^g]8r*5a";
    // // bcrypt.hash(dfdf, saltRounds)
    // //     .then(function(rez){
    // //         console.log('rez', rez);
    // //         console.log('dfdf', dfdf);
    // //     });
    
    // bcrypt.hash(req.body.password, saltRounds)
    //     .then(function(saltedHash){
    //         const newUser = new userModel({
    //             email: req.body.username,
    //             // password: md5(req.body.password)
    //             password: saltedHash
    //         });
    //         newUser.save()
    //             .then(function(){
    //                 res.render("secrets");
    //             })
    //             .catch(function(err){
    //                 console.log('err', err);
    //             });
    //         // res.render("register");
    //     })
    //     .catch(function(err){
    //         console.log('err', err);
    //     });

    userModel.register({username: req.body.username}, req.body.password, function(err,user){
        if(err) {
            console.log('err', err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });
});

app.post("/login", function(req, res){
    // const username = req.body.username;
    // // const password = md5(req.body.password);
    // const password = req.body.password;

    // userModel.findOne({email: username})
    //     .then(function(foundUser){
    //         if(foundUser) {
    //             bcrypt.compare(password, foundUser.password)
    //                 .then(function(compareRes){
    //                         console.log('compareRes', compareRes);
    //                     if(compareRes === true) {
    //                         // user found in DB and password matched
    //                         res.render("secrets");
    //                     } else {
    //                         res.send("wrong password");
    //                     }
    //                 });
    //         } else {
    //             res.send("wrong username");
    //         }
    //     })
    //     .catch(function(err){
    //         console.log('err', err);
    //     });

    const user = new userModel({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err){
        if(err) {
            console.log('err', err);
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });
});


app.get("/submit", function(req, res){
    if(req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});


app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;
        console.log('req.user', req.user);
    userModel.findById(req.user.id)
        .then(function(foundUser){
            if(foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save()
                    .then(function(){
                        res.redirect("/secrets");
                    });
            }
        })
        .catch(function(err){
            console.log('err', err);
        });
});


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
    console.log("Server started on port " + port);
  });