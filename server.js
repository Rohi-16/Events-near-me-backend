const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const eventsRouter = require('./routes/events');
const notifyRouter = require('./routes/notify');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/api/events', eventsRouter);
app.use('/api/notify', notifyRouter);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Events Near Me API is running 🚀' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
