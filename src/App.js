import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, getDocs, collectionGroup, orderBy, where, setLogLevel, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// --- PDF Export Helper ---
const exportToPDF = (title, head, body, fileName) => {
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
    const [view, setView] = useState('stock');
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
        const qOrders = query(collection(db, ordersPath)); // No initial sort, will be sorted by planningIndex later
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
// The rest of the file has been restored and includes performance optimizations.
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
            if (error.code === 'auth/api-key-not-valid') {
                setError('Login failed: Invalid API Key. Please ensure your Firebase config is correct and check for API key restrictions in your Google Cloud Console.');
            } else if (error.code === 'auth/operation-not-allowed') {
                setError(`Login failed: Email/Password sign-in is not enabled for project ${firebaseConfig.projectId}. Please double-check the setting in your Firebase console.`);
            } else {
                setError('Failed to log in. Please check your email and password.');
            }
            console.error("Login Error:", error);
        }
    }, [auth]);

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
    const [completionDate, setCompletionDate] = useState(toYYYYMMDD(new Date()));
    if (!isOpen) return null;
    const handleConfirm = () => onConfirm(order.id, new Date(completionDate + 'T00:00:00Z'));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">Complete Order</h3>
                <p className="text-gray-300 mb-4">Select a completion date for order <strong className="text-white">{order?.orderName}</strong>.</p>
                <input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none mb-6" />
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
    const setViewStock = useCallback(() => setView('stock'), [setView]);
    const setViewJobs = useCallback(() => setView('jobs'), [setView]);
    const setViewOrders = useCallback(() => setView('orders'), [setView]);
    const setViewUseStock = useCallback(() => setView('use_stock'), [setView]);
    const setViewFilmHistory = useCallback(() => setView('film_history'), [setView]);

    return (
        <nav className="flex flex-wrap space-x-2 md:space-x-4 border-b border-gray-700 pb-2">
            <NavButton text="Stock Inventory" isActive={view === 'stock'} onClick={setViewStock} />
            <NavButton text="Job Management" isActive={view === 'jobs'} onClick={setViewJobs} />
            <NavButton text="Orders" isActive={view === 'orders'} onClick={setViewOrders} />
            <NavButton text="Use Stock" isActive={view === 'use_stock'} onClick={setViewUseStock} />
            <NavButton text="Film History" isActive={view === 'film_history'} onClick={setViewFilmHistory} />
        </nav>
    );
});

const FilmInventory = React.memo(function FilmInventory({ films, db, userId, isPdfReady }) {
    const [showForm, setShowForm] = useState(false);
    const [editingFilm, setEditingFilm] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [filmToDelete, setFilmToDelete] = useState(null);

    const handleFormSubmit = useCallback(async (filmData) => {
        if (!db || !userId) return;
        const filmsCollectionPath = `artifacts/${appId}/users/${userId}/films`;
        const dataToSave = { ...filmData, purchaseDate: new Date(filmData.purchaseDate + 'T00:00:00Z') };
        try {
            if (editingFilm) {
                await updateDoc(doc(db, filmsCollectionPath, editingFilm.id), dataToSave);
            } else {
                await addDoc(collection(db, filmsCollectionPath), { ...dataToSave, currentWeight: dataToSave.netWeight, createdAt: serverTimestamp() });
            }
            setShowForm(false);
            setEditingFilm(null);
        } catch (error) { console.error("Error saving film:", error); }
    }, [db, userId, editingFilm]);

    const openDeleteModal = useCallback((film) => { setFilmToDelete(film); setIsDeleteModalOpen(true); }, []);
    const closeDeleteModal = useCallback(() => { setFilmToDelete(null); setIsDeleteModalOpen(false); }, []);
    const handleEdit = useCallback((film) => { setEditingFilm(film); setShowForm(true); }, []);
    const closeForm = useCallback(() => { setShowForm(false); setEditingFilm(null); }, []);

    const executeDelete = useCallback(async () => {
        if (!db || !userId || !filmToDelete) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/films`, filmToDelete.id));
        } catch (error) { console.error("Error deleting film:", error); }
        finally { closeDeleteModal(); }
    }, [db, userId, filmToDelete, closeDeleteModal]);

    const filmCategories = useMemo(() => films.reduce((acc, film) => {
        const key = film.filmType || 'Uncategorized';
        if (!acc[key]) acc[key] = [];
        acc[key].push(film);
        return acc;
    }, {}), [films]);
    
    const handleExportPDF = useCallback(() => {
        let head, body, fileName;
        const title = "Film Inventory Report";
        if (selectedCategory) {
            head = [['Film Type', 'Current Wt. (kg)', 'Supplier', 'Purchase Date']];
            body = (filmCategories[selectedCategory] || []).map(film => [film.filmType, film.currentWeight?.toFixed(2), film.supplier, toDDMMYYYY(film.purchaseDate)]);
            fileName = `film-inventory-${selectedCategory}-${toYYYYMMDD(new Date())}.pdf`;
        } else {
            head = [['Category', 'Rolls Count', 'Total Weight (kg)']];
            body = Object.keys(filmCategories).sort().map(name => {
                const rolls = filmCategories[name];
                const totalWeight = rolls.reduce((sum, roll) => sum + (roll.currentWeight || 0), 0);
                return [name, rolls.length, totalWeight.toFixed(2)];
            });
            fileName = `film-inventory-summary-${toYYYYMMDD(new Date())}.pdf`;
        }
        exportToPDF(title, head, body, fileName);
    }, [selectedCategory, filmCategories]);
    
    const openAddForm = useCallback(() => {
        setEditingFilm(null);
        setShowForm(true);
    }, []);

    return (
        <section>
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} onConfirm={executeDelete} title="Delete Film Roll?">
              <p>Are you sure you want to delete this <strong className="text-white">{filmToDelete?.filmType}</strong> roll? This action cannot be undone.</p>
            </ConfirmationModal>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-200">{selectedCategory ? `Category: ${selectedCategory}` : 'Film Stock by Category'}</h2>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleExportPDF} 
                        disabled={!isPdfReady}
                        className={`flex items-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:scale-105 ${!isPdfReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={!isPdfReady ? "PDF exporter is loading..." : "Export current view to PDF"}
                    >
                        <DownloadIcon /><span className="ml-2 hidden md:inline">Export PDF</span>
                    </button>
                    <button onClick={openAddForm} className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-transform duration-200 hover:scale-105">
                        <PlusIcon /><span className="ml-2 hidden md:inline">Add New Roll</span>
                    </button>
                </div>
            </div>
            
            {showForm && <FilmForm onSubmit={handleFormSubmit} onCancel={closeForm} initialData={editingFilm} />}
            
            {selectedCategory ? (
                <div>
                    <button onClick={() => setSelectedCategory(null)} className="flex items-center mb-4 text-cyan-400 hover:text-cyan-300"><ChevronLeftIcon /> Back to Categories</button>
                    <FilmList films={filmCategories[selectedCategory] || []} onEdit={handleEdit} onDelete={openDeleteModal} />
                </div>
            ) : (<CategoryList categories={filmCategories} onSelectCategory={setSelectedCategory} />)}
        </section>
    );
});

const FilmForm = React.memo(function FilmForm({ onSubmit, onCancel, initialData }) {
    const [formData, setFormData] = useState({ filmType: '', netWeight: '', supplier: '', purchaseDate: toYYYYMMDD(new Date()) });

    useEffect(() => {
        if (initialData) {
            setFormData({
                filmType: initialData.filmType || '',
                netWeight: initialData.netWeight || '',
                supplier: initialData.supplier || '',
                purchaseDate: toYYYYMMDD(initialData.purchaseDate),
            });
        } else {
            setFormData({ filmType: '', netWeight: '', supplier: '', purchaseDate: toYYYYMMDD(new Date()) });
        }
    }, [initialData]);

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ ...formData, netWeight: parseFloat(formData.netWeight) || 0, filmType: formData.filmType.trim() });
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg mb-8 shadow-lg">
            <h3 className="text-xl font-semibold mb-4 text-cyan-400">{initialData ? 'Edit Film Roll' : 'Add New Film Roll'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="filmType" value={formData.filmType} onChange={handleChange} placeholder="Film Type (e.g., 12*610 PET)" required className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                <input name="netWeight" type="number" step="0.01" value={formData.netWeight} onChange={handleChange} placeholder="Net Weight (kg)" required className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                <input name="supplier" value={formData.supplier} onChange={handleChange} placeholder="Supplier" required className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                <input name="purchaseDate" type="date" value={formData.purchaseDate} onChange={handleChange} required className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                <div className="flex items-center space-x-4 md:col-span-2">
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg w-full transition-colors">{initialData ? 'Update Roll' : 'Add Roll'}</button>
                    <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg w-full transition-colors">Cancel</button>
                </div>
            </form>
        </div>
    );
});

const CategoryList = React.memo(function CategoryList({ categories, onSelectCategory }) {
    const sortedCategories = Object.keys(categories).sort();
    if (sortedCategories.length === 0) return <p className="text-center text-gray-500 py-8">No film rolls in stock. Add one to get started!</p>;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedCategories.map(categoryName => {
                const rolls = categories[categoryName];
                const totalWeight = rolls.reduce((sum, roll) => sum + (roll.currentWeight || 0), 0);
                return (
                    <div key={categoryName} onClick={() => onSelectCategory(categoryName)} className="bg-gray-800 p-4 rounded-lg cursor-pointer hover:bg-gray-700 hover:shadow-cyan-500/10 shadow-lg transition-all">
                        <h3 className="text-xl font-bold text-cyan-400">{categoryName}</h3>
                        <p className="text-gray-300">{rolls.length} Roll(s)</p>
                        <p className="text-gray-400 text-sm mt-2">Total Weight: {totalWeight.toFixed(2)} kg</p>
                    </div>
                );
            })}
        </div>
    );
});

const FilmList = React.memo(function FilmList({ films, onEdit, onDelete }) {
    return (
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-md">
            <table className="w-full text-left">
                <thead className="bg-gray-700"><tr><th className="p-3">Film Type</th><th className="p-3">Current Wt. (kg)</th><th className="p-3">Supplier</th><th className="p-3">Purchase Date</th><th className="p-3">Actions</th></tr></thead>
                <tbody>
                    {films.map(film => (
                        <tr key={film.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                            <td className="p-3 font-medium">{film.filmType}</td><td className="p-3">{film.currentWeight?.toFixed(2)}</td>
                            <td className="p-3">{film.supplier}</td><td className="p-3">{toDDMMYYYY(film.purchaseDate)}</td>
                            <td className="p-3 flex space-x-2">
                                <button onClick={() => onEdit(film)} className="text-blue-400 hover:text-blue-300"><EditIcon /></button>
                                <button onClick={() => onDelete(film)} className="text-red-500 hover:text-red-400"><TrashIcon /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});

const JobManagement = React.memo(function JobManagement({ films, jobs, orders, db, userId, setView, isPdfReady }) {
    const [showForm, setShowForm] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [jobSearch, setJobSearch] = useState('');
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [messageModalContent, setMessageModalContent] = useState({title: '', body: ''});

    const handleJobSubmit = useCallback(async (jobData) => {
        if (!db || !userId) return;
        const jobsCollectionPath = `artifacts/${appId}/users/${userId}/jobs`;
        try {
             if (editingJob) {
                await updateDoc(doc(db, jobsCollectionPath, editingJob.id), jobData);
            } else {
                await addDoc(collection(db, jobsCollectionPath), { ...jobData, createdAt: serverTimestamp() });
            }
            setShowForm(false);
            setEditingJob(null);
        } catch (error) { console.error("Error saving job:", error); }
    }, [db, userId, editingJob]);

    const handleEditJob = useCallback((job) => { setEditingJob(job); setShowForm(true); }, []);
    const closeJobForm = useCallback(() => { setShowForm(false); setEditingJob(null); }, []);
    const closeDeleteModal = useCallback(() => { setJobToDelete(null); setDeleteModalOpen(false); }, []);

    const openDeleteModal = useCallback((job) => {
        const isJobInActiveOrder = orders.some(order => order.jobId === job.id && order.status === 'active');
        if (isJobInActiveOrder) {
            setMessageModalContent({ title: 'Deletion Prevented', body: 'This job is linked to an active order. Please complete or delete the order first.' });
            setIsMessageModalOpen(true);
        } else {
            setJobToDelete(job);
            setDeleteModalOpen(true);
        }
    }, [orders]);

    const executeDeleteJob = useCallback(async () => {
        if (!jobToDelete || !db || !userId) return;
        const jobRef = doc(db, `artifacts/${appId}/users/${userId}/jobs`, jobToDelete.id);
        try {
            await deleteDoc(jobRef);
        } catch (error) { console.error("Error deleting job:", error); }
        finally { closeDeleteModal(); }
    }, [db, userId, jobToDelete, closeDeleteModal]);
    
    const filteredJobs = useMemo(() => jobSearch ? jobs.filter(job => job.jobName.toLowerCase().includes(jobSearch.toLowerCase())) : jobs, [jobs, jobSearch]);
    
    const handleExportJobsPDF = useCallback(() => {
        const title = "Production Jobs Report";
        const head = [['Job Name', 'Size', 'Colours', 'Print Type', 'Materials']];
        const body = filteredJobs.map(job => [
            job.jobName, job.jobSize, job.numberOfColors, 
            job.printType ? (job.printType.charAt(0).toUpperCase() + job.printType.slice(1)) : '', 
            job.materials ? job.materials.join(', ') : ''
        ]);
        const fileName = `job-management-report-${toYYYYMMDD(new Date())}.pdf`;
        exportToPDF(title, head, body, fileName);
    }, [filteredJobs]);

    const openAddForm = useCallback(() => {
        setEditingJob(null);
        setShowForm(true);
    }, []);

    return (
        <section>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-200">Production Jobs (Memo)</h2>
                 <div className="relative w-full md:w-1/3">
                    <input type="text" value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder="Search jobs..." className="w-full bg-gray-700 p-2 pl-10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={handleExportJobsPDF} 
                        disabled={!isPdfReady}
                        className={`flex items-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:scale-105 ${!isPdfReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={!isPdfReady ? "PDF exporter is loading..." : "Export jobs to PDF"}
                    >
                        <DownloadIcon /><span className="ml-2 hidden md:inline">Export PDF</span>
                    </button>
                    <button onClick={openAddForm} className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-transform duration-200 hover:scale-105 w-full md:w-auto">
                        <PlusIcon /><span className="ml-2 hidden md:inline">Add New Job</span>
                    </button>
                </div>
            </div>
            {showForm && <JobForm films={films} onSubmit={handleJobSubmit} onCancel={closeJobForm} initialData={editingJob} />}
            <JobList films={films} jobs={filteredJobs} onDelete={openDeleteModal} onEdit={handleEditJob} db={db} userId={userId} setView={setView} />
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} onConfirm={executeDeleteJob} title="Delete Job?">
                <p>Are you sure you want to delete the job <strong className="text-white">{jobToDelete?.jobName}</strong>? Its consumption history will be orphaned but will remain. This action cannot be undone.</p>
            </ConfirmationModal>
            <MessageModal isOpen={isMessageModalOpen} onClose={() => setIsMessageModalOpen(false)} title={messageModalContent.title}>{messageModalContent.body}</MessageModal>
        </section>
    );
});

const JobForm = React.memo(function JobForm({ onSubmit, onCancel, films, initialData }) {
    const [jobName, setJobName] = useState('');
    const [jobSize, setJobSize] = useState('');
    const [materials, setMaterials] = useState(['']);
    const [activeMaterialIndex, setActiveMaterialIndex] = useState(null);
    const materialsRef = useRef(null);
    const [numberOfColors, setNumberOfColors] = useState('');
    const [printType, setPrintType] = useState('reverse');

    useEffect(() => {
        if (initialData) {
            setJobName(initialData.jobName || '');
            setJobSize(initialData.jobSize || '');
            setMaterials(initialData.materials && initialData.materials.length > 0 ? initialData.materials : ['']);
            setNumberOfColors(initialData.numberOfColors || '');
            setPrintType(initialData.printType || 'reverse');
        } else {
            setJobName(''); setJobSize(''); setMaterials(['']); setNumberOfColors(''); setPrintType('reverse');
        }
    }, [initialData]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (materialsRef.current && !materialsRef.current.contains(event.target)) { setActiveMaterialIndex(null); }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [materialsRef]);

    const availableFilmTypes = useMemo(() => {
        if (!films) return [];
        return [...new Set(films.map(f => f.filmType.trim()).filter(Boolean))].sort();
    }, [films]);
        
    const addMaterial = useCallback(() => setMaterials(m => [...m, '']), []);
    const handleMaterialChange = useCallback((index, value) => { 
        setMaterials(prev => {
            const newMaterials = [...prev]; 
            newMaterials[index] = value; 
            return newMaterials;
        }); 
    }, []);
    const removeMaterial = useCallback((index) => setMaterials(m => m.filter((_, i) => i !== index)), []);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ jobName, jobSize, materials: materials.map(m => m.trim()).filter(Boolean), numberOfColors: parseInt(numberOfColors, 10) || 0, printType });
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg mb-8 shadow-lg">
            <h3 className="text-xl font-semibold mb-4 text-cyan-400">{initialData ? 'Edit Job' : 'Add New Job'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input value={jobName} onChange={e => setJobName(e.target.value)} placeholder="Job Name" required className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                <input value={jobSize} onChange={e => setJobSize(e.target.value)} placeholder="Job Size (e.g., 100,000 meters)" required className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="number" value={numberOfColors} onChange={e => setNumberOfColors(e.target.value)} placeholder="Number of Colours" className="w-full bg-gray-700 p-2 rounded-md" />
                    <select value={printType} onChange={e => setPrintType(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md"><option value="reverse">Reverse Printing</option><option value="surface">Surface Printing</option></select>
                </div>
                <div ref={materialsRef}>
                    <h4 className="font-semibold text-gray-300">Required Materials</h4>
                    {materials.map((material, index) => (
                        <div key={index} className="flex items-center space-x-2 mt-2">
                            <div className="relative w-full">
                                <input value={material} onChange={e => handleMaterialChange(index, e.target.value)} onFocus={() => setActiveMaterialIndex(index)} placeholder="Type to search film..." autoComplete="off" className="w-full bg-gray-700 p-2 rounded-md" />
                                {activeMaterialIndex === index && material && (
                                    <div className="absolute z-20 w-full mt-1 bg-gray-600 border border-gray-500 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                        {availableFilmTypes.filter(type => type.toLowerCase().includes(material.toLowerCase())).length > 0 
                                            ? availableFilmTypes.filter(type => type.toLowerCase().includes(material.toLowerCase())).map(type => (<div key={type} onClick={() => { handleMaterialChange(index, type); setActiveMaterialIndex(null); }} className="p-2 cursor-pointer hover:bg-cyan-600">{type}</div>)) 
                                            : <div className="p-2 text-gray-400">No matching film types found.</div>}
                                    </div>
                                )}
                            </div>
                            <button type="button" onClick={() => removeMaterial(index)} className="text-red-500 hover:text-red-400 p-2 rounded-full bg-gray-700"><TrashIcon /></button>
                        </div>
                    ))}
                    <button type="button" onClick={addMaterial} className="mt-2 text-cyan-400 hover:text-cyan-300 text-sm">+ Add Material</button>
                </div>
                <div className="flex items-center space-x-4 pt-2">
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg w-full">{initialData ? 'Update Job' : 'Create Job'}</button>
                    <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg w-full">Cancel</button>
                </div>
            </form>
        </div>
    );
});

const JobList = React.memo(function JobList({ films, jobs, onDelete, onEdit, db, userId, setView }) {
    if (jobs.length === 0) return <p className="text-center text-gray-500 py-8">No jobs found.</p>;
    return <div className="space-y-4">{jobs.map(job => <JobCard key={job.id} job={job} jobs={jobs} films={films} onDelete={onDelete} onEdit={onEdit} db={db} userId={userId} setView={setView} />)}</div>;
});

const JobCard = React.memo(function JobCard({ job, jobs, films, onDelete, onEdit, db, userId, setView }) {
    const [showHistory, setShowHistory] = useState(false);
    const [showStock, setShowStock] = useState(false);
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [editingHistoryEntry, setEditingHistoryEntry] = useState(null);

    useEffect(() => {
        if (!showHistory || !db || !userId) return;
        setIsLoadingHistory(true);
        const historyCollectionPath = `artifacts/${appId}/users/${userId}/jobs/${job.id}/consumedRolls`;
        const q = query(collection(db, historyCollectionPath), orderBy("consumedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsLoadingHistory(false);
        });
        return () => unsubscribe();
    }, [showHistory, db, userId, job.id]);

    const handleRevertToStock = useCallback(async (historyEntry) => {
        if (!db || !userId || !historyEntry) return;
        const batch = writeBatch(db);
        const filmRef = doc(db, `artifacts/${appId}/users/${userId}/films`, historyEntry.originalId);
        const revertedFilmData = { filmType: historyEntry.filmType, netWeight: historyEntry.netWeight, currentWeight: historyEntry.netWeight, supplier: historyEntry.supplier, purchaseDate: historyEntry.purchaseDate, createdAt: historyEntry.createdAt };
        batch.set(filmRef, revertedFilmData);
        batch.delete(doc(db, `artifacts/${appId}/users/${userId}/jobs/${historyEntry.jobId}/consumedRolls`, historyEntry.id));
        try {
            await batch.commit();
            setEditingHistoryEntry(null);
            setView('stock');
        } catch (error) {
            console.error("Error reverting roll to stock from JobCard:", error);
            alert("Failed to revert roll. See console for details.");
        }
    }, [db, userId, setView]);

    const handleUpdateHistory = useCallback(async (historyEntry, newDate, newJob) => {
        if (!db || !userId || !historyEntry || !newJob) return;
        if (newJob.id === historyEntry.jobId) {
            const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${historyEntry.jobId}/consumedRolls`, historyEntry.id);
            try { await updateDoc(historyRef, { consumedAt: new Date(newDate + 'T00:00:00Z') }); setEditingHistoryEntry(null); }
            catch (error) { console.error("Error updating history date from JobCard:", error); }
        } else {
            const batch = writeBatch(db);
            const oldHistoryRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${historyEntry.jobId}/consumedRolls`, historyEntry.id);
            const newHistoryRef = doc(collection(db, `artifacts/${appId}/users/${userId}/jobs/${newJob.id}/consumedRolls`));
            const { id, ...rest } = historyEntry;
            const newData = { ...rest, jobId: newJob.id, jobName: newJob.jobName, consumedAt: new Date(newDate + 'T00:00:00Z') };
            batch.set(newHistoryRef, newData);
            batch.delete(oldHistoryRef);
            try { await batch.commit(); setEditingHistoryEntry(null); }
            catch (error) { console.error("Error moving history entry from JobCard:", error); }
        }
    }, [db, userId]);

    return (
        <>
            <div className="bg-gray-800 rounded-lg p-4 shadow-md border-l-4 border-gray-600">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-xl text-gray-100">{job.jobName}</h3>
                        <p className="text-gray-400">{job.jobSize}</p>
                        <div className="text-sm text-gray-400 flex gap-4 mt-1">
                            {job.numberOfColors > 0 && <p>Colours: <span className="font-semibold text-gray-200">{job.numberOfColors}</span></p>}
                            {job.printType && <p>Print: <span className="font-semibold text-gray-200">{job.printType.charAt(0).toUpperCase() + job.printType.slice(1)}</span></p>}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Created: {toDDMMYYYY(job.createdAt?.toDate())}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                         <button onClick={() => onEdit(job)} className="text-blue-400 hover:text-blue-300"><EditIcon /></button>
                         <button onClick={() => setShowStock(prev => !prev)} className="flex items-center text-sm text-yellow-400 hover:text-yellow-300 transition-colors"><ClipboardListIcon /><span className="ml-1">{showStock ? 'Hide' : 'View'} Stock</span></button>
                         <button onClick={() => setShowHistory(prev => !prev)} className="flex items-center text-sm text-cyan-400 hover:text-cyan-300 transition-colors"><HistoryIcon /><span className="ml-1">{showHistory ? 'Hide' : 'View'} History</span></button>
                         <button onClick={() => onDelete(job)} className="text-gray-500 hover:text-red-500"><TrashIcon/></button>
                    </div>
                </div>
                {showStock && (
                    <div className="mt-4 border-t border-gray-700 pt-4">
                        <h4 className="font-semibold text-lg text-yellow-400 mb-3">Required Stock Status</h4>
                        {(job.materials && job.materials.length > 0) ? job.materials.map(material => {
                            const matchingFilms = films.filter(film => film.filmType.toLowerCase() === material.toLowerCase() && film.currentWeight > 0);
                            const totalWeight = matchingFilms.reduce((sum, film) => sum + (film.currentWeight || 0), 0);
                            return (
                                <div key={material} className="mt-2 p-3 bg-gray-700/50 rounded-lg">
                                    <div className="flex justify-between items-center">
                                        <h5 className="font-bold text-gray-200">{material}</h5>
                                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${matchingFilms.length > 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{matchingFilms.length > 0 ? 'In Stock' : 'Out of Stock'}</span>
                                    </div>
                                    {matchingFilms.length > 0 && <div className="text-sm text-gray-400 mt-2"><p>{matchingFilms.length} roll(s) available. Total Weight: {totalWeight.toFixed(2)} kg</p></div>}
                                </div>
                            )
                        }) : <p className="text-gray-500">No materials specified for this job.</p>}
                    </div>
                )}
                {showHistory && (
                    <div className="mt-4 border-t border-gray-700 pt-4">
                        <h4 className="font-semibold text-lg text-cyan-400 mb-2">Consumed Roll History</h4>
                        {isLoadingHistory ? <p>Loading history...</p> : (history.length > 0 ? <ul className="space-y-2">{history.map(roll => (<li key={roll.id} className="p-2 bg-gray-700 rounded-md flex justify-between items-center"><div><p className="font-semibold">{roll.filmType}</p><p className="text-sm text-gray-400">Consumed on: {toDDMMYYYY(roll.consumedAt)}</p></div><button onClick={() => setEditingHistoryEntry(roll)} className="text-blue-400 hover:text-blue-300"><EditIcon /></button></li>))}</ul> : <p>No rolls have been consumed for this job.</p>)}
                    </div>
                )}
            </div>
            <AdvancedEditHistoryModal isOpen={!!editingHistoryEntry} onClose={() => setEditingHistoryEntry(null)} historyEntry={editingHistoryEntry} jobs={jobs} onUpdate={handleUpdateHistory} onRevert={handleRevertToStock} />
        </>
    );
});


const OrderManagement = React.memo(function OrderManagement({ films, jobs, orders, db, userId, isPdfReady }) {
    const [showForm, setShowForm] = useState(false);
    const [viewType, setViewType] = useState('active');
    const [completedSearch, setCompletedSearch] = useState('');
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [orderToComplete, setOrderToComplete] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);

    useEffect(() => {
        if (!db || !userId) return;
        const activeOrdersWithoutIndex = orders.filter(o => o.status === 'active' && o.planningIndex === undefined);
        if (activeOrdersWithoutIndex.length > 0) {
            const batch = writeBatch(db);
            const highestIndex = Math.max(-1, ...orders.filter(o => o.planningIndex !== undefined).map(o => o.planningIndex));
            activeOrdersWithoutIndex
                .sort((a,b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0))
                .forEach((order, i) => {
                    const orderRef = doc(db, `artifacts/${appId}/users/${userId}/orders`, order.id);
                    batch.update(orderRef, { planningIndex: highestIndex + 1 + i });
                });
            batch.commit().catch(err => console.error("Error setting initial planning index:", err));
        }
    }, [orders, db, userId]);

    const handleOrderSubmit = useCallback(async (orderData) => {
        if (!db || !userId) return;
        try {
            const highestIndex = Math.max(-1, ...orders.filter(o => o.planningIndex !== undefined).map(o => o.planningIndex));
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/orders`), { 
                ...orderData, 
                status: 'active', 
                createdAt: serverTimestamp(), 
                ownerId: userId,
                planningIndex: highestIndex + 1
            });
            setShowForm(false);
        } catch (error) { console.error("Error creating order:", error); }
    }, [db, userId, orders]);

    const handleOpenCompleteModal = useCallback((order) => { setOrderToComplete(order); setIsCompleteModalOpen(true); }, []);
    const handleCloseCompleteModal = useCallback(() => { setOrderToComplete(null); setIsCompleteModalOpen(false); }, []);

    const markOrderComplete = useCallback(async (orderId, completionDate) => {
        if (!db || !userId || !orderId) return;
        const orderRef = doc(db, `artifacts/${appId}/users/${userId}/orders`, orderId);
        try {
            await updateDoc(orderRef, { status: 'completed', completedAt: completionDate, planningIndex: -1 });
        } catch(error) {
            console.error("Error completing order: ", error);
        } finally {
            handleCloseCompleteModal();
        }
    }, [db, userId, handleCloseCompleteModal]);

    const openDeleteModal = useCallback((order) => { setOrderToDelete(order); setIsDeleteModalOpen(true); }, []);
    const closeDeleteModal = useCallback(() => { setOrderToDelete(null); setIsDeleteModalOpen(false); }, []);
    
    const executeDeleteOrder = useCallback(async () => {
        if (!orderToDelete) return;
        try { await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/orders`, orderToDelete.id)); }
        catch (error) { console.error("Error deleting order: ", error); }
        finally { closeDeleteModal(); }
    }, [db, userId, orderToDelete, closeDeleteModal]);
    
    const activeOrders = useMemo(() => orders.filter(o => o.status === 'active' && o.planningIndex !== undefined).sort((a, b) => (a.planningIndex || 0) - (b.planningIndex || 0)), [orders]);
    const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed' && o.orderName.toLowerCase().includes(completedSearch.toLowerCase())), [orders, completedSearch]);

    const handleReorder = useCallback(async (orderToMove, direction) => {
        const orderIndex = activeOrders.findIndex(o => o.id === orderToMove.id);
        const swapIndex = direction === 'up' ? orderIndex - 1 : orderIndex + 1;

        if (swapIndex < 0 || swapIndex >= activeOrders.length) return;

        const orderToSwap = activeOrders[swapIndex];
        
        const batch = writeBatch(db);
        const orderToMoveRef = doc(db, `artifacts/${appId}/users/${userId}/orders`, orderToMove.id);
        const orderToSwapRef = doc(db, `artifacts/${appId}/users/${userId}/orders`, orderToSwap.id);

        batch.update(orderToMoveRef, { planningIndex: orderToSwap.planningIndex });
        batch.update(orderToSwapRef, { planningIndex: orderToMove.planningIndex });

        await batch.commit();

    }, [activeOrders, db, userId]);

    const handleExportOrdersPDF = useCallback(() => {
        const currentOrders = viewType === 'active' ? activeOrders : completedOrders;
        const title = `${viewType.charAt(0).toUpperCase() + viewType.slice(1)} Orders Report`;
        const fileName = `orders-${viewType}-report-${toYYYYMMDD(new Date())}.pdf`;

        const doc = new window.jspdf.jsPDF();
        let yPos = 22;

        doc.setFontSize(18);
        doc.text(title, 14, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.text(`Report generated on: ${new Date().toLocaleDateString()}`, 14, yPos);
        yPos += 12;

        currentOrders.forEach((order, index) => {
            if (yPos > 220 && index > 0) {
                doc.addPage();
                yPos = 22;
            }

            const job = jobs.find(j => j.id === order.jobId);
            const stockStatus = calculateStockStatus(job, films);

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('ORDER DETAILS', 14, yPos);
            yPos += 7;

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            
            const orderDetails = [
                `PARTY NAME - ${order.orderName || 'N/A'}`,
                `JOB NAME - ${job?.jobName || 'N/A'}`,
                `JOB SIZE - ${job?.jobSize || 'N/A'}`,
                `COLOURS - ${job?.numberOfColors || 'N/A'}`,
                `PRINTING TYPE - ${job?.printType ? job.printType.toUpperCase() : 'N/A'}`,
                `TOTAL ORDER QUANTITY - ${order.weightMade || '0'} KGS`
            ];
            
            doc.text(orderDetails, 14, yPos);
            yPos += (orderDetails.length * 5) + 5;

            if (job?.materials?.length > 0) {
                const head = [['MATERIAL TO BE USED', 'WEIGHT TO BE MADE (IN KG)', 'METERS TO BE MADE', 'STOCK (IN KGS)', 'STOCK (IN ROLLS)']];
                const body = job.materials.map(material => {
                    const materialStock = stockStatus.details.find(d => d.name === material);
                    return [
                        material,
                        order.weightMade || 0,
                        order.metersMade || 0,
                        materialStock ? materialStock.totalWeight.toFixed(2) : '0.00',
                        materialStock ? materialStock.rollCount : 0
                    ];
                });

                doc.autoTable({
                    startY: yPos,
                    head: head,
                    body: body,
                    theme: 'grid',
                    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] }
                });

                yPos = doc.autoTable.previous.finalY + 15;
            } else {
                 doc.text('No materials specified for this job.', 14, yPos);
                 yPos += 15;
            }

            if (index < currentOrders.length - 1) {
                doc.setDrawColor(180, 180, 180);
                doc.line(14, yPos - 7, 196, yPos - 7);
            }
        });

        doc.save(fileName);
    }, [viewType, activeOrders, completedOrders, jobs, films]);

    const openAddForm = useCallback(() => setShowForm(true), []);
    const closeAddForm = useCallback(() => setShowForm(false), []);

    return (
        <section>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-200">Production Planning & Orders</h2>
                <div className="flex-grow flex justify-center">
                    <div className="bg-gray-700 p-1 rounded-lg flex space-x-1">
                        <button onClick={() => setViewType('active')} className={`px-4 py-1 rounded-md text-sm font-semibold ${viewType === 'active' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Active</button>
                        <button onClick={() => setViewType('completed')} className={`px-4 py-1 rounded-md text-sm font-semibold ${viewType === 'completed' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Completed</button>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={handleExportOrdersPDF} 
                        disabled={!isPdfReady}
                        className={`flex items-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:scale-105 ${!isPdfReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={!isPdfReady ? "PDF exporter is loading..." : "Export orders to PDF"}
                    >
                        <DownloadIcon /><span className="ml-2 hidden md:inline">Export PDF</span>
                    </button>
                    <button onClick={openAddForm} className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-transform duration-200 hover:scale-105 w-full md:w-auto">
                        <PlusIcon /><span className="ml-2 hidden md:inline">Add New Order</span>
                    </button>
                </div>
            </div>
            {showForm && <OrderForm jobs={jobs} onSubmit={handleOrderSubmit} onCancel={closeAddForm} />}
            
            <MarkCompleteModal isOpen={isCompleteModalOpen} onClose={handleCloseCompleteModal} onConfirm={markOrderComplete} order={orderToComplete} />
            <ConfirmationModal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} onConfirm={executeDeleteOrder} title="Delete Order?">
                <p>Are you sure you want to delete the order <strong className="text-white">{orderToDelete?.orderName}</strong>? This action cannot be undone.</p>
            </ConfirmationModal>

            {viewType === 'active' ? (
                <OrderList orders={activeOrders} jobs={jobs} films={films} onDelete={openDeleteModal} onComplete={handleOpenCompleteModal} onReorder={handleReorder} db={db} userId={userId} />
            ) : (
                <div>
                     <div className="relative mb-4">
                        <input type="text" value={completedSearch} onChange={e => setCompletedSearch(e.target.value)} placeholder="Search completed orders..." className="w-full bg-gray-700 p-2 pl-10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    </div>
                    <OrderList orders={completedOrders} jobs={jobs} films={films} onDelete={openDeleteModal} db={db} userId={userId} />
                </div>
            )}
        </section>
    );
});

const OrderForm = React.memo(function OrderForm({ jobs, onSubmit, onCancel }) {
    const [orderName, setOrderName] = useState('');
    const [weightMade, setWeightMade] = useState('');
    const [metersMade, setMetersMade] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);
    const [jobSearch, setJobSearch] = useState('');
    const [showJobResults, setShowJobResults] = useState(false);
    const jobSearchRef = useRef(null);
    const [messageModal, setMessageModal] = useState({isOpen: false, title: '', body: ''});

    useEffect(() => {
        function handleClickOutside(event) { if (jobSearchRef.current && !jobSearchRef.current.contains(event.target)) { setShowJobResults(false); } }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [jobSearchRef]);

    const filteredJobs = useMemo(() => jobSearch ? jobs.filter(job => job.jobName.toLowerCase().includes(jobSearch.toLowerCase())) : [], [jobs, jobSearch]);
    const handleJobSelect = (job) => { setSelectedJob(job); setJobSearch(job.jobName); setShowJobResults(false); };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedJob) { setMessageModal({isOpen: true, title: "Input Error", body: "Please select a job for this order."}); return; }
        onSubmit({ orderName, weightMade: parseFloat(weightMade) || 0, metersMade: parseFloat(metersMade) || 0, jobId: selectedJob.id, jobName: selectedJob.jobName });
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg mb-8 shadow-lg">
            <MessageModal isOpen={messageModal.isOpen} onClose={() => setMessageModal({isOpen: false, title: '', body: ''})} title={messageModal.title}>{messageModal.body}</MessageModal>
            <h3 className="text-xl font-semibold mb-4 text-cyan-400">Add New Order</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input value={orderName} onChange={e => setOrderName(e.target.value)} placeholder="Order Name / Customer" required className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="number" step="0.01" value={weightMade} onChange={e => setWeightMade(e.target.value)} placeholder="Weight to be Made (kg)" className="w-full bg-gray-700 p-2 rounded-md" />
                    <input type="number" step="0.01" value={metersMade} onChange={e => setMetersMade(e.target.value)} placeholder="Meters to be Made" className="w-full bg-gray-700 p-2 rounded-md" />
                </div>
                <div ref={jobSearchRef} className="relative">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Select Associated Job</label>
                    <input type="text" value={jobSearch} onChange={e => { setJobSearch(e.target.value); setShowJobResults(true); }} onFocus={() => setShowJobResults(true)} placeholder="Type to search for a job..." className="w-full bg-gray-700 p-2 pl-10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                    <div className="absolute inset-y-0 left-0 pl-3 top-6 flex items-center pointer-events-none"><SearchIcon /></div>
                    {showJobResults && jobSearch && (
                        <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-gray-700 rounded-md border border-gray-600">
                            {filteredJobs.length > 0 ? filteredJobs.map(job => (<div key={job.id} onClick={() => handleJobSelect(job)} className="p-2 cursor-pointer hover:bg-cyan-600">{job.jobName}</div>)) : <div className="p-2 text-gray-400">No jobs found.</div>}
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-4 pt-2">
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg w-full">Create Order</button>
                    <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg w-full">Cancel</button>
                </div>
            </form>
        </div>
    );
});

const OrderList = React.memo(function OrderList({ orders, jobs, films, onDelete, onComplete, onReorder, db, userId }) {
    if (orders.length === 0) return <p className="text-center text-gray-500 py-8">No orders found.</p>;
    return <div className="space-y-4">{orders.map((order, index) => <OrderCard key={order.id} order={order} jobs={jobs} films={films} onDelete={onDelete} onComplete={onComplete} onReorder={onReorder} isFirst={index === 0} isLast={index === orders.length - 1} db={db} userId={userId} />)}</div>;
});

const OrderCard = React.memo(function OrderCard({ order, jobs, films, onDelete, onComplete, onReorder, isFirst, isLast, db, userId }) {
    const job = useMemo(() => jobs.find(j => j.id === order.jobId), [jobs, order.jobId]);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    
    const stockStatus = useMemo(() => calculateStockStatus(job, films), [job, films]);

    const toggleHistory = useCallback(async () => {
        if (!showHistory && job) {
            setIsLoadingHistory(true);
            const historyCollectionPath = `artifacts/${appId}/users/${userId}/jobs/${job.id}/consumedRolls`;
            const q = query(collection(db, historyCollectionPath), orderBy("consumedAt", "desc"));
            const querySnapshot = await getDocs(q);
            setHistory(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsLoadingHistory(false);
        }
        setShowHistory(prev => !prev);
    }, [showHistory, job, db, userId]);

    return (
        <div className={`bg-gray-800 rounded-lg p-4 shadow-md border-l-4 ${order.status === 'completed' ? 'border-purple-500' : (stockStatus.ready ? 'border-green-500' : 'border-red-500')}`}>
            <div className="flex justify-between items-start gap-4">
                <div>
                    <h3 className="font-bold text-xl text-white">{order.orderName}</h3>
                    <p className="text-gray-400">Job: {order.jobName}</p>
                    <div className="flex flex-wrap gap-x-4 text-sm text-gray-300 mt-1">
                        {order.weightMade > 0 && <span>Weight: <span className="font-semibold">{order.weightMade} kg</span></span>}
                        {order.metersMade > 0 && <span>Meters: <span className="font-semibold">{order.metersMade} m</span></span>}
                    </div>
                     <p className="text-xs text-gray-500 mt-1">Ordered: {toDDMMYYYY(order.createdAt?.toDate())}</p>
                     {order.status === 'completed' && <p className="text-xs text-purple-400 mt-1">Completed: {toDDMMYYYY(order.completedAt?.toDate())}</p>}
                </div>
                <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                    <button onClick={() => onDelete(order)} className="text-gray-500 hover:text-red-500"><TrashIcon/></button>
                    {order.status === 'active' && onComplete && (
                        <button onClick={() => onComplete(order)} className="flex items-center text-sm bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-lg">
                            <CheckCircleIcon /><span className="ml-2">Mark Complete</span>
                        </button>
                    )}
                    {order.status === 'active' && onReorder && (
                        <div className="flex gap-2 items-center">
                            <button onClick={() => onReorder(order, 'up')} disabled={isFirst} className="text-gray-400 disabled:opacity-30 enabled:hover:text-green-400"><ArrowUpIcon /></button>
                            <button onClick={() => onReorder(order, 'down')} disabled={isLast} className="text-gray-400 disabled:opacity-30 enabled:hover:text-red-400"><ArrowDownIcon /></button>
                        </div>
                    )}
                </div>
            </div>
            {job && (
                <div className="mt-4 border-t border-gray-700 pt-3">
                    <div className="flex justify-between items-center">
                         <h4 className="font-semibold text-md mb-2 text-gray-300">Job Details & Stock Status</h4>
                         <button onClick={toggleHistory} className="flex items-center text-sm text-cyan-400 hover:text-cyan-300"><HistoryIcon /><span className="ml-1">{showHistory ? 'Hide' : 'View'} History</span></button>
                    </div>
                    <div className="text-sm text-gray-400 mb-2 flex flex-wrap gap-x-4">
                        <p>Job Size: <span className="font-semibold text-gray-200">{job.jobSize || 'N/A'}</span></p>
                        {job.numberOfColors != null && <p>Colours: <span className="font-semibold text-gray-200">{job.numberOfColors}</span></p>}
                        {job.printType && <p>Print Type: <span className="font-semibold text-gray-200">{job.printType.charAt(0).toUpperCase() + job.printType.slice(1)}</span></p>}
                    </div>
                    <div className="space-y-1">
                        {stockStatus.details.map((detail, i) => (<div key={i} className="flex justify-between items-center text-sm"><span className="text-gray-300">{detail.name}</span>{detail.inStock ? <span className="font-semibold text-green-400">{detail.rollCount} rolls ({detail.totalWeight.toFixed(2)} kg)</span> : <span className="font-semibold text-red-400">Out of Stock</span>}</div>))}
                    </div>
                     {showHistory && (
                         <div className="mt-4 border-t border-gray-600 pt-3">
                             <h5 className="font-semibold text-cyan-400 mb-2">Consumed Roll History</h5>
                             {isLoadingHistory ? <p className="text-sm text-gray-400">Loading history...</p> : (history.length > 0 ? <ul className="space-y-2 text-sm">{history.map(roll => (<li key={roll.id} className="p-2 bg-gray-700/50 rounded-md"><p className="font-semibold text-gray-200">{roll.filmType}</p><p className="text-gray-400">Consumed: {toDDMMYYYY(roll.consumedAt?.toDate())}</p></li>))}</ul> : <p className="text-sm text-gray-400">No rolls consumed for this job yet.</p>)}
                         </div>
                     )}
                </div>
            )}
        </div>
    );
});

const UseStock = React.memo(function UseStock({ films, jobs, db, userId, setView }) {
    const [selectedJob, setSelectedJob] = useState(null);
    const [jobSearch, setJobSearch] = useState('');
    const [showJobResults, setShowJobResults] = useState(false);
    const [selectedFilmType, setSelectedFilmType] = useState('');
    const [selectedRoll, setSelectedRoll] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [dateOfUse, setDateOfUse] = useState(toYYYYMMDD(new Date()));
    const jobSearchRef = useRef(null);
    const [messageModal, setMessageModal] = useState({isOpen: false, title: '', body: ''});

    useEffect(() => {
        function handleClickOutside(event) { if (jobSearchRef.current && !jobSearchRef.current.contains(event.target)) { setShowJobResults(false); } }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [jobSearchRef]);

    useEffect(() => {
        if (selectedJob?.materials?.length > 0) {
            const typesInStock = [...new Set(films.filter(f => f.currentWeight > 0 && selectedJob.materials.some(m => m.toLowerCase() === f.filmType.toLowerCase())).map(f => f.filmType))];
            setSelectedFilmType(typesInStock.length === 1 ? typesInStock[0] : '');
        } else { setSelectedFilmType(''); }
        setSelectedRoll(null); 
    }, [selectedJob, films]);

    const handleUseRoll = useCallback(async () => {
        if (!selectedRoll || !selectedJob || !db) { setMessageModal({isOpen: true, title: "Input Error", body: "A job and a film roll must be selected."}); return; }
        setIsProcessing(true);
        const batch = writeBatch(db);
        const historyData = { filmType: selectedRoll.filmType, netWeight: selectedRoll.netWeight, supplier: selectedRoll.supplier, purchaseDate: selectedRoll.purchaseDate, createdAt: selectedRoll.createdAt, originalId: selectedRoll.id, consumedAt: new Date(dateOfUse + 'T00:00:00Z'), jobId: selectedJob.id, jobName: selectedJob.jobName, consumedBy: userId };
        batch.set(doc(collection(db, `artifacts/${appId}/users/${userId}/jobs/${selectedJob.id}/consumedRolls`)), historyData);
        batch.delete(doc(db, `artifacts/${appId}/users/${userId}/films`, selectedRoll.id));
        try {
            await batch.commit();
            setMessageModal({isOpen: true, title: "Success", body: "Roll has been used and recorded in the job history."});
            setView('jobs');
        } catch (error) {
            console.error("CRITICAL ERROR in handleUseRoll:", error);
            setMessageModal({isOpen: true, title: "Database Error", body: `Failed to use roll. Please check console for details.`});
        } finally { setIsProcessing(false); }
    }, [selectedRoll, selectedJob, db, dateOfUse, userId, setView]);
    
    const filteredJobs = useMemo(() => jobSearch ? jobs.filter(job => job.jobName.toLowerCase().includes(jobSearch.toLowerCase())) : [], [jobs, jobSearch]);
    const handleJobSelect = (job) => { setSelectedJob(job); setJobSearch(job.jobName); setShowJobResults(false); };
    const availableFilmTypes = useMemo(() => {
        const types = [...new Set(films.filter(f => f.currentWeight > 0).map(f => f.filmType))].sort();
        if (selectedJob?.materials?.length > 0) return types.filter(t => selectedJob.materials.some(m => m.toLowerCase() === t.toLowerCase()));
        return types;
    }, [films, selectedJob]);
    const availableRolls = useMemo(() => selectedFilmType ? films.filter(f => f.filmType === selectedFilmType && f.currentWeight > 0) : [], [films, selectedFilmType]);

    return (
        <section>
             <MessageModal isOpen={messageModal.isOpen} onClose={() => setMessageModal({isOpen: false, title: '', body: ''})} title={messageModal.title}>{messageModal.body}</MessageModal>
            <h2 className="text-2xl font-semibold text-gray-200 mb-6">Record Stock Usage</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-6">
                <div ref={jobSearchRef}>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">1. Search and Select Job</label>
                    <div className="relative">
                        <input type="text" value={jobSearch} onChange={e => { setJobSearch(e.target.value); setShowJobResults(true);}} onFocus={() => setShowJobResults(true)} placeholder="Type to search for a job..." className="w-full bg-gray-700 p-2 pl-10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    </div>
                    {showJobResults && jobSearch && (
                        <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-gray-700 rounded-md border border-gray-600">
                            {filteredJobs.length > 0 ? filteredJobs.map(job => (<div key={job.id} onClick={() => handleJobSelect(job)} className="p-2 cursor-pointer hover:bg-cyan-600">{job.jobName}</div>)) : <div className="p-2 text-gray-400">No jobs found.</div>}
                        </div>
                    )}
                </div>
                {selectedJob && (
                    <div>
                        <label className="block text-sm font-medium text-cyan-400 mb-2">2. Select Film Type (Filtered by Job)</label>
                        <select value={selectedFilmType} onChange={e => { setSelectedFilmType(e.target.value); setSelectedRoll(null); }} className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" >
                            <option value="">-- Select a Film Type --</option>
                            {availableFilmTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                )}
                {selectedFilmType && (
                     <div className="border-t border-gray-700 pt-6 space-y-4">
                        <h3 className="text-lg font-medium text-cyan-400 mb-2">3. Select a Roll to Use</h3>
                         {availableRolls.length > 0 ? <div className="space-y-2 max-h-60 overflow-y-auto pr-2">{availableRolls.map(roll => (<button key={roll.id} onClick={() => setSelectedRoll(roll)} disabled={isProcessing} className={`w-full text-left p-3 rounded-md cursor-pointer transition-all ${selectedRoll?.id === roll.id ? 'bg-cyan-500 text-white shadow-lg' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-wait`}><div className="font-bold">{roll.filmType}</div><div className="text-sm">Supplier: {roll.supplier} | Wt: {roll.currentWeight.toFixed(2)}kg</div><div className="text-xs text-gray-400">ID: {roll.id}</div></button>))}</div> : <p className="text-gray-500 pt-4 ">No rolls of type '{selectedFilmType}' currently in stock.</p>}
                    </div>
                )}
                {selectedRoll && (
                    <div className="border-t border-gray-700 pt-6 space-y-4">
                        <h3 className="text-lg font-medium text-cyan-400">4. Confirm Usage</h3>
                        <div>
                            <p>Selected Job: <span className="font-semibold">{selectedJob.jobName}</span></p>
                            <p>Selected Roll: <span className="font-bold">{selectedRoll.filmType}</span> from <span className="font-bold">{selectedRoll.supplier}</span></p>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-cyan-400 mb-2">Date of Use</label>
                            <input type="date" value={dateOfUse} onChange={(e) => setDateOfUse(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                        </div>
                        <button onClick={handleUseRoll} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-red-800 disabled:cursor-wait">{isProcessing ? 'Processing...' : 'Confirm & Use Selected Roll'}</button>
                    </div>
                )}
            </div>
        </section>
    );
});

const FilmHistory = React.memo(function FilmHistory({ db, userId, jobs, setView, isPdfReady }) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [historySearch, setHistorySearch] = useState('');
    const [editingHistoryEntry, setEditingHistoryEntry] = useState(null);

    useEffect(() => {
        if (!db || !userId) { setIsLoading(false); return; }
        setIsLoading(true);
        const q = query(collectionGroup(db, 'consumedRolls'), where('consumedBy', '==', userId));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const combinedHistory = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            combinedHistory.sort((a, b) => (b.consumedAt?.toDate() || 0) - (a.consumedAt?.toDate() || 0));
            setHistory(combinedHistory);
            setIsLoading(false);
        }, (error) => { console.error("Error fetching global film history:", error); setIsLoading(false); });
        return () => unsubscribe();
    }, [db, userId]);

    const handleRevertToStock = useCallback(async (historyEntry) => {
        if (!db || !userId || !historyEntry) return;
        const batch = writeBatch(db);
        const filmRef = doc(db, `artifacts/${appId}/users/${userId}/films`, historyEntry.originalId);
        const revertedFilmData = { filmType: historyEntry.filmType, netWeight: historyEntry.netWeight, currentWeight: historyEntry.netWeight, supplier: historyEntry.supplier, purchaseDate: historyEntry.purchaseDate, createdAt: historyEntry.createdAt };
        batch.set(filmRef, revertedFilmData);
        batch.delete(doc(db, `artifacts/${appId}/users/${userId}/jobs/${historyEntry.jobId}/consumedRolls`, historyEntry.id));
        try {
            await batch.commit();
            alert("Roll successfully reverted to stock.");
            setEditingHistoryEntry(null);
            setView('stock');
        } catch (error) {
            console.error("Error reverting roll to stock:", error);
            alert("Failed to revert roll. Check console for details.");
        }
    }, [db, userId, setView]);

    const handleUpdateHistory = useCallback(async (historyEntry, newDate, newJob) => {
        if (!db || !userId || !historyEntry || !newJob) return;
        if (newJob.id === historyEntry.jobId) {
            const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${historyEntry.jobId}/consumedRolls`, historyEntry.id);
            try { await updateDoc(historyRef, { consumedAt: new Date(newDate + 'T00:00:00Z') }); setEditingHistoryEntry(null); }
            catch (error) { console.error("Error updating history date:", error); alert("Failed to update date."); }
        } else {
            const batch = writeBatch(db);
            const oldHistoryRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${historyEntry.jobId}/consumedRolls`, historyEntry.id);
            const newHistoryRef = doc(collection(db, `artifacts/${appId}/users/${userId}/jobs/${newJob.id}/consumedRolls`));
            const { id, ...rest } = historyEntry;
            const newData = { ...rest, jobId: newJob.id, jobName: newJob.jobName, consumedAt: new Date(newDate + 'T00:00:00Z') };
            batch.set(newHistoryRef, newData);
            batch.delete(oldHistoryRef);
            try { await batch.commit(); setEditingHistoryEntry(null); }
            catch (error) { console.error("Error moving history entry:", error); alert("Failed to move history entry."); }
        }
    }, [db, userId]);

    const filteredHistory = useMemo(() => history.filter(item => {
        const searchTerm = historySearch.toLowerCase();
        return item.filmType?.toLowerCase().includes(searchTerm) || item.jobName?.toLowerCase().includes(searchTerm);
    }), [history, historySearch]);

    const handleExportHistoryPDF = useCallback(() => {
        const title = "Global Film Usage History Report";
        const head = [['Film Type', 'Used in Job', 'Date Used', 'Supplier', 'Original Wt. (kg)']];
        const body = filteredHistory.map(item => [ item.filmType, item.jobName, toDDMMYYYY(item.consumedAt), item.supplier, item.netWeight?.toFixed(2)]);
        const fileName = `film-history-report-${toYYYYMMDD(new Date())}.pdf`;
        exportToPDF(title, head, body, fileName);
    }, [filteredHistory]);

    return(
        <section>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-200">Global Film Usage History</h2>
                <div className="relative w-full md:w-1/2"><input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search by film or job name..." className="w-full bg-gray-700 p-2 pl-10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" /><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div></div>
                <button 
                    onClick={handleExportHistoryPDF} 
                    disabled={!isPdfReady}
                    className={`flex items-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:scale-105 ${!isPdfReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={!isPdfReady ? "PDF exporter is loading..." : "Export history to PDF"}
                >
                    <DownloadIcon /><span className="ml-2 hidden md:inline">Export PDF</span>
                </button>
            </div>
            {isLoading ? <p>Loading history...</p> : (<div className="space-y-3">{filteredHistory.length > 0 ? filteredHistory.map(item => (<div key={item.id + item.jobId} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center"><div><p className="font-bold text-lg text-cyan-400">{item.filmType}</p><p className="text-gray-300">Used in Job: <span className="font-semibold">{item.jobName || 'N/A'}</span></p><p className="text-gray-400 text-sm">Date Used: {toDDMMYYYY(item.consumedAt)}</p><p className="text-gray-400 text-sm">Supplier: {item.supplier} | Original Wt: {item.netWeight.toFixed(2)}kg</p></div><button onClick={() => setEditingHistoryEntry(item)} className="text-blue-400 hover:text-blue-300 p-2"><EditIcon /></button></div>)) : <p className="text-center text-gray-500 py-8">No usage history found.</p>}</div>)}
            <AdvancedEditHistoryModal isOpen={!!editingHistoryEntry} onClose={() => setEditingHistoryEntry(null)} historyEntry={editingHistoryEntry} jobs={jobs} onUpdate={handleUpdateHistory} onRevert={handleRevertToStock} />
        </section>
    );
});

const AdvancedEditHistoryModal = React.memo(function AdvancedEditHistoryModal({ isOpen, onClose, historyEntry, jobs, onUpdate, onRevert }) {
    const [consumedAt, setConsumedAt] = useState('');
    const [selectedJobId, setSelectedJobId] = useState('');
    const [showRevertConfirm, setShowRevertConfirm] = useState(false);

    useEffect(() => {
        if (historyEntry) {
            setConsumedAt(toYYYYMMDD(historyEntry.consumedAt));
            setSelectedJobId(historyEntry.jobId || '');
            setShowRevertConfirm(false);
        }
    }, [historyEntry]);

    if (!isOpen || !historyEntry) return null;

    const handleUpdate = () => {
        const job = jobs.find(j => j.id === selectedJobId);
        if (!job) { alert("Please select a valid job."); return; }
        onUpdate(historyEntry, consumedAt, job);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg m-4">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">Edit History Entry</h3>
                <div className="space-y-4">
                    <p className="text-white bg-gray-700 p-3 rounded-md">Film: <strong className="font-semibold">{historyEntry.filmType}</strong></p>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Date of Use</label>
                        <input type="date" value={consumedAt} onChange={(e) => setConsumedAt(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Used in Job</label>
                        <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                            <option value="" disabled>-- Select a Job --</option>
                            {jobs.map(job => (<option key={job.id} value={job.id}>{job.jobName}</option>))}
                        </select>
                    </div>
                </div>
                <div className="mt-6 border-t border-gray-700 pt-4">
                    <h4 className="text-lg font-semibold text-red-400">Danger Zone</h4>
                    <div className="mt-2 p-3 bg-red-900/20 rounded-lg">
                        {!showRevertConfirm ? (<button onClick={() => setShowRevertConfirm(true)} className="w-full text-left text-red-400 hover:text-red-300">Revert to Stock (Delete History Entry)...</button>) : (
                            <div>
                                <p className="text-white">This will delete the history entry and add the roll back to inventory. Are you sure?</p>
                                <div className="flex gap-4 mt-3">
                                    <button onClick={() => onRevert(historyEntry)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg w-full">Yes, Revert</button>
                                    <button onClick={() => setShowRevertConfirm(false)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg w-full">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-end mt-6 gap-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button onClick={handleUpdate} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Update Entry</button>
                </div>
            </div>
        </div>
    );
});

export default App;
