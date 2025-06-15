// --- PASTE YOUR FIREBASE CONFIG OBJECT HERE ---
const firebaseConfig = {
  apiKey: "AIzaSyCi8ZuJUm3I0tI_jk-tkz8SOGXMEU3Su0U",
  authDomain: "letterbox-souls.firebaseapp.com",
  projectId: "letterbox-souls",
  storageBucket: "letterbox-souls.firebasestorage.app",
  messagingSenderId: "405915999228",
  appId: "1:405915999228:web:086632a1891734dfe33079"
};
// ---------------------------------------------

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Get references to the containers
const myPostsContainer = document.getElementById('my-posts-container');
const myCommentsContainer = document.getElementById('my-comments-container');

// Listen for authentication state
auth.onAuthStateChanged(user => {
    if (user) {
        // User is logged in, fetch their content
        const uid = user.uid;
        loadMyPosts(uid);
        loadMyComments(uid);
    } else {
        // No user is logged in. Redirect to home page.
        console.log("No user found, redirecting to home.");
        window.location.href = '/';
    }
});

// Function to fetch and display the user's posts
function loadMyPosts(uid) {
    db.collection('posts').where('author', '==', uid).orderBy('timestamp', 'desc').get()
        .then(snapshot => {
            myPostsContainer.innerHTML = ''; // Clear loading message
            if (snapshot.empty) {
                myPostsContainer.innerHTML = '<p>You have not written any letters yet.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const post = doc.data();
                const postElement = document.createElement('div');
                postElement.innerHTML = `<p>"${post.text}" <span class="delete-button" data-id="${doc.id}">delete</span></p>`;
                myPostsContainer.appendChild(postElement);
            });
        });
}

// Function to fetch and display the user's comments
function loadMyComments(uid) {
    db.collection('comments').where('author', '==', uid).orderBy('timestamp', 'desc').get()
        .then(snapshot => {
            myCommentsContainer.innerHTML = ''; // Clear loading message
            if (snapshot.empty) {
                myCommentsContainer.innerHTML = '<p>You have not written any comments yet.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const comment = doc.data();
                const commentElement = document.createElement('p');
                commentElement.textContent = `You commented: "${comment.text}"`;
                myCommentsContainer.appendChild(commentElement);
            });
        });
}

// ---- Add Delete Functionality ----
myPostsContainer.addEventListener('click', event => {
    if (event.target.classList.contains('delete-button')) {
        const postId = event.target.dataset.id;
        if (confirm("Are you sure you want to delete this post? This cannot be undone.")) {
            db.collection('posts').doc(postId).delete()
            .then(() => {
                console.log("Post deleted successfully!");
                event.target.parentElement.remove(); // Remove from the UI
            })
            .catch(error => console.error("Error deleting post: ", error));
        }
    }
});