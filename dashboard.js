// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCi8ZuJUm3I0tI_jk-tkz8SOGXMEU3Su0U",
    authDomain: "letterbox-souls.firebaseapp.com",
    projectId: "letterbox-souls",
    storageBucket: "letterbox-souls.appspot.com",
    messagingSenderId: "405915999228",
    appId: "1:405915999228:web:086632a1891734dfe33079"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const myPostsContainer = document.getElementById('my-posts-container');
const myCommentsContainer = document.getElementById('my-comments-container');
const flowerContainer = document.getElementById('flower-container');
const moodChartCanvas = document.getElementById('mood-chart');

// Formatting Functions
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Initialize Dashboard
auth.onAuthStateChanged(user => {
    if (user) {
        loadUserContent(user.uid);
    } else {
        window.location.href = '/auth.html';
    }
});

async function loadUserContent(uid) {
    // Load user's posts
    db.collection('posts')
        .where('author', '==', uid)
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            myPostsContainer.innerHTML = '';
            if (snapshot.empty) {
                myPostsContainer.innerHTML = '<p class="empty-message">You haven\'t shared any feelings yet.</p>';
                return;
            }
            
            snapshot.forEach(doc => {
                const post = doc.data();
                const postElement = document.createElement('div');
                postElement.className = 'user-post';
                postElement.innerHTML = `
                    <p class="post-text">${post.text}</p>
                    <div class="post-meta">
                        <span class="post-mood">${getMoodEmoji(post.mood)}</span>
                        <span class="post-time">${formatDate(post.timestamp.toDate())}</span>
                        <span class="post-stats">🌸 ${post.flowers} • 💬 ${post.commentCount}</span>
                    </div>
                `;
                myPostsContainer.appendChild(postElement);
            });
        });

    // Load user's comments
    db.collection('comments')
        .where('author', '==', uid)
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            myCommentsContainer.innerHTML = '';
            if (snapshot.empty) {
                myCommentsContainer.innerHTML = '<p class="empty-message">You haven\'t left any kind words yet.</p>';
                return;
            }
            
            snapshot.forEach(doc => {
                const comment = doc.data();
                const commentElement = document.createElement('div');
                commentElement.className = 'user-comment';
                commentElement.innerHTML = `
                    <p class="comment-text">${comment.text}</p>
                    <span class="comment-time">${formatDate(comment.timestamp.toDate())}</span>
                `;
                myCommentsContainer.appendChild(commentElement);
            });
        });

    // Load flowers received
    db.collection('posts')
        .where('author', '==', uid)
        .where('flowers', '>', 0)
        .orderBy('flowers', 'desc')
        .limit(30)
        .get()
        .then(snapshot => {
            flowerContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const post = doc.data();
                const flowerElement = document.createElement('div');
                flowerElement.className = 'flower-item';
                flowerElement.innerHTML = `
                    <span class="flower-emoji">🌸</span>
                    <span class="flower-count">${post.flowers}</span>
                    <span class="flower-date">${formatDate(post.timestamp.toDate())}</span>
                `;
                flowerContainer.appendChild(flowerElement);
            });
        });

    // Load mood chart
    db.collection('posts')
        .where('author', '==', uid)
        .get()
        .then(snapshot => {
            const moodData = {};
            snapshot.forEach(doc => {
                const mood = doc.data().mood;
                moodData[mood] = (moodData[mood] || 0) + 1;
            });
            
            new Chart(moodChartCanvas, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(moodData),
                    datasets: [{
                        data: Object.values(moodData),
                        backgroundColor: [
                            '#7c3aed', '#3b82f6', '#ec4899', 
                            '#f59e0b', '#ef4444', '#6b7280'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#e2e8f0'
                            }
                        }
                    }
                }
            });
        });
}

function getMoodEmoji(mood) {
    const emojis = {
        hope: '🌈',
        sad: '😔',
        love: '❤️',
        lost: '🫠',
        happy: '😊'
    };
    return emojis[mood] || '💭';
}