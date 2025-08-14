const express = require('express');
const router = express.Router();
const server = require('../server');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient("https://icemorpwgrfezgtjwrrr.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZW1vcnB3Z3JmZXpndGp3cnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NDAwOTAsImV4cCI6MjA2MzQxNjA5MH0.ZJD8OgDJpUTtW8QJ9c_kg4Rd3lid1PXykS86X1jLNUI");

function logApi({ method, path, input, output, status }) {
  console.log('---');
  console.log(`[${new Date().toISOString()}] API ${method} ${path}`);
  if (input) console.log('Input:', JSON.stringify(input, null, 2));
  if (output) console.log('Output:', JSON.stringify(output, null, 2));
  if (status) console.log('Status:', status);
  console.log('---');
}

async function saveToSupabase(type, payload) {
  const { error } = await supabase
    .from('webhook_logs')
    .insert([{ event_type: type, payload, created_at: new Date().toISOString() }]);
  if (error) console.error('Supabase insert error:', error);
}

// Verification endpoint
router.get('/', async (req, res) => {
  logApi({ method: 'GET', path: '/webhooks', input: { query: req.query } });
  await saveToSupabase('raw_webhook', req.body); // Save full request

  const response = req.query['hub.challenge'];
  if (req.query['hub.verify_token'] === 'instadmtesttoken') {
    logApi({ method: 'GET', path: '/webhooks', output: response, status: 200 });
    return res.status(200).send(response);
  }

  logApi({ method: 'GET', path: '/webhooks', output: { status: 'token_not_verified' }, status: 401 });
  res.status(401).json({ status: 'token_not_verified' });
});

// Main webhook POST handler
router.post('/', async (req, res) => {
  logApi({ method: 'POST', path: '/webhooks', input: req.body });
  await saveToSupabase('raw_webhook', req.body); // Save full request

  let io = server.getIO();
  let events = [];

  try {
    if (req.body.object === 'instagram') {
      req.body.entry.forEach(entry => {
        entry.changes.forEach(change => {
          if (change.field === 'comments') {
            events.push({
              type: 'comment',
              text: change.value.text,
              from: change.value.from?.username,
              id: change.value.id,
              timestamp: entry.time * 1000
            });
          } else if (change.field === 'live_comments') {
            events.push({
              type: 'live_comment',
              text: change.value.text,
              from: change.value.from?.username,
              id: change.value.id,
              timestamp: entry.time * 1000
            });
          }
        });
      });
    } else if (req.body.object === 'page') {
      req.body.entry.forEach(entry => {
        entry.messaging.forEach(msg => {
          if (msg.message?.text) {
            events.push({
              type: 'direct_message',
              text: msg.message.text,
              from: msg.sender.id,
              timestamp: msg.timestamp
            });
          }
        });
      });
    }

    // Emit and save each event
    for (let ev of events) {
      io.emit('message_received', ev);
      await saveToSupabase(ev.type, ev);
    }

    logApi({ method: 'POST', path: '/webhooks', output: { status: 'success', events }, status: 200 });
    res.status(200).json({ status: 'success' });

  } catch (error) {
    logApi({ method: 'POST', path: '/webhooks', output: { status: 'failure', message: error.message }, status: 400 });
    res.status(400).json({ status: 'failure', message: error.message });
  }
});

module.exports = router;
