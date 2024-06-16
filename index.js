const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const flash = require('flash')
const methodOverride = require('method-override')
const session = require('express-session')
const { Leader, User } = require('./models/users')
//npm i bcrypt ejs express express-session flash method-override mongoose

mongoose.connect('mongodb://127.0.0.1:27017/learning')
    .then(() => {
        console.log("Connected to Mongo");
    })
    .catch((err) => {
        console.log("ERROR");
        console.log(err);
    })


let globalId = null;
let leaderEmail = null;
let globalTeam = null;
let globalIsLeader = false
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "notagoodsecret" }))
app.set('view engine', 'ejs');
app.use(methodOverride('_method'))
app.set('views', path.join(__dirname, '/views'))
app.use(express.static('public'))

const requireLogin = (req, res, next) => {
    if (!req.session.user_id) {
        return res.redirect('/login')
    }
    next();
}


app.get('/', (req, res) => {
    res.render('main');
})

app.get('/registerLeader', (req, res) => {
    res.render('registerLeader', { error: null })
})

app.get('/login', (req, res) => {
    res.render('login', { error: null })
})

app.post('/registerLeader', async (req, res) => {
    const { team_name, username, email, password } = req.body;

    if (!team_name || !username || !email || !password) {
        return res.render('registerLeader', { error: 'Please fill all the required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        return res.render('registerLeader', { error: 'Invalid email format' });
    }

    const hash = await bcrypt.hash(password, 12);
    globalTeam = team_name;

    const allUsers = await User.find({})
    for (let single of allUsers) {
        if (single.email == email) {
            return res.render('registerLeader', { error: 'Email already registered' });
        }
        else if (single.team == team_name) {
            return res.render('registerLeader', { error: 'Team Name already taken' });
        }
        else if (single.username == username) {
            return res.render('registerLeader', { error: 'Username already taken' });
        }
    }

    const user = new User({
        username: username,
        email: email,
        password: hash,
        isLeader: true,
        team: team_name
    })
    const leader = new Leader({
        team: team_name,
        username: username,
        email: email,
        password: hash,
        members: [],
        isLeader: true
    })

    await leader.save();
    await user.save();
    res.redirect('/login')
})


app.get('/success',(req,res)=>{
    res.render('success')
})

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        return res.render('login', { error: 'Invalid username or password.' });
    }
    const validPassword = await bcrypt.compare(password, user.password)
    if (validPassword) {
        req.session.user_id = user._id;
        globalId = user._id;
        globalIsLeader = user.isLeader;
        if (user.isLeader) {
            globalTeam = user.team
            leaderEmail = email;
            res.redirect('/leaderDash')
        }
        else {
            res.redirect('/userDash')
        }
    }
    else {
        res.render('login', { error: 'Invalid username or password.' });
    }
    // res.redirect("/team_dash")
})

app.post('/logout', (req, res) => {
    req.session.user_id = null;
    res.redirect('/login')
})

app.get('/secret', (req, res) => {
    res.send("Bellloooooooo")
})

app.get('/leaderDash', requireLogin, async (req, res) => {
    if (!globalIsLeader) {
        return res.redirect('/userDash');
    }
    const add = await Leader.findOne({ email: leaderEmail })
    const memberArray = [];
    if (add.members.length > 0) {
        for (m of add.members) {
            let indi = await User.findById(m)
            memberArray.push(indi);
        }
    }
    console.log(memberArray)
    res.render("leaderDash", { members: memberArray, name: add.username, team: add.team })
})

app.get('/registerUser', requireLogin, (req, res) => {
    if (globalIsLeader) {
        res.render("registerUser", { error: null })
    }
    else {
        res.redirect('/userDash')
    }
})

app.post('/registerUser', async (req, res) => {
    if (globalIsLeader) {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.render('registerUser', { error: 'Please fill all the required fields' });
        }
    
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
        if (!emailRegex.test(email)) {
            return res.render('registerUser', { error: 'Invalid email format' });
        }

        const hash = await bcrypt.hash(password, 12);

        const allUsers = await User.find({})
        for (let single of allUsers) {
            if (single.username == username) {
                return res.render('registerUser', { error: 'Username already taken' });
            }
            else if (single.email == email) {
                return res.render('registerUser', { error: 'Email already registered' });
            }
        }

        const user = new User({
            username: username,
            email: email,
            password: hash,
            isLeader: false,
            team: globalTeam
        })

        await user.save();
        const userId = await User.findOne({ username })
        const add = await Leader.findOne({ email: leaderEmail })
        add.members.push(userId._id)
        await add.save();
        res.redirect('/leaderDash')
    }
    else {
        res.redirect('/userDash')
    }
})


app.get('/userDash', requireLogin, async (req, res) => {
    if (globalIsLeader) {
        res.redirect('/leaderDash')
    }
    const user = await User.findById(globalId) //Always remember async await errors
    console.log(user)
    res.render('userDash', { name: user.username, team: user.team });
})

app.delete('/deleteUser/:id',async (req,res) =>{
    const {id} = req.params;
    await User.findByIdAndDelete(id);

    const add = await Leader.findOne({ email: leaderEmail })
    const memberArray = [];
    if (add.members.length > 0) {
        for (m of add.members) {
            let indi = await User.findById(m)
            memberArray.push(indi);
        }
    }
    console.log(memberArray)
    res.redirect('/leaderDash')

})


app.listen(3000, () => {
    console.log('Server Started');
})
