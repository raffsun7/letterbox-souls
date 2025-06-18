// --- app.js (Full Version with Public Comments & Correct Sorting) ---

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
const storage = firebase.storage();

// DOM Elements
const mainNav = document.querySelector('.main-nav');
const pageSections = document.querySelectorAll('.page-section');
const userProfileSection = document.getElementById('user-profile-section');
const postsFeed = document.getElementById('posts-feed');
const letterForm = document.getElementById('letter-form');

// --- Post Manager Class (Updated Data Model) ---
class PostManager {
    async createPost(text, mood) {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("User not authenticated.");

        const postData = {
            text: text.substring(0, 500),
            mood,
            author: currentUser.uid,
            flowers: 0,
            flowerGivers: [],
            commentCount: 0,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: firebase.firestore.Timestamp.fromDate(
                new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
            )
        };
        return await db.collection('posts').add(postData);
    }

    async toggleFlower(postId, userId) {
        const postRef = db.collection('posts').doc(postId);
        return db.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists) throw "Document does not exist!";
            
            const flowerGivers = postDoc.data().flowerGivers || [];
            let newFlowerCount;

            if (flowerGivers.includes(userId)) {
                transaction.update(postRef, { flowerGivers: firebase.firestore.FieldValue.arrayRemove(userId) });
                newFlowerCount = flowerGivers.length - 1;
            } else {
                transaction.update(postRef, { flowerGivers: firebase.firestore.FieldValue.arrayUnion(userId) });
                newFlowerCount = flowerGivers.length + 1;
            }
            transaction.update(postRef, { flowers: newFlowerCount < 0 ? 0 : newFlowerCount });
        });
    }

    // UPDATED: This function now adds a comment to the post's subcollection
    async addComment(postId, text) {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("User not authenticated.");
        
        const postRef = db.collection('posts').doc(postId);
        // NEW: Reference the subcollection for comments
        const commentRef = postRef.collection('comments').doc();
        
        const batch = db.batch();
        
        // Increment the comment count on the parent post
        batch.update(postRef, { commentCount: firebase.firestore.FieldValue.increment(1) });
        
        // Create the new comment document in the subcollection
        batch.set(commentRef, {
            text,
            postId, // Keep postId for potential collectionGroup queries
            author: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
    }
    
    // UPDATED: Correct sorting to show newest posts first
    getPostsQuery() {
        return db.collection('posts')
            .where('expiresAt', '>', new Date())
            .orderBy('timestamp', 'desc')
            .limit(50);
    }
}

// --- UI Rendering Functions (Updated) ---
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'just now';
    const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function getMoodEmoji(mood) {
    const emojis = { hope: '🌈', sad: '😔', love: '❤️', lost: '🫠', happy: '😊' };
    return emojis[mood] || '💭';
}

function renderPost(doc) {
    const post = doc.data();
    const postId = doc.id;
    const currentUser = auth.currentUser;
    const userHasReacted = currentUser && post.flowerGivers && post.flowerGivers.includes(currentUser.uid);

    const postElement = document.createElement('div');
    postElement.className = 'post-card';
    postElement.dataset.id = postId;
    postElement.innerHTML = `
        <div class="post-content">
            <div class="post-header"><img src="images/default-avatar.png" alt="Anonymous" class="post-avatar"><div class="post-mood">${getMoodEmoji(post.mood)}</div></div>
            <p class="post-text">${post.text}</p>
            <div class="post-footer">
                <span class="post-time">${formatTimeAgo(post.timestamp)} • Expires in ${Math.ceil((post.expiresAt.toDate() - new Date()) / (1000 * 60 * 60 * 24))}d</span>
                <div class="post-actions">
                    <span class="comment-count-display">${post.commentCount} kind words</span>
                    <button class="flower-button ${userHasReacted ? 'reacted' : ''}">🌸 ${post.flowers}</button>
                </div>
            </div>
        </div>
        <div class="comments-section">
            <div class="comments-container"></div>
        </div>
        <form class="comment-form">
            <input type="text" placeholder="Leave a kind word..." required><button type="submit">Send</button>
        </form>
    `;
    postsFeed.appendChild(postElement);

    // UPDATED: This listener fetches from the post's subcollection
    db.collection('posts').doc(postId).collection('comments').orderBy('timestamp', 'asc').onSnapshot(snapshot => {
        const container = postElement.querySelector('.comments-container');
        const commentCountDisplay = postElement.querySelector('.comment-count-display');
        
        container.innerHTML = '';
        // Use the post's commentCount for immediate feedback, and snapshot.size for real-time accuracy.
        commentCountDisplay.textContent = `${snapshot.size} kind words`;

        snapshot.forEach(commentDoc => {
            const comment = commentDoc.data();
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `<img src="images/default-avatar.png" alt="Anonymous" class="comment-avatar"><div class="comment-body"><p class="comment-text">${comment.text}</p><span class="comment-time">${formatTimeAgo(comment.timestamp)}</span></div>`;
            container.appendChild(commentElement);
        });
    });
}


// --- Dashboard Logic (Updated) ---
function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function loadDashboardContent(uid) {
    const myPostsContainer = document.getElementById('my-posts-container');
    const myCommentsContainer = document.getElementById('my-comments-container');
    const flowerContainer = document.getElementById('flower-container');
    const moodChartCanvas = document.getElementById('mood-chart');
    
    if (!myPostsContainer || !myCommentsContainer || !flowerContainer || !moodChartCanvas) return;

    db.collection('posts').where('author', '==', uid).orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        myPostsContainer.innerHTML = '';
        if (snapshot.empty) { myPostsContainer.innerHTML = '<p class="empty-message">You haven\'t shared any letters yet.</p>'; return; }
        snapshot.forEach(doc => {
            const post = doc.data();
            const postElement = document.createElement('div');
            postElement.className = 'user-post';
            postElement.innerHTML = `<p class="post-text">${post.text}</p><div class="post-meta"><span class="post-mood">${getMoodEmoji(post.mood)}</span><span class="post-time">${formatDate(post.timestamp?.toDate())}</span><span class="post-stats">🌸 ${post.flowers} • 💬 ${post.commentCount}</span></div>`;
            myPostsContainer.appendChild(postElement);
        });
    });

    // UPDATED: Use a collectionGroup query to find all comments by the user across all posts
    db.collectionGroup('comments').where('author', '==', uid).orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        myCommentsContainer.innerHTML = '';
        if (snapshot.empty) { myCommentsContainer.innerHTML = '<p class="empty-message">You haven\'t left any kind words yet.</p>'; return; }
        snapshot.forEach(doc => {
            const comment = doc.data();
            const commentElement = document.createElement('div');
            commentElement.className = 'user-comment';
            commentElement.innerHTML = `<p class="comment-text">${comment.text}</p><span class="comment-time">${formatDate(comment.timestamp?.toDate())}</span>`;
            myCommentsContainer.appendChild(commentElement);
        });
    });

    db.collection('posts').where('author', '==', uid).orderBy('flowers', 'desc').limit(30).get().then(snapshot => {
        flowerContainer.innerHTML = '';
        if (snapshot.empty) { flowerContainer.innerHTML = '<p class="empty-message">No flowers received yet.</p>'; }
        snapshot.forEach(doc => {
            const post = doc.data();
            const flowerElement = document.createElement('div');
            flowerElement.className = 'flower-item';
            flowerElement.innerHTML = `<span class="flower-emoji">🌸</span><span class="flower-count">${post.flowers}</span><span class="flower-date">${formatDate(post.timestamp?.toDate())}</span>`;
            flowerContainer.appendChild(flowerElement);
        });
    });

    const posts = await db.collection('posts').where('author', '==', uid).get();
    const moodData = {};
    posts.forEach(doc => {
        const mood = doc.data().mood;
        moodData[mood] = (moodData[mood] || 0) + 1;
    });
    
    let chartStatus = Chart.getChart(moodChartCanvas);
    if (chartStatus != undefined) { chartStatus.destroy(); }

    if (Object.keys(moodData).length > 0) {
        new Chart(moodChartCanvas, {
            type: 'doughnut',
            data: { labels: Object.keys(moodData), datasets: [{ data: Object.values(moodData), backgroundColor: ['#7c3aed', '#3b82f6', '#ec4899', '#f59e0b', '#ef4444', '#6b7280'], borderWidth: 0 }] },
            options: { cutout: '70%', plugins: { legend: { position: 'right', labels: { color: '#e2e8f0' } } } }
        });
    }
}

// --- Initialize App & Event Listeners ---
const postManager = new PostManager();

auth.onAuthStateChanged(user => {
    if (user) {
        userProfileSection.innerHTML = `<div class="user-avatar-container"><img src="images/default-avatar.png" alt="You" class="user-avatar"><span>You</span></div><button id="logout-button">Logout</button>`;
        document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
        
        postManager.getPostsQuery().onSnapshot(snapshot => {
            postsFeed.innerHTML = '';
            if (snapshot.empty) { postsFeed.innerHTML = '<p class="empty-feed">No feelings shared yet. Be the first!</p>'; return; }
            snapshot.forEach(doc => renderPost(doc));
        }, error => {
            console.error("Error with posts listener:", error);
            postsFeed.innerHTML = '<p class="empty-feed">Could not load feelings.</p>';
        });
        loadDashboardContent(user.uid);
    } else {
        userProfileSection.innerHTML = '<a href="/auth.html" id="auth-link">Login</a>';
        postsFeed.innerHTML = '<p class="empty-feed">Please log in to see and share feelings.</p>';
    }
});

letterForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!auth.currentUser) { alert("Please login to share your feelings."); return; }
    const text = document.getElementById('letter-text').value;
    const mood = document.getElementById('mood-select').value;
    try {
        await postManager.createPost(text, mood);
        letterForm.reset();
        document.querySelector('.nav-link[data-target="feed"]').click();
    } catch (error) {
        console.error("Error creating post:", error);
        alert("Couldn't share your feeling. Please try again.");
    }
});

document.addEventListener('click', async e => {
    if (e.target.classList.contains('flower-button')) {
        const currentUser = auth.currentUser;
        if (!currentUser) { alert("Please login to give flowers."); return; }
        const postCard = e.target.closest('.post-card');
        const postId = postCard.dataset.id;
        e.target.classList.toggle('reacted');
        try {
            await postManager.toggleFlower(postId, currentUser.uid);
        } catch (error) {
            console.error("Error toggling flower:", error);
            e.target.classList.toggle('reacted');
            alert("Couldn't update reaction. Please try again.");
        }
    }
});

document.addEventListener('submit', async e => {
    if (e.target.classList.contains('comment-form')) {
        e.preventDefault();
        if (!auth.currentUser) { alert("Please login to leave kind words."); return; }
        const input = e.target.querySelector('input');
        const text = input.value.trim();
        if (!text) return;
        const postId = e.target.closest('.post-card').dataset.id;
        try {
            await postManager.addComment(postId, text);
            input.value = '';
        } catch (error) {
            console.error("Error adding comment:", error);
            alert("Couldn't leave your kind word. Please try again.");
        }
    }
});

mainNav.addEventListener('click', e => {
    const navLink = e.target.closest('.nav-link');
    if (!navLink) return;
    e.preventDefault();
    
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    navLink.classList.add('active');
    
    const targetId = navLink.dataset.target;
    document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');

    if (targetId === 'dashboard' && auth.currentUser) {
        loadDashboardContent(auth.currentUser.uid);
    }
});
