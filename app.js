require('dotenv').config();
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { createHandler } = require('graphql-http/lib/use/express');
const expressPlayground =
  require('graphql-playground-middleware-express').default;

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');

const MONGODB_URI = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.unz10ho.mongodb.net/messages?retryWrites=true&w=majority`;

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json());
app.use(multer({ storage: fileStorage, fileFilter }).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

app.use(
  '/graphql',
  createHandler({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    formatError(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const message = err.message || 'An error occurred';
      const code = err.originalError.code || 500;
      return { message, status: code, data };
    },
  })
);
app.get('/playground', expressPlayground({ endpoint: '/graphql' }));

// Solution from Joel/TA
// app.all('/graphql', (req, res) =>
//   createHandler({
//     schema: graphqlSchema,
//     rootValue: {
//       createUser: (args) => graphqlResolver.createUser(args, req),
//       login: (args) => graphqlResolver.login(args, req),
//       createPost: (args) => graphqlResolver.createPost(args, req),
//       posts: (args) => graphqlResolver.posts(args, req),
//       post: (args) => graphqlResolver.post(args, req),
//       updatePost: (args) => graphqlResolver.updatePost(args, req),
//       deletePost: (args) => graphqlResolver.deletePost(args, req),
//       user: (args) => graphqlResolver.user(args, req),
//       updateStatus: (args) => graphqlResolver.updateStatus(args, req),
//     },
//   })(req, res)
// );

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message, data });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(8080);
  })
  .catch((err) => console.log(err));
