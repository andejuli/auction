// Global variables
let socket;
let currentUser = null;
let currentAuctionId = null;
let auctions = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    checkAuthStatus();
    loadAuctions();
    setupEventListeners();
    startTimers();
});

// Socket.io initialization
function initializeSocket() {
    socket = io();
    
    socket.on('newAuction', function(auction) {
        addAuctionToGrid(auction);
        showToast('New auction added!', 'success');
        updateAuctionCount();
    });
    
    socket.on('newBid', function(data) {
        updateAuctionPrice(data.auctionId, data.currentPrice);
        if (currentAuctionId === data.auctionId) {
            updateBidModal(data);
        }
        showToast(`New bid of $${data.bid.amount} on auction!`, 'success');
    });
}

// Authentication functions
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        currentUser = JSON.parse(user);
        updateNavigation(true);
    } else {
        updateNavigation(false);
    }
}

function updateNavigation(isLoggedIn) {
    const navAuth = document.getElementById('navAuth');
    const navUser = document.getElementById('navUser');
    const userWelcome = document.getElementById('userWelcome');
    
    if (isLoggedIn && currentUser) {
        navAuth.classList.add('hidden');
        navUser.classList.remove('hidden');
        userWelcome.textContent = `Welcome, ${currentUser.username}!`;
    } else {
        navAuth.classList.remove('hidden');
        navUser.classList.add('hidden');
    }
}

// Event listeners setup
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Register form
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // Create auction form
    document.getElementById('createAuctionForm').addEventListener('submit', handleCreateAuction);
    
    // Bid form
    document.getElementById('bidForm').addEventListener('submit', handlePlaceBid);
    
    // Modal close events
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// Authentication handlers
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            updateNavigation(true);
            closeModal('loginModal');
            showToast('Login successful!', 'success');
            document.getElementById('loginForm').reset();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            updateNavigation(true);
            closeModal('registerModal');
            showToast('Registration successful!', 'success');
            document.getElementById('registerForm').reset();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    updateNavigation(false);
    showToast('Logged out successfully', 'success');
}

// Auction functions
async function loadAuctions() {
    try {
        const response = await fetch('/api/auctions');
        const data = await response.json();
        
        auctions = data;
        displayAuctions(auctions);
        updateAuctionCount();
    } catch (error) {
        showToast('Failed to load auctions', 'error');
    }
}

function displayAuctions(auctionsToShow) {
    const grid = document.getElementById('auctionsGrid');
    
    if (auctionsToShow.length === 0) {
        grid.innerHTML = '<div class="loading">No auctions available</div>';
        return;
    }
    
    grid.innerHTML = auctionsToShow.map(auction => createAuctionCard(auction)).join('');
}

function createAuctionCard(auction) {
    const isEnded = new Date() > new Date(auction.endTime);
    const timeRemaining = formatTimeRemaining(auction.timeRemaining);
    
    return `
        <div class="auction-card ${isEnded ? 'auction-ended' : ''}" data-id="${auction.id}">
            <div class="auction-header">
                <h3 class="auction-title">${auction.title}</h3>
                <p class="auction-seller">by ${auction.sellerName}</p>
            </div>
            <p class="auction-description">${auction.description}</p>
            <div class="auction-price">
                <span class="current-price">$${auction.currentPrice.toFixed(2)}</span>
                <span class="bid-count">${auction.bidCount} bids</span>
            </div>
            <div class="auction-timer">
                <div class="time-remaining">${isEnded ? 'Auction Ended' : timeRemaining}</div>
            </div>
            <div class="auction-actions">
                <button class="btn btn-primary" onclick="showBidModal('${auction.id}')" ${isEnded || !currentUser ? 'disabled' : ''}>
                    ${isEnded ? 'Ended' : 'Place Bid'}
                </button>
            </div>
        </div>
    `;
}

function addAuctionToGrid(auction) {
    auctions.unshift(auction);
    displayAuctions(auctions);
}

function updateAuctionPrice(auctionId, newPrice) {
    const auction = auctions.find(a => a.id === auctionId);
    if (auction) {
        auction.currentPrice = newPrice;
        auction.bidCount = (auction.bidCount || 0) + 1;
        
        // Update the card in the DOM
        const card = document.querySelector(`[data-id="${auctionId}"]`);
        if (card) {
            const priceElement = card.querySelector('.current-price');
            const bidCountElement = card.querySelector('.bid-count');
            if (priceElement) priceElement.textContent = `$${newPrice.toFixed(2)}`;
            if (bidCountElement) bidCountElement.textContent = `${auction.bidCount} bids`;
        }
    }
}

function updateAuctionCount() {
    const count = auctions.filter(a => new Date() <= new Date(a.endTime)).length;
    document.getElementById('auctionCount').textContent = `${count} active auctions`;
}

// Create auction handler
async function handleCreateAuction(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showToast('Please login to create an auction', 'error');
        return;
    }
    
    const title = document.getElementById('auctionTitle').value;
    const description = document.getElementById('auctionDescription').value;
    const startingPrice = document.getElementById('startingPrice').value;
    const duration = document.getElementById('duration').value;
    
    try {
        const response = await fetch('/api/auctions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ title, description, startingPrice, duration })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeModal('createAuctionModal');
            showToast('Auction created successfully!', 'success');
            document.getElementById('createAuctionForm').reset();
        } else {
            showToast(data.error || 'Failed to create auction', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

// Bidding functions
async function showBidModal(auctionId) {
    if (!currentUser) {
        showToast('Please login to place a bid', 'error');
        showLogin();
        return;
    }
    
    currentAuctionId = auctionId;
    const auction = auctions.find(a => a.id === auctionId);
    
    if (!auction) return;
    
    document.getElementById('bidModalTitle').textContent = `Bid on: ${auction.title}`;
    document.getElementById('currentBidPrice').textContent = `$${auction.currentPrice.toFixed(2)}`;
    document.getElementById('bidAmount').min = (auction.currentPrice + 0.01).toFixed(2);
    document.getElementById('bidAmount').value = (auction.currentPrice + 1).toFixed(2);
    
    // Load bid history
    await loadBidHistory(auctionId);
    
    showModal('bidModal');
}

async function loadBidHistory(auctionId) {
    try {
        const response = await fetch(`/api/auctions/${auctionId}/bids`);
        const bids = await response.json();
        
        const bidList = document.getElementById('bidList');
        
        if (bids.length === 0) {
            bidList.innerHTML = '<div class="loading">No bids yet</div>';
            return;
        }
        
        bidList.innerHTML = bids.map(bid => `
            <div class="bid-item">
                <div>
                    <div class="bid-user">${bid.bidderName}</div>
                    <div class="bid-time">${formatDate(bid.timestamp)}</div>
                </div>
                <div class="bid-amount">$${bid.amount.toFixed(2)}</div>
            </div>
        `).join('');
    } catch (error) {
        document.getElementById('bidList').innerHTML = '<div class="loading">Failed to load bids</div>';
    }
}

async function handlePlaceBid(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('bidAmount').value);
    
    try {
        const response = await fetch('/api/bids', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ auctionId: currentAuctionId, amount })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Bid placed successfully!', 'success');
            document.getElementById('bidAmount').value = (amount + 1).toFixed(2);
            document.getElementById('bidAmount').min = (amount + 0.01).toFixed(2);
        } else {
            showToast(data.error || 'Failed to place bid', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

function updateBidModal(data) {
    document.getElementById('currentBidPrice').textContent = `$${data.currentPrice.toFixed(2)}`;
    document.getElementById('bidAmount').min = (data.currentPrice + 0.01).toFixed(2);
    document.getElementById('bidAmount').value = (data.currentPrice + 1).toFixed(2);
    
    // Add new bid to history
    const bidList = document.getElementById('bidList');
    const newBidHtml = `
        <div class="bid-item">
            <div>
                <div class="bid-user">${data.bid.bidderName}</div>
                <div class="bid-time">${formatDate(data.bid.timestamp)}</div>
            </div>
            <div class="bid-amount">$${data.bid.amount.toFixed(2)}</div>
        </div>
    `;
    
    if (bidList.innerHTML.includes('No bids yet')) {
        bidList.innerHTML = newBidHtml;
    } else {
        bidList.insertAdjacentHTML('afterbegin', newBidHtml);
    }
}

// Modal functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    document.body.style.overflow = 'auto';
}

function showLogin() {
    closeModal('registerModal');
    showModal('loginModal');
}

function showRegister() {
    closeModal('loginModal');
    showModal('registerModal');
}

function showCreateAuction() {
    if (!currentUser) {
        showToast('Please login to create an auction', 'error');
        showLogin();
        return;
    }
    showModal('createAuctionModal');
}

// Utility functions
function formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return 'Ended';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h ${minutes % 60}m remaining`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s remaining`;
    return `${seconds}s remaining`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Timer updates
function startTimers() {
    setInterval(() => {
        auctions.forEach(auction => {
            const timeRemaining = new Date(auction.endTime) - new Date();
            auction.timeRemaining = Math.max(0, timeRemaining);
        });
        
        // Update displayed times
        document.querySelectorAll('.auction-card').forEach(card => {
            const auctionId = card.dataset.id;
            const auction = auctions.find(a => a.id === auctionId);
            if (auction) {
                const timerElement = card.querySelector('.time-remaining');
                const isEnded = auction.timeRemaining <= 0;
                
                if (timerElement) {
                    timerElement.textContent = isEnded ? 'Auction Ended' : formatTimeRemaining(auction.timeRemaining);
                }
                
                if (isEnded && !card.classList.contains('auction-ended')) {
                    card.classList.add('auction-ended');
                    const bidButton = card.querySelector('.btn');
                    if (bidButton) {
                        bidButton.textContent = 'Ended';
                        bidButton.disabled = true;
                    }
                }
            }
        });
        
        updateAuctionCount();
    }, 1000);
}