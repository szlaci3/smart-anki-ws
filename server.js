const express = require('express');
const Redis = require('ioredis');

const app = express();
const redis = new Redis('redis://red-ci6l9mp8g3nfucbohhu0:6379');

app.use(express.json()); // Enable JSON request body parsing

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

// Create a new card
app.post('/cards', async (req, res) => {
  try {
    const { id, name, description } = req.body;
    const card = { id, name, description };
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
    const { name, description } = req.body;
    const card = { id, name, description };
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

