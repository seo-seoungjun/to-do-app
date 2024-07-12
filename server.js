require('dotenv').config();
const multer = require('multer');
const env = process.env;
const express = require('express');
const app = express();
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
app.use(methodOverride('_method'));

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const MongoClient = require('mongodb').MongoClient;
const url = env.DB_URL;
const DBNAME = 'todoapp';

MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
  if (err) return err;
  const db = client.db(DBNAME);
  const postCol = db.collection('post');
  const countCol = db.collection('counter');
  const loginCol = db.collection('login');
  const chatCol = db.collection('chat');

  app.listen(env.PORT, () => console.log('server open'));

  app.use(
    session({
      secret: 'keyboard cat',
      resave: false,
      saveUninitialized: true,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/login', (req, res) => {
    res.render('login.ejs');
  });

  app.post(
    '/login',
    passport.authenticate('local', { failureRedirect: '/login' }),
    (req, res) => {
      res.redirect(`/write`);
    }
  );

  app.post('/register', (req, res) => {
    const { id, pw } = req.body;
    loginCol.insertOne({ id, pw }, (err, result) => {
      if (err) throw err;
      res.redirect('/write');
    });
  });

  //db에 암호를 저장할 때 암호화해서 저장하는 것이 좋다. 비번 저장 예제를 찾아보자

  passport.use(
    new LocalStrategy(
      {
        usernameField: 'id',
        passwordField: 'pw',
        session: true,
        passReqToCallback: false,
      },
      function (id, pw, done) {
        loginCol.findOne({ id }, function (err, user) {
          if (err) {
            return done(err);
          }
          if (!user) {
            return done(null, false, { message: '존재하지 않는 아이디에요' });
          }
          if (pw == user.pw) {
            return done(null, user); //serializeUser로 데이터 전달
          } else {
            return done(null, false, { message: '존재하지 않는 비번이에요' });
          }
        });
      }
    )
  );

  //session에 유저의 아이디를 바탕으로 세션 데이터를 만들고 세션의 id정보를 쿠키로 발급해준다
  //user 부분에는 위에서의 결과 부분이 들어가게 된다
  passport.serializeUser(function (user, done) {
    console.log('세션 저장');
    done(null, user.id);
  });

  //로그인 한 사람들만 접근할 수 있는 페이지를 만들 수 있다 (세션 확인을 통해서)
  passport.deserializeUser(function (id, done) {
    loginCol.findOne({ id }, (err, result) => {
      console.log('이 세션 데이터를 가진 사람을 db에서 찾아주세요');
      done(null, result); //db에서 찾은 유저의 정보 (result)는 요청 바디에 user object로 전달된다
    });
  });

  app.get('/write', (req, res) => {
    res.sendFile(`${__dirname}/index.html`);
  });

  app.post('/add', (req, res) => {
    const { todo, due } = req.body;
    const { _id } = req.user;
    console.log(req.user);
    console.log(req.body);
    countCol.findOne({ name: 'counter' }, (err, result) => {
      const total = result.totalpost;
      postCol.insertOne(
        { _id: total, todo, due, userId: _id },
        (err, result) => {
          countCol.updateOne(
            { name: 'counter' },
            { $inc: { totalpost: 1 } },
            (err, result) => {
              if (err) throw err;
              // req.send("전송완료");
              res.redirect('/write');
            }
          );
        }
      );
    });
  });
  app.get(
    '/list',
    (req, res, next) => {
      if (req.user) {
        next();
      } else {
        res.send('리스트 볼려면 로그인을 해라');
      }
    },
    (req, res) => {
      postCol.find().toArray((err, result) => {
        if (err) throw err;
        res.render('list.ejs', { result });
      });
    }
  );

  app.delete('/delete', (req, res) => {
    console.log(req.body);
    console.log(req.user);
    const { _id } = req.body;
    const { _id: userId } = req.user;
    postCol.deleteOne({ _id: parseInt(_id), userId }, (err, result) => {
      console.log('삭제완료');
      console.log('에러', err);
      res.status(200).send({ message: '성공' });
    });
  });

  app.get('/detail/:id', (req, res) => {
    postCol.findOne({ _id: parseInt(req.params.id) }, (err, result) => {
      res.render('detail.ejs', { result });
    });
  });

  app.get('/edit/:id', (req, res) => {
    postCol.findOne({ _id: parseInt(req.params.id) }, (err, result) => {
      res.render('edit.ejs', { result });
    });
  });

  app.put('/edit', (req, res) => {
    const { todo, due, _id } = req.body;
    postCol.updateOne(
      { _id: parseInt(_id) },
      { $set: { todo, due } },
      (err, result) => {
        console.log('수정완료');
        res.redirect('/list');
      }
    );
  });

  app.use('/shop', require('./routers/shop.js'));

  app.get(
    '/mypage',
    (req, res, next) => {
      if (req.user) {
        next();
      } else {
        res.send('마이페이지 볼려면 로그인을 해라');
      }
    },
    (req, res) => {
      res.render('mypage.ejs', { user: req.user });
    }
  );
  app.get('/search', (req, res) => {
    console.log(req.query);
    const { value } = req.query;
    postCol
      .aggregate([
        {
          $search: {
            index: 'searchTitle',
            text: {
              query: value,
              path: 'todo',
            },
          },
        },
        {
          $limit: 3,
        },
      ])
      .toArray((err, result) => {
        if (err) throw err;
        res.render('search.ejs', { result });
      });
  });
  app.get('/upload', (req, res) => {
    res.render('upload.ejs');
  });

  const storage = multer.diskStorage({
    destination: (req, file, cd) => {
      cd(null, './public/images');
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  });

  const upload = multer({ storage: storage });

  app.post('/upload', upload.single('profile'), (req, res) => {
    res.send('전송완료');
  });
  app.get('/images/:imageName', (req, res) => {
    res.sendFile(`${__dirname}/public/images/${req.params.imageName}.png`);
  });

  app.get('/chatRoom', (req, res) => {
    chatCol
      .find({ member: parseInt(req.user._id) })
      .toArray()
      .then((result) => {
        console.log(result);
        res.render('chat.ejs', { result });
      });
  });

  app.post('/chat', (req, res) => {
    const { _id } = req.body;
    const { _id: userId } = req.user;
    postCol.findOne({ _id: parseInt(_id) }, (err, result) => {
      if (err) throw err;
      const { userId: postUserId } = result;
      chatCol.insertOne(
        {
          member: [userId, postUserId],
          date: Date.now(),
          title: `채팅방${_id}`,
        },
        (err, result) => {
          if (err) throw err;
          res.status(200).send({ message: '채팅방 생성 성공' });
        }
      );
    });
  });
});
