const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const { MongoClient } = require('mongodb');

const url = env.DB_URL;

// Replace the following with your Atlas connection string

const client = new MongoClient(url);

// The database to use
const DBNAME = 'todoapp';

async function run() {
  try {
    await client.connect();
    console.log('Connected correctly to  server');

    const db = client.db(DBNAME);

    const postCol = db.collection('post');
    const countCol = db.collection('counter');

    app.listen(8080, () => {
      console.log('로컬서버 켜졌음');
    });

    app.post('/add', (res, req) => {
      console.log(res.body);
      countCol.findOne({ name: 'counter' }, (err, result) => {
        if (err) return err;
        const { totalpost } = result;
        const { todo, due } = res.body;
        postCol.insertOne({ _id: totalpost, todo, due });
        postCol.updateOne(
          { name: 'counter' },
          { $inc: { totalpost: 1 } },
          (err, result) => {
            if (err) return err;
            req.send('전송완료');
          }
        );
      });
    });

    app.get('/list', (res, req) => {
      postCol.find().toArray((err, result) => {
        if (err) return err;
        console.log(result);
        req.render(`list.ejs`, { result });
      });
    });
  } catch (err) {
    console.log(err.stack);
  } finally {
  }
}

app.get('/write', (res, req) => {
  req.sendFile(`${__dirname}/index.html`);
});

run().catch(console.dir);
