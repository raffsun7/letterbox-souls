//
// --- PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE ---
// This is the unique set of keys from your Firebase project.
//
const firebaseConfig = {
  apiKey: "AIzaSyCi8ZuJUm3I0tI_jk-tkz8SOGXMEU3Su0U",
  authDomain: "letterbox-souls.firebaseapp.com",
  projectId: "letterbox-souls",
  storageBucket: "letterbox-souls.firebasestorage.app",
  messagingSenderId: "405915999228",
  appId: "1:405915999228:web:086632a1891734dfe33079"
};
// ----------------------------------------------------


// Initialize Firebase services
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 1. AUTHENTICATION ---
// This section handles logging the user in anonymously.
// It runs as soon as the page loads.
// ----------------------------------------------------
const userStatusParagraph = document.querySelector('p'); // The <p> tag to show status

auth.onAuthStateChanged(user => {
  if (user) {
    // User is signed in.
    console.log("Logged in anonymously as:", user.uid);
    userStatusParagraph.textContent = `Connected! Your anonymous ID is: ${user.uid}`;
  } else {
    // No user is signed in. Let's sign them in.
    console.log("No user found. Signing in anonymously...");
    auth.signInAnonymously().catch(error => {
      console.error("Error signing in anonymously:", error);
      userStatusParagraph.textContent = 'Could not connect. Please refresh the page.';
    });
  }
});


// --- 2. SAVING NEW POSTS ---
// This section handles submitting the main letter form.
// ----------------------------------------------------
const letterForm = document.getElementById('letter-form');

letterForm.addEventListener('submit', (event) => {
    // Prevent the default browser action (which is to refresh the page)
    event.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        alert("You're not connected. Please wait a moment and try again.");
        return; 
    }

    // Get the values from the form fields
    const letterText = document.getElementById('letter-text').value;
    const mood = document.getElementById('mood-select').value;
    
    // Save the new post to the 'posts' collection in Firestore
    db.collection('posts').add({
        text: letterText,
        mood: mood,
        author: user.uid,
        flowers: 0,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then((docRef) => {
        console.log("Post saved with ID: ", docRef.id);
        letterForm.reset(); // Clear the form fields
    })
    .catch((error) => {
        console.error("Error adding post: ", error);
        alert("Sorry, there was an error saving your post.");
    });
});


// --- 3. DISPLAYING ALL POSTS AND COMMENTS (REAL-TIME) ---
// This section listens for any changes in the 'posts' collection
// and automatically updates the webpage.
// ----------------------------------------------------
const postsFeed = document.getElementById('posts-feed');

db.collection('posts').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
    // Clear the existing feed to prevent duplicates
    postsFeed.innerHTML = '<h2>Shared Feelings</h2>';
    
    snapshot.docs.forEach(doc => {
        const post = doc.data();
        const postId = doc.id;
        
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        postCard.setAttribute('data-id', postId);

        const moodEmojis = {
            hope: '🌈', sad: '😔', love: '❤️', lost: '🫠', happy: '😊'
        };

        // Main post content HTML
        postCard.innerHTML = `
            <div class="mood">${moodEmojis[post.mood] || '❓'} ${post.mood}</div>
            <p class="text">${post.text}</p>
            <div class="actions">
                <span>💬 <span class="comment-count">0</span> Comments</span>
                <span class="flower-button" style="cursor: pointer;">🌸 ${post.flowers} Flowers</span>
            </div>
            <div class="comments-container"></div>
            <form class="comment-form">
                <input type="text" placeholder="Write a kind word..." required>
                <button type="submit">Send</button>
            </form>
        `;

        postsFeed.appendChild(postCard);

        // ---- Sub-task: Fetch and display comments for THIS post ----
        const commentsContainer = postCard.querySelector('.comments-container');
        const commentCountSpan = postCard.querySelector('.comment-count');

        db.collection('comments').where('postId', '==', postId).orderBy('timestamp', 'asc').onSnapshot(commentSnapshot => {
            commentsContainer.innerHTML = ''; // Clear old comments
            commentCountSpan.textContent = commentSnapshot.size; // Update comment count

            commentSnapshot.docs.forEach(commentDoc => {
                const commentData = commentDoc.data();
                const commentElement = document.createElement('div');
                commentElement.className = 'comment';
                commentElement.textContent = commentData.text;
                commentsContainer.appendChild(commentElement);
            });
        });
    });

}, (error) => {
    console.error("Error getting posts: ", error);
    postsFeed.innerHTML = '<h2>Shared Feelings</h2><p>Could not load posts. Please check the developer console for errors.</p>';
});


// --- 4. HANDLING INTERACTIONS (FLOWERS AND COMMENTS) ---
// This uses a single event listener on the entire feed
// to efficiently handle all clicks and form submissions inside it.
// ----------------------------------------------------

postsFeed.addEventListener('click', (event) => {
    // --- FLOWER BUTTON LOGIC ---
    if (event.target.classList.contains('flower-button')) {
        const postCard = event.target.closest('.post-card');
        const postId = postCard.dataset.id;
        const user = auth.currentUser;
        if (!user) return;

        const flowerRef = db.collection('flowers').doc(`${postId}_${user.uid}`);

        flowerRef.get().then(doc => {
            if (doc.exists) {
                alert("You've already sent a flower to this post! 💐");
            } else {
                const batch = db.batch();
                batch.set(flowerRef, { postId: postId, sender: user.uid });
                const postRef = db.collection('posts').doc(postId);
                batch.update(postRef, { flowers: firebase.firestore.FieldValue.increment(1) });
                batch.commit().catch(error => console.error("Error sending flower: ", error));
            }
        });
    }
});

postsFeed.addEventListener('submit', (event) => {
    // --- COMMENT FORM LOGIC ---
    if (event.target.classList.contains('comment-form')) {
        event.preventDefault();

        const postCard = event.target.closest('.post-card');
        const postId = postCard.dataset.id;
        const user = auth.currentUser;
        if (!user) return;

        const input = event.target.querySelector('input');
        const commentText = input.value;
        if (commentText.trim() === '') return;

        db.collection('comments').add({
            text: commentText,
            postId: postId,
            author: user.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => input.value = '')
        .catch(error => console.error("Error submitting comment: ", error));
    }
});

