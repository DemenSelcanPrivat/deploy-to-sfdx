import * as logger from 'heroku-logger';
import * as express from 'express';
import ua from 'universal-analytics';
import * as bodyParser from 'body-parser';
import * as WebSocket from 'ws';
import * as path from 'path';
import * as favicon from 'serve-favicon';

import * as redis from './lib/redisNormal';
import * as redisSub from './lib/redisSubscribe';
import * as msgBuilder from './lib/deployMsgBuilder';
import * as utilities from './lib/utilities';
import * as org62LeadCapture from './lib/trialLeadCreate';

import { clientDataStructure, deployRequest } from './lib/types';

const ex = 'deployMsg';

const app = express();

const port = process.env.PORT || 8443;

const server = app.listen(port, () => {
  logger.info(`Example app listening on port ${port}!`);
});

const wss = new WebSocket.Server({ server, clientTracking: true });

app.use(favicon(path.join(__dirname, 'assets/favicons', 'favicon.ico')));
// app.use('/scripts', express.static(`${__dirname}/scripts`));
app.use(express.static('built/assets'));

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
// app.use(cookieParser());

app.post('/trial', (req, res, next) => {
  const message = msgBuilder(req.query);
  logger.debug('trial request', message);

  // assign the email from the post field because it wasn't in the query string
  message.email = req.body.UserEmail;

  if (process.env.sfdcLeadCaptureServlet) {
    org62LeadCapture(req.body);
  }

  if (process.env.UA_ID) {
    const visitor = ua(process.env.UA_ID);
    visitor.pageview('/trial').send();
    visitor.event('Repo', req.query.template).send();
    message.visitor = visitor;
  }

  utilities.runHerokuBuilder();

  redis.rpush('deploys', JSON.stringify(message)).then(() => {
    res.redirect(`/deploying/trial/${message.deployId.trim()}`);
  });
});

app.post('/delete', (req, res, next) => {
  // logger.debug('in the delete post action with body:');
  // logger.debug(req.body);
  utilities.runHerokuBuilder();

  redis
    .rpush(
      'poolDeploys',
      JSON.stringify({
        username: req.body.username,
        delete: true
      })
    )
    .then(() => {
      res.status(302).send('/deleteConfirm');
    })
    .catch((e) => {
      logger.error(
        `An error occurred in the redis rpush to the delete queue: ${req.body}`
      );
      logger.error(e);
      res.status(500).send(e);
    });
});

app.get('/deleteConfirm', (req, res, next) =>
  res.render('pages/deleteConfirm')
);

app.get('/launch', (req, res, next) => {
  // no template?  does not compute!
  if (
    !req.query.template ||
    !req.query.template.includes('https://github.com/')
  ) {
    throw 'There should be a github repo in that url.  Example: /launch?template=https://github.com/you/repo';
  }

  if (req.query.template.includes('?')) {
    throw `That template has a ? in it, making the url impossible to parse: ${
      req.query.template
    }`;
  }

  // allow repos to require the email parameter
  if (req.query.email === 'required') {
    return res.render('pages/userinfo', {
      template: req.query.template
    });
  }

  const message: deployRequest = msgBuilder(req.query);
  // analytics
  if (process.env.UA_ID) {
    const visitor = ua(process.env.UA_ID);
    visitor.pageview('/launch').send();
    visitor.event('Repo', req.query.template).send();
  }
  utilities.runHerokuBuilder();

  redis
    .rpush(message.pool ? 'poolDeploys' : 'deploys', JSON.stringify(message))
    .then((rpushResult) => {
      logger.debug(rpushResult);
      if (message.pool) {
        logger.debug('putting in pool deploy queue');
        return res.send('pool initiated');
      } else {
        return res.redirect(`/deploying/deployer/${message.deployId.trim()}`);
      }
    });
});

app.get('/deploying/:format/:deployId', (req, res, next) => {
  if (req.params.format === 'deployer') {
    res.render('pages/messages', {
      deployId: req.params.deployId.trim()
    });
  } else if (req.params.format === 'trial') {
    res.render('pages/trialLoading', {
      deployId: req.params.deployId.trim()
    });
  }
});

app.get('/userinfo', (req, res, next) => {
  res.render('pages/userinfo', {
    template: req.query.template
  });
});

app.get('/pools', async (req, res, next) => {
  const keys = await redis.keys('*');
  const output = [];
  for (const key of keys) {
    const size = await redis.llen(key);
    output.push({
      repo: key,
      size
    });
  }
  res.send(output);
});

app.get('/testform', (req, res, next) => {
  res.render('pages/testForm');
});

app.get('/', (req, res, next) => {
  res.json({
    message: 'There is nothing at /.  See the docs for valid paths.'
  });
});

app.get('*', (req, res, next) => {
  setImmediate(() => {
    next(new Error('Route not found'));
  });
});

app.use((error, req, res, next) => {
  // Any request to this server will get here, and will send an HTTP
  // response with the error message 'woops'
  if (process.env.UA_ID) {
    const visitor = ua(process.env.UA_ID);
    visitor.event('Error', req.query.template).send();
  }
  logger.error(`request failed: ${req.url}`);
  return res.render('pages/error', {
    customError: error
  });
});

wss.on('connection', (ws: WebSocket, req) => {
  logger.debug(`connection on url ${req.url}`);

  // for future use tracking clients
  ws.url = req.url;
});

// subscribe to deploy events to share them with the web clients
redisSub.subscribe(ex).then(() => {
  logger.info(`subscribed to Redis channel ${ex}`);
});

redisSub.on('message', (channel, message) => {
  // logger.debug('heard a message from the worker:');
  const msgJSON = <clientDataStructure>JSON.parse(message);

  wss.clients.forEach((client) => {
    if (client.url.includes(msgJSON.deployId.trim())) {
      client.send(JSON.stringify(msgJSON));
      // close connection when ALLDONE
      if (msgJSON.complete) {
        client.close();
      }
    }
  });
});
