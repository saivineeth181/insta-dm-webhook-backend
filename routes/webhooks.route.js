const { default: axios } = require('axios');
const express = require('express');
const test = require('../server');
const router = express.Router();
const server = require('../server');

// Helper function to log input/output
function logApi({ method, path, input, output, status }) {
  console.log('---');
  console.log(`[${new Date().toISOString()}] API ${method} ${path}`);
  if (input) console.log('Input:', JSON.stringify(input, null, 2));
  if (output) console.log('Output:', JSON.stringify(output, null, 2));
  if (status) console.log('Status:', status);
  console.log('---');
}

router.get('/', (req, res) => {
  logApi({
    method: 'GET',
    path: '/webhooks',
    input: { query: req.query, headers: req.headers },
  });

  const response = req.query['hub.challenge'];
  try {
    if (req.query['hub.verify_token'] === 'instadmtesttoken') {
      logApi({
        method: 'GET',
        path: '/webhooks',
        output: response,
        status: 200,
      });
      res.status(200);
      res.send(response);
    } else {
      const output = { status: 'token_not_verified' };
      logApi({
        method: 'GET',
        path: '/webhooks',
        output,
        status: 401,
      });
      res.status(401);
      res.json(output);
    }
  } catch (error) {
    const output = { message: error.message };
    logApi({
      method: 'GET',
      path: '/webhooks',
      output,
      status: 400,
    });
    res.status(400);
    res.json(output);
  }
});

router.post('/', async (req, res) => {
  logApi({
    method: 'POST',
    path: '/webhooks',
    input: { body: req.body, headers: req.headers },
  });

  let io = server.getIO();
  const text = req.body.entry?.[0]?.messaging?.[0]?.message?.text || '';
  const senderIGSID = req.body.entry?.[0]?.messaging?.[0]?.sender?.id || '';
  const timestamp = req.body.entry?.[0]?.time || '';
  try {
    if (!text || !senderIGSID) {
      throw new Error('Something went wrong');
    }

    const socketResponse = {
      message: text,
      senderId: senderIGSID,
      date: new Date(timestamp).toLocaleDateString(),
      timestamp,
    };
    io.emit('message_received', socketResponse);

    const output = { status: 'success' };
    logApi({
      method: 'POST',
      path: '/webhooks',
      output,
      status: 200,
    });
    res.status(200);
    res.json(output);
  } catch (error) {
    const output = { status: 'failure', message: error.message };
    logApi({
      method: 'POST',
      path: '/webhooks',
      output,
      status: 400,
    });
    res.status(400);
    res.json(output);
  }
});

module.exports = router;