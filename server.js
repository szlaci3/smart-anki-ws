const express = require('express');
const Redis = require('ioredis');
const cors = require('cors');

const app = express();
const redis = new Redis('redis://red-ci6l9mp8g3nfucbohhu0:6379');

app.use(express.json()); // Enable JSON request body parsing

const whitelist = ['https://smart-anki.onrender.com', 'https://localhost:3000', 'https://localhost:8000'];
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions));

// Retrieve all cards
app.get('/cards', async (req, res) => {
  try {
    // Retrieve the list of card IDs from Redis
    const cardIds = await redis.lrange('cards', 0, -1);

    // Retrieve the card objects from Redis using the IDs
    const cards = await Promise.all(
      cardIds.map(async (cardId) => {
        const card = await redis.hgetall(`card:${cardId}`);
        return card;
      })
    );

    res.json(cards);
  } catch (error) {
    console.error('Error retrieving cards:', error);
    res.status(500).json({ error: 'Failed to retrieve cards' });
  }
});

// Retrieve a card by ID
app.get('/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const card = await redis.hgetall(`card:${id}`);

    if (!card || Object.keys(card).length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json(card);
  } catch (error) {
    console.error('Error retrieving card by ID:', error);
    res.status(500).json({ error: 'Failed to retrieve card' });
  }
});

// Create a new card
app.post('/cards', async (req, res) => {
  try {
    const { id, sides } = req.body;
    const card = { id, sides };
    await redis.hset(`card:${id}`, card);
    await redis.rpush('cards', id);
    res.status(201).json(card);
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// Update an existing card
app.put('/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sides, rate, reviewedAt } = req.body;

    const card = { id, sides, rate, reviewedAt };
    await redis.hset(`card:${id}`, card);
    res.json(card);
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});