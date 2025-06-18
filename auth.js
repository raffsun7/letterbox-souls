// --- LetterBox Souls: Final, Fully Functional Authentication Logic ---

// --- 1. FIREBASE INITIALIZATION ---
// NOTE: Make sure to paste your own Firebase config object here.
const firebaseConfig = {
  apiKey: "AIzaSyCi8ZuJUm3I0tI_jk-tkz8SOGXMEU3Su0U",
  authDomain: "letterbox-souls.firebaseapp.com",
  projectId: "letterbox-souls",
  storageBucket: "letterbox-souls.firebasestorage.app",
  messagingSenderId: "405915999228",
  appId: "1:405915999228:web:086632a1891734dfe33079"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 2. DOM ELEMENT REFERENCES ---
const container = document.getElementById('container');
const signUpButton = document.getElementById('signUpButton');
const signInButton = document.getElementById('signInButton');

// Forms & Error Messages
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

// Modals & Links
const usernameModal = document.getElementById('username-modal');
const usernameForm = document.getElementById('username-form');
const modalError = document.getElementById('modal-error');
const crisisModal = document.getElementById('crisis-modal');
const showCrisisLink = document.getElementById('show-crisis-resources');
const closeCrisisBtn = document.getElementById('close-crisis-modal');
const forgotPasswordLink = document.getElementById('forgot-password-link');

// --- 3. UI EVENT LISTENERS (PANEL SLIDING & MODALS) ---
if (signUpButton) {
    signUpButton.addEventListener('click', () => {
        container.classList.add('right-panel-active');
    });
}
if (signInButton) {
    signInButton.addEventListener('click', () => {
        container.classList.remove('right-panel-active');
    });
}
if (showCrisisLink) {
    showCrisisLink.addEventListener('click', (e) => {
        e.preventDefault();
        crisisModal.classList.add('active');
    });
}
if (closeCrisisBtn) {
    closeCrisisBtn.addEventListener('click', () => {
        crisisModal.classList.remove('active');
    });
}

// --- 4. AUTHENTICATION LOGIC ---

// Enhanced Error Handling Function
function enhanceAuthError(error) {
    const errorMap = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email': 'Please enter a valid email.',
        'auth/operation-not-allowed': 'Authentication temporarily disabled.',
        'auth/weak-password': 'Password must be at least 6 characters long.',
        'auth/user-disabled': 'This account has been disabled by an administrator.',
        'auth/user-not-found': 'No account found with this email or username.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/too-many-requests': 'Too many attempts. Your account is temporarily locked. Please try again later.'
    };
    return new Error(errorMap[error.code] || "An unexpected error occurred. Please try again.");
}

// -- Registration with Email/Password --
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';
        const username = document.getElementById('register-username').value.toLowerCase().trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;

        if (username.length < 3) return registerError.textContent = 'Username must be at least 3 characters.';
        if (password.length < 6) return registerError.textContent = 'Password must be at least 6 characters.';

        try {
            // Step 1: Check if username is unique in our database
            const usernameQuery = await db.collection('user_profiles').where('username', '==', username).get();
            if (!usernameQuery.empty) {
                return registerError.textContent = 'This username is already taken. Please choose another.';
            }

            // Step 2: Create user with Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Step 3: Send email verification
            await user.sendEmailVerification();
            registerError.textContent = 'Registration successful! Please check your email inbox (and spam folder) to verify your account.';

            // Step 4: Store user profile info in Firestore
            await db.collection('user_profiles').doc(user.uid).set({
                username: username,
                email: email,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            registerForm.reset();

        } catch (error) {
            console.error("Registration Error:", error);
            registerError.textContent = enhanceAuthError(error).message;
        }
    });
}

// -- Login with Username/Email & Password --
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        let identifier = document.getElementById('login-identifier').value.trim();
        const password = document.getElementById('login-password').value;
        let email = identifier;

        try {
            // Step 1: If identifier is a username (no '@'), look up the email
            if (!identifier.includes('@')) {
                const usernameQuery = await db.collection('user_profiles').where('username', '==', identifier.toLowerCase()).get();
                if (usernameQuery.empty) {
                    return loginError.textContent = 'User not found.';
                }
                // Get the email associated with that username
                email = usernameQuery.docs[0].data().email;
            }

            // Step 2: Sign in with the resolved email and password
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Step 3: Check if email is verified
            if (!user.emailVerified) {
                auth.signOut(); // Log them out so they can't proceed
                return loginError.textContent = 'Please verify your email before logging in. You can request a new verification email if needed.';
            }

            // Step 4: Redirect to the main app on successful login
            window.location.href = '/index.html';

        } catch (error) {
            console.error("Login Error:", error);
            loginError.textContent = enhanceAuthError(error).message;
        }
    });
}

// -- Google Sign-In Handler --
const googleLoginBtn = document.getElementById('google-login-btn');
const googleRegisterBtn = document.getElementById('google-register-btn');

const handleGoogleSignIn = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        // Check if the user already has a profile in our database
        const userDoc = await db.collection('user_profiles').doc(user.uid).get();
        if (!userDoc.exists) {
            // If they are a new user to our app, force them to choose a username
            showUsernameModal(user);
        } else {
            // If they are an existing user, redirect to the main app
            window.location.href = '/index.html';
        }
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        if (loginError) loginError.textContent = enhanceAuthError(error).message;
        if (registerError) registerError.textContent = enhanceAuthError(error).message;
    }
};

if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleSignIn);
if (googleRegisterBtn) googleRegisterBtn.addEventListener('click', handleGoogleSignIn);

// -- Username Modal for Google Sign-up --
if (usernameModal) {
    function showUsernameModal(user) {
        usernameModal.classList.add('active');
        if (usernameForm) {
            usernameForm.onsubmit = async (e) => {
                e.preventDefault();
                modalError.textContent = '';
                const username = document.getElementById('modal-username').value.toLowerCase().trim();

                if (username.length < 3) return modalError.textContent = 'Username must be at least 3 characters.';

                const usernameQuery = await db.collection('user_profiles').where('username', '==', username).get();
                if (!usernameQuery.empty) return modalError.textContent = 'This username is already taken.';

                // Save the new user's profile with their chosen username
                await db.collection('user_profiles').doc(user.uid).set({
                    username: username,
                    email: user.email,
                    avatarUrl: user.photoURL,
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                usernameModal.classList.remove('active');
                window.location.href = '/index.html';
            };
        }
    }
}

// -- Password Reset Logic --
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = prompt("Please enter your account email to receive a password reset link:");
        if (email) {
            try {
                await auth.sendPasswordResetEmail(email);
                loginError.textContent = 'Password reset link sent! Check your inbox (and spam folder).';
            } catch (error) {
                loginError.textContent = enhanceAuthError(error).message;
            }
        }
    });
}