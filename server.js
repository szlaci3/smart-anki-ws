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

app.post('/api/migrate-rates', async (req, res) => {
  try {
    const cards = await redis.keys('card:*');
    console.log(`Found ${cards.length} cards to check`);
    
    for (const cardKey of cards) {
      const card = await redis.hgetall(cardKey);
      if (card.rate === '10minutes') {
        await redis.multi()
          .hset(cardKey, 'rate', '0')
          .exec();
        console.log(`Updated ${cardKey}`);
      }
    }
    
    res.json({ success: true, message: `Processed ${cards.length} cards` });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, error: 'Migration failed' });
  }
});

app.post('/api/remove-reviewed-at', async (req, res) => {
  try {
    const cardKeys = await redis.keys('card:*');
    let updated = 0;

    for (const key of cardKeys) {
      const card = await redis.hgetall(key);
      if ('reviewedAt' in card) {
        await redis.hdel(key, 'reviewedAt');
        updated += 1;
      }
    }

    res.json({ success: true, updated });
  } catch (error) {
    console.error('reviewedAt cleanup failed:', error);
    res.status(500).json({ success: false, error: 'cleanup failed' });
  }
});

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
    const { sides, rate, dueAt } = req.body;

    const card = { id, sides, rate, dueAt };
    await redis.hset(`card:${id}`, card);
    res.json(card);
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// Delete a card by ID
app.delete('/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await redis.del(`card:${id}`);
    await redis.lrem('cards', 0, id);
    res.json({ success: true, message: 'Card deleted' });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

// Delete all cards
app.delete('/cards', async (req, res) => {
  try {
    const cardIds = await redis.lrange('cards', 0, -1);
    if (cardIds.length > 0) {
      const keys = cardIds.map(id => `card:${id}`);
      await redis.del(...keys);
      await redis.del('cards');
    }
    res.json({ success: true, message: 'All cards deleted' });
  } catch (error) {
    console.error('Error deleting all cards:', error);
    res.status(500).json({ error: 'Failed to delete all cards' });
  }
});

// Export all cards as JSON backup
app.get('/cards/export', async (req, res) => {
  try {
    const cardIds = await redis.lrange('cards', 0, -1);
    const cards = await Promise.all(
      cardIds.map(async (cardId) => {
        const card = await redis.hgetall(`card:${cardId}`);
        return card;
      })
    );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="card-database-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(cards);
  } catch (error) {
    console.error('Error exporting cards:', error);
    res.status(500).json({ error: 'Failed to export cards' });
  }
});

// Import cards from JSON backup
app.post('/cards/import', async (req, res) => {
  try {
    const { cards } = req.body;
    
    if (!Array.isArray(cards)) {
      return res.status(400).json({ error: 'Invalid file format. Expected an array of cards.' });
    }

    // Clear existing cards
    const existingCardIds = await redis.lrange('cards', 0, -1);
    if (existingCardIds.length > 0) {
      const keys = existingCardIds.map(id => `card:${id}`);
      await redis.del(...keys);
      await redis.del('cards');
    }

    // Import new cards
    for (const card of cards) {
      await redis.hset(`card:${card.id}`, card);
      await redis.rpush('cards', card.id);
    }

    res.json({ success: true, message: `Successfully imported ${cards.length} cards` });
  } catch (error) {
    console.error('Error importing cards:', error);
    res.status(500).json({ error: 'Failed to import cards' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
