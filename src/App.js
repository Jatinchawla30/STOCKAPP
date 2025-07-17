import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, getDocs, collectionGroup, orderBy, where, setLogLevel, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// --- PDF Export Helper ---
const exportToPDF = (title, head, body, fileName) => {
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        alert("PDF library is still loading. Please try again in a moment.");
        return;
    }
    try {
        const doc = new window.jspdf.jsPDF();
        const sanitizedBody = body.map(row =>
            row.map(cell => String(cell === null || cell === undefined ? 'N/A' : cell))
        );
        doc.text(title, 14, 16);
        doc.setFontSize(10);
        doc.text(`Report generated on: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.autoTable({ startY: 30, head: head, body: sanitizedBody });
        doc.save(fileName);
    } catch (error) {
        alert("An unexpected error occurred while generating the PDF. See the console for details.");
        console.error("PDF Generation Error:", error);
    }
};


// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyCMKc3d6o_pz82JUsQoNivQP28Yx8edrPg",
    authDomain: "stock-manager-v2.firebaseapp.com",
    projectId: "stock-manager-v2",
    storageBucket: "stock-manager-v2.appspot.com",
    messagingSenderId: "1076558999625",
    appId: "1:1076558999625:web:027444deb458b1711f8f98"
};
const appId = "stock-manager-v2";

// --- DATE HELPER FUNCTIONS ---
const toYYYYMMDD = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = (`0${d.getMonth() + 1}`).slice(-2);
    const day = (`0${d.getDate()}`).slice(-2);
    return `${year}-${month}-${day}`;
};

const toDDMMYYYY = (date) => {
    if (!date) return 'N/A';
    try {
        const d = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) {
             const parsed = new Date(date);
             if(isNaN(parsed.getTime())) return 'Invalid Date';
             const day = (`0${parsed.getDate()}`).slice(-2);
             const month = (`0${parsed.getMonth() + 1}`).slice(-2);
             const year = parsed.getFullYear();
             return `${day}/${month}/${year}`;
        }
        const day = (`0${d.getDate()}`).slice(-2);
        const month = (`0${d.getMonth() + 1}`).slice(-2);
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return 'Invalid Date';
    }
};

// --- Icon Components ---
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const EditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>);
const PackageIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m0 0v10l8 4m0-14L4 7m16 0L4 7" /></svg>);
const ChevronLeftIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>);
const SearchIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>);
const HistoryIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" /></svg>);
const ClipboardListIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>);
const DownloadIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>);
const XIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ExclamationIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const LockClosedIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400 mb-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>);
const CheckCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>);
const ArrowUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" /></svg>;
const ArrowDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" /></svg>;
const LightBulbIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
const ChartBarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>;


// Reusable helper function to calculate stock status for a job.
const calculateStockStatus = (job, films) => {
    if (!job || !job.materials || job.materials.length === 0) {
        return { ready: true, details: [] };
    }
    let ready = true;
    const details = job.materials.map(material => {
        const matchingFilms = films.filter(f => f.filmType.toLowerCase() === material.toLowerCase() && f.currentWeight > 0);
        const inStock = matchingFilms.length > 0;
        if (!inStock) ready = false;
        return {
            name: material,
            inStock,
            rollCount: matchingFilms.length,
            totalWeight: matchingFilms.reduce((sum, film) => sum + (film.currentWeight || 0), 0)
        };
    });
    return { ready, details };
};


// --- Main App Component ---
function App() {
    const [user, setUser] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [view, setView] = useState('dashboard');
    const [films, setFilms] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPdfReady, setIsPdfReady] = useState(false);

    // Effect to reliably load PDF scripts sequentially.
    useEffect(() => {
        const jspdfScriptId = 'jspdf-script';
        const autoTableScriptId = 'jspdf-autotable-script';
        
        if (isPdfReady) return;

        const loadScript = (id, src, onLoad) => {
            if (document.getElementById(id)) {
                if(onLoad) onLoad();
                return;
            }
            const script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.async = true;
            script.onload = onLoad;
            document.head.appendChild(script);
        };
        
        loadScript(jspdfScriptId, "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => {
            loadScript(autoTableScriptId, "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js", () => {
                setIsPdfReady(true);
            });
        });

    }, [isPdfReady]);


    // Effect for initializing Firebase and handling authentication
    useEffect(() => {
        setLogLevel('debug');
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authInstance = getAuth(app);
        setDb(firestore);
        setAuth(authInstance);

        const unsubscribe = onAuthStateChanged(authInstance, (user) => {
            setUser(user);
            setIsAuthReady(true);
        });
        
        return () => unsubscribe();
    }, []);

    // Effect for fetching data from Firestore, dependent on user authentication
    useEffect(() => {
        if (!isAuthReady || !db || !user) {
            if(isAuthReady) setIsLoading(false);
            setFilms([]);
            setJobs([]);
            setOrders([]);
            return;
        }

        setIsLoading(true);

        const filmsPath = `artifacts/${appId}/users/${user.uid}/films`;
        const qFilms = query(collection(db, filmsPath));
        const unsubscribeFilms = onSnapshot(qFilms, (snapshot) => {
            setFilms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching films:", error));

        const jobsPath = `artifacts/${appId}/users/${user.uid}/jobs`;
        const qJobs = query(collection(db, jobsPath), orderBy("createdAt", "desc"));
        const unsubscribeJobs = onSnapshot(qJobs, (snapshot) => {
            setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching jobs:", error));

        const ordersPath = `artifacts/${appId}/users/${user.uid}/orders`;
        const qOrders = query(collection(db, ordersPath));
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
    }, [isAuthReady, db, user]);

    const handleLogout = () => {
        if(auth) signOut(auth);
    };
    
    if (!isAuthReady) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><div className="flex flex-col items-center"><PackageIcon /><p className="mt-2 text-lg">Initializing...</p></div></div>;
    }

    if (!user) {
        return <LoginScreen auth={auth} />;
    }
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><div className="flex flex-col items-center"><PackageIcon /><p className="mt-2 text-lg">Loading Inventory...</p></div></div>;
    }
    
    return (
        <div className="bg-gray-900 min-h-screen font-sans text-white">
            <div className="container mx-auto p-4 md:p-8 relative">
                <Header user={user} />
                <Nav view={view} setView={setView} />
                 <button onClick={handleLogout} className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Logout</button>
                <main className="mt-8">
                    {view === 'dashboard' && <Dashboard films={films} orders={orders} jobs={jobs} db={db} userId={user.uid} isPdfReady={isPdfReady} />}
                    {view === 'stock' && <FilmInventory films={films} db={db} userId={user.uid} isPdfReady={isPdfReady} />}
                    {view === 'jobs' && <JobManagement films={films} jobs={jobs} orders={orders} db={db} userId={user.uid} setView={setView} isPdfReady={isPdfReady} />}
                    {view === 'orders' && <OrderManagement films={films} jobs={jobs} orders={orders} db={db} userId={user.uid} isPdfReady={isPdfReady} />}
                    {view === 'use_stock' && <UseStock films={films} jobs={jobs} db={db} userId={user.uid} setView={setView} />}
                    {view === 'film_history' && <FilmHistory db={db} userId={user.uid} jobs={jobs} setView={setView} isPdfReady={isPdfReady} />}
                </main>
            </div>
        </div>
    );
}

// All other components are included below for completeness.
const LoginScreen = React.memo(function LoginScreen({ auth }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = useCallback(async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            if (error.code === 'auth/operation-not-allowed') {
                setError(`Login failed: Email/Password sign-in is not enabled for project ${firebaseConfig.projectId}.`);
            } else {
                setError('Failed to log in. Please check your email and password.');
            }
            console.error("Login Error:", error);
        }
    }, [auth, email, password]);

    return (
        <div className="bg-gray-900 min-h-screen flex items-center justify-center font-sans">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-sm">
                <div className="flex flex-col items-center">
                    <LockClosedIcon />
                    <h1 className="text-3xl font-bold text-cyan-400 mb-2">Login</h1>
                    <p className="text-gray-400 mb-6">Please enter your credentials</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email"
                            className="w-full bg-gray-700 text-white p-3 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none transition" />
                    </div>
                    <div>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password"
                            className="w-full bg-gray-700 text-white p-3 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none transition" />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-md transition-transform duration-200 hover:scale-105">
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
});

// --- MODAL AND HEADER COMPONENTS ---
const ConfirmationModal = React.memo(function ConfirmationModal({ isOpen, onClose, onConfirm, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4 text-center">
                <div className="flex justify-center mb-4"><ExclamationIcon /></div>
                <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
                <div className="text-gray-300 mb-6">{children}</div>
                <div className="flex justify-center gap-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Confirm Delete</button>
                </div>
            </div>
        </div>
    );
});

const MarkCompleteModal = React.memo(function MarkCompleteModal({ isOpen, onClose, onConfirm, order }) {
    const [completionDate, setCompletionDate] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if(isOpen) {
            setCompletionDate(toYYYYMMDD(new Date()));
            setNotes('');
        }
    }, [isOpen]);
    
    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(order.id, new Date(completionDate + 'T00:00:00Z'), notes);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">Complete Order</h3>
                <p className="text-gray-300 mb-4">Select a completion date for order <strong className="text-white">{order?.orderName}</strong>.</p>
                <label className="block text-sm font-medium text-gray-300 mb-1">Completion Date</label>
                <input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none mb-4" />
                
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes (Optional)</label>
                <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add any notes for this completed order..."
                    className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none mb-6 h-24"
                />

                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Confirm Completion</button>
                </div>
            </div>
        </div>
    );
});

const MessageModal = React.memo(function MessageModal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;
    return (
       <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4 text-center">
                <h3 className="text-2xl font-bold text-cyan-400 mb-4">{title}</h3>
                <div className="text-gray-300 mb-6">{children}</div>
                <button onClick={onClose} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">OK</button>
            </div>
        </div>
    );
});

const Header = React.memo(function Header({ user }) {
    return (
        <header className="mb-8 text-center md:text-left">
            <h2 className="text-2xl font-semibold text-gray-300">SHRI GURUNANAK INDUSTRIES</h2>
            <h1 className="text-4xl md:text-5xl font-bold text-cyan-400">Rotogravure Stock Manager</h1>
            {user && (<div className="mt-2 text-xs text-yellow-300"><p>Logged in as: {user.email || user.uid}</p></div>)}
            <p className="text-gray-400 mt-2">Your central hub for film inventory and job tracking.</p>
        </header>
    );
});

const NavButton = React.memo(function NavButton({ text, isActive, onClick }) {
    return (
        <button onClick={onClick} className={`px-3 py-2 rounded-t-lg text-sm md:text-base font-semibold transition-colors duration-200 focus:outline-none ${isActive ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:bg-gray-800'}`}>{text}</button>
    );
});

const Nav = React.memo(function Nav({ view, setView }) {
    const setViewDashboard = useCallback(() => setView('dashboard'), [setView]);
    const setViewStock = useCallback(() => setView('stock'), [setView]);
    const setViewJobs = useCallback(() => setView('jobs'), [setView]);
    const setViewOrders = useCallback(() => setView('orders'), [setView]);
    const setViewUseStock = useCallback(() => setView('use_stock'), [setView]);
    const setViewFilmHistory = useCallback(() => setView('film_history'), [setView]);

    return (
        <nav className="flex flex-wrap space-x-2 md:space-x-4 border-b border-gray-700 pb-2">
            <NavButton text="Dashboard" isActive={view === 'dashboard'} onClick={setViewDashboard} />
            <NavButton text="Stock Inventory" isActive={view === 'stock'} onClick={setViewStock} />
            <NavButton text="Job Management" isActive={view === 'jobs'} onClick={setViewJobs} />
            <NavButton text="Orders" isActive={view === 'orders'} onClick={setViewOrders} />
            <NavButton text="Use Stock" isActive={view === 'use_stock'} onClick={setViewUseStock} />
            <NavButton text="Film History" isActive={view === 'film_history'} onClick={setViewFilmHistory} />
        </nav>
    );
});

// All other components (Dashboard, FilmInventory, etc.) are included below.

// ... Rest of the file from the previous response ...
