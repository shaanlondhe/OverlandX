import TrailManager from './trailManager.js';

// Initialize variables
let currentTrail = null;
let trailPath = null;
let trailManager = null;

// Initialize the application
async function init() {
    try {
        // Create trail manager
        trailManager = new TrailManager();
        
        // Initialize map
        await trailManager.initMap();
        console.log('Map initialized successfully');
        
        // Load trail data
        await trailManager.loadTrailData();
        console.log('Trail data loaded successfully');
        
        // Set up event listeners
        setupEventListeners();
        console.log('Event listeners set up');
        
        // Populate trail list
        populateTrailList();
        console.log('Trail list populated');
        
    } catch (error) {
        console.error('Error in initialization:', error);
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('errorMessage').innerHTML = `Error: ${error.message}. <button onclick="window.location.reload()">Retry</button>`;
    }
}

// Set up event listeners
function setupEventListeners() {
    document.getElementById('chatToggle').addEventListener('click', toggleChat);
    document.getElementById('closeChat').addEventListener('click', toggleChat);
    document.getElementById('sendMessage').addEventListener('click', handleMessage);
    document.getElementById('userInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleMessage();
    });
}

// Toggle chat window
function toggleChat() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.style.display = chatContainer.style.display === 'none' ? 'flex' : 'none';
}

// Handle chat message
function handleMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    if (!message) return;

    // Display user message
    appendMessage('user', message);
    input.value = '';

    // Process the message and generate response
    const response = generateResponse(message.toLowerCase(), trailManager.getAllTrails());
    appendMessage('assistant', response);
}

// Generate response based on user message
function generateResponse(message, trails) {
    // Check for greetings
    if (message.match(/^(hi|hello|hey|howdy)/i)) {
        return "Hello! I'm your trail assistant. I can help you find trails based on location, difficulty, or length. What kind of trail are you looking for?";
    }

    // Initialize matches array
    let matches = [];

    // Location-based queries
    if (message.includes('near')) {
        const locations = ['death valley', 'yosemite', 'sierra', 'mojave', 'anza borrego'];
        for (let loc of locations) {
            if (message.includes(loc)) {
                matches = trails.filter(trail => 
                    trail.name.toLowerCase().includes(loc) || 
                    (trail.region && trail.region.toLowerCase().includes(loc))
                );
            }
        }
    }

    // Difficulty-based queries
    if (message.includes('difficult') || message.includes('hard') || message.includes('challenging')) {
        matches = trails.filter(trail => trail.peakRating >= 4);
    } else if (message.includes('easy') || message.includes('beginner')) {
        matches = trails.filter(trail => trail.avgRating <= 3);
    }

    // Length-based queries
    if (message.includes('long') || message.includes('multi-day')) {
        matches = trails.filter(trail => parseInt(trail.distance) > 50);
    } else if (message.includes('short') || message.includes('day trip')) {
        matches = trails.filter(trail => parseInt(trail.distance) <= 50);
    }

    // If no specific matches, but asking about trails
    if (matches.length === 0 && message.includes('trail')) {
        matches = trails;
    }

    // Generate response
    if (matches.length > 0) {
        const trailList = matches.map(trail => 
            `${trail.name} (${trail.distance} miles, Technical Rating: ${trail.avgRating})`
        ).join('\n');
        return `Here are some trails that might interest you:\n${trailList}\n\nWould you like more details about any of these trails?`;
    }

    // Default response
    return "I can help you find trails based on location (like 'near Death Valley'), difficulty (easy/hard), or length (short/long). What kind of trail are you looking for?";
}

// Append message to chat
function appendMessage(sender, text) {
    const messages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

// Populate trail list
function populateTrailList() {
    const trailList = document.getElementById('trailList');
    trailList.innerHTML = ''; // Clear existing trails
    
    trailManager.getAllTrails().forEach(trail => {
        const trailDiv = document.createElement('div');
        trailDiv.className = 'trail-item';
        trailDiv.setAttribute('data-trail-id', trail.id);
        
        // Create the main content
        const mainContent = `
            <h3>${trail.name}</h3>
            <div class="trail-details">
                <p class="stats">${trail.distance} mi, ${trail.time}</p>
                ${trail.avgRating ? `<p>Avg Technical Rating: ${trail.avgRating}</p>` : ''}
                ${trail.peakRating ? `<p>Peak Technical Rating: ${trail.peakRating}</p>` : ''}
                ${trail.terrain ? `<p class="terrain">Typical Terrain: ${trail.terrain}</p>` : ''}
            </div>
        `;

        trailDiv.innerHTML = mainContent;

        // Add click handler for expansion
        trailDiv.addEventListener('click', (e) => {
            // Toggle expanded class
            trailDiv.classList.toggle('expanded');
            
            // If not clicking on the details section, also select the trail
            if (!e.target.closest('.trail-details')) {
                selectTrail(trail.id);
            }
        });

        trailList.appendChild(trailDiv);
    });
}

// Select a trail
function selectTrail(trailId) {
    const trail = trailManager.getTrail(trailId);
    if (!trail) return;

    currentTrail = trail;
    
    // Display trail on map
    trailPath = trailManager.displayTrailOnMap(trailId);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init(); 
} 