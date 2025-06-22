import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, getDocs, collectionGroup, orderBy, where } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// --- Helper Functions & Initial Config ---
const safeJSONParse = (str) => {
    try {
        return JSON.parse(str);
    } catch (e) {
        console.error("Failed to parse JSON:", e);
        return {
            apiKey: "YOUR_API_KEY", authDomain: "YOUR_AUTH_DOMAIN", projectId: "YOUR_PROJECT_ID",
            storageBucket: "YOUR_STORAGE_BUCKET", messagingSenderId: "YOUR_MESSAGING_SENDER_ID", appId: "YOUR_APP_ID"
        };
    }
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? safeJSONParse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rotogravure-app';

// --- Icon Components ---
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const EditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>);
const PackageIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m0 0v10l8 4m0-14L4 7m16 0L4 7" /></svg>);
const ChevronLeftIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>);
const SearchIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>);
const HistoryIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" /></svg>);
const ClipboardListIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>);
const XIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ExclamationIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const LockClosedIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400 mb-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>);
const CheckCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>);

// --- Login Screen Component ---
function LoginScreen({ onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        if (username === 'SGI' && password === 'Gurubaba786@') {
            onLoginSuccess();
        } else {
            setError('Invalid username or password.');
        }
    };

    return (
        <div className="bg-gray-900 min-h-screen flex items-center justify-center font-sans">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-sm">
                <div className="flex flex-col items-center">
                    <LockClosedIcon />
                    <h1 className="text-3xl font-bold text-cyan-400 mb-2">Login Required</h1>
                    <p className="text-gray-400 mb-6">Please enter your credentials</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            className="w-full bg-gray-700 text-white p-3 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full bg-gray-700 text-white p-3 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-md transition-transform duration-200 hover:scale-105">
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
}

// --- Main App Component ---
export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [view, setView] = useState('stock');
    const [films, setFilms] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) return;

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authInstance = getAuth(app);
        setDb(firestore);

        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(authInstance, __initial_auth_token);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                } catch (error) {
                    console.error("Authentication error, trying anonymous sign-in:", error);
                     try {
                        await signInAnonymously(authInstance);
                    } catch (anonError) {
                         console.error("Anonymous sign-in also failed:", anonError);
                    }
                }
            }
             setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        
        setIsLoading(true);

        const filmsPath = `artifacts/${appId}/users/${userId}/films`;
        const qFilms = query(collection(db, filmsPath));
        const unsubscribeFilms = onSnapshot(qFilms, (snapshot) => {
            setFilms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching films:", error));

        const jobsPath = `artifacts/${appId}/users/${userId}/jobs`;
        const qJobs = query(collection(db, jobsPath));
        const unsubscribeJobs = onSnapshot(qJobs, (snapshot) => {
            setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching jobs:", error));
        
        const ordersPath = `artifacts/${appId}/users/${userId}/orders`;
        const qOrders = query(collection(db, ordersPath), orderBy("createdAt", "desc"));
        const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
            setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching orders:", error));
        
        Promise.all([
            getDocs(qFilms), getDocs(qJobs), getDocs(qOrders)
        ]).catch(console.error).finally(() => setIsLoading(false));

        return () => {
             unsubscribeFilms();
             unsubscribeJobs();
             unsubscribeOrders();
        };
    }, [isAuthReady, db, userId]);
    
    if (!isAuthenticated) {
        return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
    }
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <div className="flex flex-col items-center"><PackageIcon /><p className="mt-2 text-lg">Loading Inventory...</p></div>
            </div>
        );
    }
    
    return (
        <div className="bg-gray-900 min-h-screen font-sans text-white">
            <div className="container mx-auto p-4 md:p-8">
                <Header />
                <Nav view={view} setView={setView} />
                <main className="mt-8">
                    {view === 'stock' && <FilmInventory films={films} db={db} userId={userId} />}
                    {view === 'jobs' && <JobManagement films={films} jobs={jobs} orders={orders} db={db} userId={userId} />}
                    {view === 'orders' && <OrderManagement films={films} jobs={jobs} orders={orders} db={db} userId={userId} />}
                    {view === 'use_stock' && <UseStock films={films} jobs={jobs} db={db} userId={userId} setView={setView} />}
                    {view === 'film_history' && <FilmHistory db={db} userId={userId} jobs={jobs}/>}
                </main>
            </div>
        </div>
    );
}

// ... (Paste all other components here from the previous code) ...
// The rest of the React components (ConfirmationModal, MarkCompleteModal, Header, etc.)
// should be included below this line.

