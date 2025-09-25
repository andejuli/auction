const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (use a database in production)
const users = [];
const auctions = [];
const bids = [];

// Helper functions
const generateId = () => Math.random().toString(36).substr(2, 9);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user exists
    const existingUser = users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = {
      id: generateId(),
      username,
      email,
      password: hashedPassword,
      createdAt: new Date()
    };
    
    users.push(user);
    
    // Generate token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auctions', (req, res) => {
  const auctionsWithBids = auctions.map(auction => {
    const auctionBids = bids.filter(bid => bid.auctionId === auction.id);
    const highestBid = auctionBids.length > 0 ? Math.max(...auctionBids.map(bid => bid.amount)) : auction.startingPrice;
    const bidCount = auctionBids.length;
    
    return {
      ...auction,
      currentPrice: highestBid,
      bidCount,
      timeRemaining: Math.max(0, new Date(auction.endTime) - new Date())
    };
  });
  
  res.json(auctionsWithBids);
});

app.post('/api/auctions', authenticateToken, (req, res) => {
  try {
    const { title, description, startingPrice, duration } = req.body;
    
    const auction = {
      id: generateId(),
      title,
      description,
      startingPrice: parseFloat(startingPrice),
      currentPrice: parseFloat(startingPrice),
      sellerId: req.user.id,
      sellerName: req.user.username,
      startTime: new Date(),
      endTime: new Date(Date.now() + duration * 60 * 60 * 1000), // duration in hours
      status: 'active',
      createdAt: new Date()
    };
    
    auctions.push(auction);
    io.emit('newAuction', auction);
    
    res.json(auction);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/bids', authenticateToken, (req, res) => {
  try {
    const { auctionId, amount } = req.body;
    
    const auction = auctions.find(a => a.id === auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    if (new Date() > new Date(auction.endTime)) {
      return res.status(400).json({ error: 'Auction has ended' });
    }
    
    const auctionBids = bids.filter(bid => bid.auctionId === auctionId);
    const currentHighest = auctionBids.length > 0 ? Math.max(...auctionBids.map(bid => bid.amount)) : auction.startingPrice;
    
    if (amount <= currentHighest) {
      return res.status(400).json({ error: 'Bid must be higher than current price' });
    }
    
    const bid = {
      id: generateId(),
      auctionId,
      bidderId: req.user.id,
      bidderName: req.user.username,
      amount: parseFloat(amount),
      timestamp: new Date()
    };
    
    bids.push(bid);
    
    // Update auction current price
    auction.currentPrice = bid.amount;
    
    // Emit bid update to all clients
    io.emit('newBid', { auctionId, bid, currentPrice: bid.amount });
    
    res.json(bid);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auctions/:id/bids', (req, res) => {
  const auctionBids = bids
    .filter(bid => bid.auctionId === req.params.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  res.json(auctionBids);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});