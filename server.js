const express = require('express');
const Redis = require('ioredis');

const app = express();
const redis = new Redis();

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

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
