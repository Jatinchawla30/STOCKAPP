import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, getDocs, collectionGroup, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// --- Firebase Configuration ---
// NOTE: It's assumed that your build environment (like Create React App) handles these environment variables.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};
const appId = process.env.REACT_APP_FIREBASE_APP_ID;


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
const XIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ExclamationIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const LockClosedIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400 mb-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>);
const CheckCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>);

// --- Login Screen Component ---
function LoginScreen({ auth }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setError('Failed to log in. Please check your email and password.');
            console.error("Login Error:", error);
        }
    };

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
}

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

    useEffect(() => {
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

    useEffect(() => {
        if (!isAuthReady || !db || !user) {
            if (isAuthReady) { setIsLoading(false); }
            return;
        }

        setIsLoading(true);
        let activeListeners = 3;
        const onInitialLoad = () => {
            activeListeners--;
            if (activeListeners === 0) setIsLoading(false);
        };

        const filmsPath = `artifacts/${appId}/users/${user.uid}/films`;
        const qFilms = query(collection(db, filmsPath));
        const unsubscribeFilms = onSnapshot(qFilms, (snapshot) => {
            setFilms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            onInitialLoad();
        }, (error) => { console.error("Error fetching films:", error); onInitialLoad(); });

        const jobsPath = `artifacts/${appId}/users/${user.uid}/jobs`;
        const qJobs = query(collection(db, jobsPath));
        const unsubscribeJobs = onSnapshot(qJobs, (snapshot) => {
            const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            jobsData.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
            setJobs(jobsData);
            onInitialLoad();
        }, (error) => { console.error("Error fetching jobs:", error); onInitialLoad(); });

        const ordersPath = `artifacts/${appId}/users/${user.uid}/orders`;
        const qOrders = query(collection(db, ordersPath));
        const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
            const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            ordersData.sort((a,b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
            setOrders(ordersData);
            onInitialLoad();
        }, (error) => { console.error("Error fetching orders:", error); onInitialLoad(); });

        return () => {
            unsubscribeFilms();
            unsubscribeJobs();
            unsubscribeOrders();
        };
    }, [isAuthReady, db, user]);


    const handleLogout = () => {
        if (auth) {
            signOut(auth);
        }
    };

    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <div className="flex flex-col items-center"><PackageIcon /><p className="mt-2 text-lg">Initializing...</p></div>
            </div>
        );
    }

    if (!user) {
        return <LoginScreen auth={auth} />;
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
                <Header user={user} />
                <Nav view={view} setView={setView} />
                <button onClick={handleLogout} className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    Logout
                </button>
                <main className="mt-8">
                    {view === 'stock' && <FilmInventory films={films} db={db} userId={user.uid} />}
                    {view === 'jobs' && <JobManagement films={films} jobs={jobs} orders={orders} db={db} userId={user.uid} />}
                    {view === 'orders' && <OrderManagement films={films} jobs={jobs} orders={orders} db={db} userId={user.uid} />}
                    {view === 'use_stock' && <UseStock films={films} jobs={jobs} db={db} userId={user.uid} setView={setView} />}
                    {view === 'stock_history' && <StockHistory db={db} userId={user.uid} />}
                </main>
            </div>
        </div>
    );
}

// --- MODAL AND HEADER COMPONENTS ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4 text-center">
                <div className="flex justify-center mb-4">
                    <ExclamationIcon />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
                <div className="text-gray-300 mb-6">{children}</div>
                <div className="flex justify-center gap-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Confirm Delete</button>
                </div>
            </div>
        </div>
    );
};

const MarkCompleteModal = ({ isOpen, onClose, onConfirm, order }) => {
    const [completionDate, setCompletionDate] = useState(toYYYYMMDD(new Date()));
    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(order.id, new Date(completionDate + 'T00:00:00Z'));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">Complete Order</h3>
                <p className="text-gray-300 mb-4">Select a completion date for order <strong className="text-white">{order?.orderName}</strong>.</p>
                <input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none mb-6"
                />
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Confirm Completion</button>
                </div>
            </div>
        </div>
    );
};

const MessageModal = ({ isOpen, onClose, title, children }) => {
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
}

const Header = ({ user }) => (
    <header className="mb-8 text-center md:text-left">
        <h2 className="text-2xl font-semibold text-gray-300">SHRI GURUNANAK INDUSTRIES</h2>
        <h1 className="text-4xl md:text-5xl font-bold text-cyan-400">Rotogravure Stock Manager</h1>
        {user && (
          <div className="mt-2 text-xs text-yellow-300">
            <p>Logged in as: {user.email}</p>
          </div>
        )}
        <p className="text-gray-400 mt-2">Your central hub for film inventory and job tracking.</p>
    </header>
);

const Nav = ({ view, setView }) => (
    <nav className="flex flex-wrap space-x-2 md:space-x-4 border-b border-gray-700 pb-2">
        <NavButton text="Stock Inventory" isActive={view === 'stock'} onClick={() => setView('stock')} />
        <NavButton text="Job Management" isActive={view === 'jobs'} onClick={() => setView('jobs')} />
        <NavButton text="Orders" isActive={view === 'orders'} onClick={() => setView('orders')} />
        <NavButton text="Use Stock" isActive={view === 'use_stock'} onClick={() => setView('use_stock')} />
        <NavButton text="Stock History" isActive={view === 'stock_history'} onClick={() => setView('stock_history')} />
    </nav>
);

const NavButton = ({ text, isActive, onClick }) => (
    <button onClick={onClick} className={`px-3 py-2 rounded-t-lg text-sm md:text-base font-semibold transition-colors duration-200 focus:outline-none ${isActive ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:bg-gray-800'}`}>{text}</button>
);

// --- FILM INVENTORY COMPONENTS ---
function FilmInventory({ films, db, userId }) {
    const [showForm, setShowForm] = useState(false);
    const [editingFilm, setEditingFilm] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [filmToDelete, setFilmToDelete] = useState(null);

    const handleFormSubmit = async (filmData) => {
        if (!db || !userId) return;
        const filmsCollectionPath = `artifacts/${appId}/users/${userId}/films`;

        const dataToSave = {
            ...filmData,
            purchaseDate: new Date(filmData.purchaseDate + 'T00:00:00Z'),
        };

        try {
            if (editingFilm) {
                const filmRef = doc(db, filmsCollectionPath, editingFilm.id);
                await updateDoc(filmRef, dataToSave);
                setEditingFilm(null);
            } else {
                await addDoc(collection(db, filmsCollectionPath), { ...dataToSave, currentWeight: dataToSave.netWeight, createdAt: new Date() });
            }
            setShowForm(false);
        } catch (error) { console.error("Error saving film:", error); }
    };

    const openDeleteModal = (film) => {
        setFilmToDelete(film);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setFilmToDelete(null);
        setIsDeleteModalOpen(false);
    };

    const executeDelete = async () => {
        if (!db || !userId || !filmToDelete) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/films`, filmToDelete.id));
        } catch (error) { console.error("Error deleting film:", error); }
        finally {
            closeDeleteModal();
        }
    };

    const handleEdit = (film) => {
        setEditingFilm(film);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingFilm(null);
    };

    const filmCategories = films.reduce((acc, film) => {
        const key = film.filmType || 'Uncategorized';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(film);
        return acc;
    }, {});

    return (
        <section>
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={executeDelete}
                title="Delete Film Roll?"
            >
                <p>Are you sure you want to delete this <strong className="text-white">{filmToDelete?.filmType}</strong> roll?</p>
                <p className="mt-2">This action cannot be undone.</p>
            </ConfirmationModal>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-200">
                    {selectedCategory ? `Category: ${selectedCategory}` : 'Film Stock by Category'}
                </h2>
                <button onClick={() => { setEditingFilm(null); setShowForm(true); }} className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-transform duration-200 hover:scale-105">
                    <PlusIcon /><span className="ml-2 hidden md:inline">Add New Roll</span>
                </button>
            </div>

            {showForm && <FilmForm onSubmit={handleFormSubmit} onCancel={closeForm} initialData={editingFilm} />}

            {selectedCategory ? (
                <div>
                    <button onClick={() => setSelectedCategory(null)} className="flex items-center mb-4 text-cyan-400 hover:text-cyan-300">
                        <ChevronLeftIcon /> Back to Categories
                    </button>
                    <FilmList films={filmCategories[selectedCategory] || []} onEdit={handleEdit} onDelete={openDeleteModal} />
                </div>
            ) : (
                <CategoryList categories={filmCategories} onSelectCategory={setSelectedCategory} />
            )}
        </section>
    );
}

function FilmForm({ onSubmit, onCancel, initialData }) {
    const [formData, setFormData] = useState({ filmType: '', netWeight: '', supplier: '', purchaseDate: toYYYYMMDD(new Date()) });

    useEffect(() => {
        const defaultState = { filmType: '', netWeight: '', supplier: '', purchaseDate: toYYYYMMDD(new Date()) };
        if (initialData) {
            const purchaseDate = initialData.purchaseDate?.toDate ? toYYYYMMDD(initialData.purchaseDate.toDate()) : defaultState.purchaseDate;
            setFormData({
                filmType: initialData.filmType || '', netWeight: initialData.netWeight || '',
                supplier: initialData.supplier || '',
                purchaseDate: purchaseDate,
            });
        } else { setFormData(defaultState); }
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
}

function CategoryList({ categories, onSelectCategory }) {
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
}

function FilmList({ films, onEdit, onDelete }) {
    return (
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-md">
            <table className="w-full text-left">
                <thead className="bg-gray-700"><tr>
                    <th className="p-3">Film Type</th><th className="p-3">Current Wt. (kg)</th><th className="p-3">Supplier</th>
                    <th className="p-3">Purchase Date</th><th className="p-3">Actions</th>
                </tr></thead>
                <tbody>
                    {films.map(film => (
                        <tr key={film.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                            <td className="p-3 font-medium">{film.filmType}</td><td className="p-3">{film.currentWeight?.toFixed(2)}</td>
                            <td className="p-3">{film.supplier}</td>
                            <td className="p-3">{toDDMMYYYY(film.purchaseDate)}</td>
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
}

// --- JOB MANAGEMENT COMPONENTS ---
function EditHistoryModal({ isOpen, onClose, onSave, onDelete, historyEntry }) {
    const [consumedAt, setConsumedAt] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState(null);

    useEffect(() => {
        if (historyEntry) {
            setConsumedAt(toYYYYMMDD(historyEntry.consumedAt));
        }
    }, [historyEntry]);

    if (!isOpen) return null;

    const handleDeleteClick = () => {
        setEntryToDelete(historyEntry);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        onDelete(entryToDelete.id);
        setIsDeleteModalOpen(false);
        onClose(); // Close the edit modal after deletion
    };


    return (
        <>
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">Edit History Entry</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Film Type</label>
                        <p className="text-white bg-gray-700 p-2 rounded-md">{historyEntry?.filmType}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Date of Use</label>
                        <input
                            type="date"
                            value={consumedAt}
                            onChange={(e) => setConsumedAt(e.target.value)}
                            className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                    </div>
                </div>
                <div className="flex justify-between mt-6 gap-4">
                    <button onClick={handleDeleteClick} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Delete Entry</button>
                    <div>
                        <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg mr-2">Cancel</button>
                        <button onClick={() => onSave(historyEntry.id, consumedAt)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Update</button>
                    </div>
                </div>
            </div>
        </div>
        <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={confirmDelete}
            title="Delete History Entry?"
        >
            <p>Are you sure you want to delete this history entry for <strong className="text-white">{entryToDelete?.filmType}</strong>?</p>
            <p className="mt-2">This action cannot be undone.</p>
        </ConfirmationModal>
      </>
    );
}

function JobManagement({ films, jobs, orders, db, userId }) {
    const [showForm, setShowForm] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [jobSearch, setJobSearch] = useState('');
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [messageModalContent, setMessageModalContent] = useState({ title: '', body: '' });

    const handleJobSubmit = async (jobData) => {
        if (!db || !userId) return;
        const jobsCollectionPath = `artifacts/${appId}/users/${userId}/jobs`;
        try {
            if (editingJob) {
                const jobRef = doc(db, jobsCollectionPath, editingJob.id);
                await updateDoc(jobRef, jobData);
                setEditingJob(null);
            } else {
                await addDoc(collection(db, jobsCollectionPath), { ...jobData, createdAt: new Date() });
            }
            setShowForm(false);
        } catch (error) { console.error("Error saving job:", error); }
    };

    const handleEditJob = (job) => {
        setEditingJob(job);
        setShowForm(true);
    };

    const openDeleteModal = (job) => {
        const isJobInActiveOrder = orders.some(order => order.jobId === job.id && order.status === 'active');
        if (isJobInActiveOrder) {
            setMessageModalContent({
                title: 'Deletion Prevented',
                body: 'This job is linked to an active order. Please complete or delete the order before deleting this job.'
            });
            setIsMessageModalOpen(true);
        } else {
            setJobToDelete(job);
            setDeleteModalOpen(true);
        }
    };

    const closeDeleteModal = () => {
        setJobToDelete(null);
        setDeleteModalOpen(false);
    };

    const executeDeleteJob = async () => {
        if (!jobToDelete || !db || !userId) return;

        const jobRef = doc(db, `artifacts/${appId}/users/${userId}/jobs`, jobToDelete.id);
        const historyCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/jobs/${jobToDelete.id}/consumedRolls`);

        try {
            const historySnapshot = await getDocs(historyCollectionRef);
            const batch = writeBatch(db);
            historySnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            batch.delete(jobRef);
            await batch.commit();
        } catch (error) {
            console.error("Error deleting job and its history:", error);
        } finally {
            closeDeleteModal();
        }
    };

    const filteredJobs = jobSearch ? jobs.filter(job => job.jobName.toLowerCase().includes(jobSearch.toLowerCase())) : jobs;

    return (
        <section>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-200">Production Jobs (Memo)</h2>
                <div className="relative w-full md:w-1/3">
                    <input type="text" value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder="Search jobs..." className="w-full bg-gray-700 p-2 pl-10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                </div>
                <button onClick={() => { setEditingJob(null); setShowForm(true); }} className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-transform duration-200 hover:scale-105 w-full md:w-auto">
                    <PlusIcon /><span className="ml-2 hidden md:inline">Add New Job</span>
                </button>
            </div>
            {showForm && <JobForm films={films} onSubmit={handleJobSubmit} onCancel={() => { setShowForm(false); setEditingJob(null); }} initialData={editingJob} />}
            <JobList films={films} jobs={filteredJobs} onDelete={openDeleteModal} onEdit={handleEditJob} db={db} userId={userId} />
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={executeDeleteJob}
                title="Delete Job?"
            >
                <p>Are you sure you want to delete the job <strong className="text-white">{jobToDelete?.jobName}</strong>?</p>
                <p className="mt-2">This will also delete its entire consumption history. This action cannot be undone.</p>
            </ConfirmationModal>
            <MessageModal
                isOpen={isMessageModalOpen}
                onClose={() => setIsMessageModalOpen(false)}
                title={messageModalContent.title}
            >
                {messageModalContent.body}
            </MessageModal>
        </section>
    );
}

function JobForm({ onSubmit, onCancel, films, initialData }) {
    const [jobName, setJobName] = useState('');
    const [jobSize, setJobSize] = useState('');
    const [materials, setMaterials] = useState(['']);
    const [activeMaterialIndex, setActiveMaterialIndex] = useState(null);
    const materialsRef = useRef(null);

    useEffect(() => {
        if (initialData) {
            setJobName(initialData.jobName || '');
            setJobSize(initialData.jobSize || '');
            setMaterials(initialData.materials && initialData.materials.length > 0 ? initialData.materials : ['']);
        } else {
            setJobName('');
            setJobSize('');
            setMaterials(['']);
        }
    }, [initialData]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (materialsRef.current && !materialsRef.current.contains(event.target)) {
                setActiveMaterialIndex(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [materialsRef]);

    const availableFilmTypes = useMemo(() => {
        if (!films) return [];
        return [...new Set(films.map(f => f.filmType.trim()).filter(Boolean))].sort();
    }, [films]);

    const addMaterial = () => setMaterials([...materials, '']);
    const handleMaterialChange = (index, value) => {
        const newMaterials = [...materials];
        newMaterials[index] = value;
        setMaterials(newMaterials);
    };
    const removeMaterial = (index) => setMaterials(materials.filter((_, i) => i !== index));

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ jobName, jobSize, materials: materials.map(m => m.trim()).filter(m => m !== '') });
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg mb-8 shadow-lg">
            <h3 className="text-xl font-semibold mb-4 text-cyan-400">{initialData ? 'Edit Job' : 'Add New Job'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input value={jobName} onChange={e => setJobName(e.target.value)} placeholder="Job Name" required className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                <input value={jobSize} onChange={e => setJobSize(e.target.value)} placeholder="Job Size (e.g., 100,000 meters)" required className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                <div ref={materialsRef}>
                    <h4 className="font-semibold text-gray-300">Required Materials (select from inventory)</h4>
                    {materials.map((material, index) => {
                        const filteredTypes = material ? availableFilmTypes.filter(type => type.toLowerCase().includes(material.toLowerCase())) : [];
                        return (
                            <div key={index} className="flex items-center space-x-2 mt-2">
                                <div className="relative w-full">
                                    <input value={material}
                                        onChange={e => handleMaterialChange(index, e.target.value)}
                                        onFocus={() => setActiveMaterialIndex(index)}
                                        placeholder="Type to search film..."
                                        autoComplete="off"
                                        className="w-full bg-gray-700 p-2 rounded-md" />
                                    {activeMaterialIndex === index && material && (
                                        <div className="absolute z-20 w-full mt-1 bg-gray-600 border border-gray-500 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                            {filteredTypes.length > 0 ? (
                                                filteredTypes.map(type => (
                                                    <div key={type}
                                                        onClick={() => {
                                                            handleMaterialChange(index, type);
                                                            setActiveMaterialIndex(null);
                                                        }}
                                                        className="p-2 cursor-pointer hover:bg-cyan-600">
                                                        {type}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-2 text-gray-400">No matching film types found.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button type="button" onClick={() => removeMaterial(index)} className="text-red-500 hover:text-red-400 p-2 rounded-full bg-gray-700"><TrashIcon /></button>
                            </div>
                        );
                    })}
                    <button type="button" onClick={addMaterial} className="mt-2 text-cyan-400 hover:text-cyan-300 text-sm">+ Add Material</button>
                </div>
                <div className="flex items-center space-x-4 pt-2">
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg w-full">{initialData ? 'Update Job' : 'Create Job'}</button>
                    <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg w-full">Cancel</button>
                </div>
            </form>
        </div>
    );
}

function JobList({ films, jobs, onDelete, onEdit, db, userId }) {
    if (jobs.length === 0) return <p className="text-center text-gray-500 py-8">No jobs found.</p>;
    return <div className="space-y-4">{jobs.map(job => <JobCard key={job.id} job={job} films={films} onDelete={onDelete} onEdit={onEdit} db={db} userId={userId} />)}</div>;
}

function JobCard({ job, films, onDelete, onEdit, db, userId }) {
    const [showHistory, setShowHistory] = useState(false);
    const [showStock, setShowStock] = useState(false);
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [editingHistoryEntry, setEditingHistoryEntry] = useState(null);

    const toggleHistory = () => {
        setShowHistory(prev => !prev);
    };

    useEffect(() => {
        if (!showHistory || !db || !userId) return;

        setIsLoadingHistory(true);
        const historyCollectionPath = `artifacts/${appId}/users/${userId}/jobs/${job.id}/consumedRolls`;
        const q = query(collection(db, historyCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            historyData.sort((a,b) => (b.consumedAt?.toDate() || 0) - (a.consumedAt?.toDate() || 0));
            setHistory(historyData);
            setIsLoadingHistory(false);
        });
        return () => unsubscribe();
    }, [showHistory, db, userId, job.id]);

    const handleUpdateHistory = async (historyId, newDate) => {
        const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${job.id}/consumedRolls`, historyId);
        try {
            await updateDoc(historyRef, { consumedAt: new Date(newDate + 'T00:00:00Z') });
            setEditingHistoryEntry(null);
        } catch (error) {
            console.error("Error updating history entry:", error);
        }
    };

    const handleDeleteHistory = async (historyId) => {
        const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${job.id}/consumedRolls`, historyId);
        try {
            await deleteDoc(historyRef);
            setEditingHistoryEntry(null);
        } catch (error) {
            console.error("Error deleting history entry:", error);
        }
    };

    return (
        <>
            <div className="bg-gray-800 rounded-lg p-4 shadow-md border-l-4 border-gray-600">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-xl text-gray-100">{job.jobName}</h3>
                        <p className="text-gray-400">{job.jobSize}</p>
                        <p className="text-xs text-gray-500">Created: {toDDMMYYYY(job.createdAt?.toDate())}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button onClick={() => onEdit(job)} className="text-blue-400 hover:text-blue-300"><EditIcon /></button>
                        <button onClick={() => setShowStock(!showStock)} className="flex items-center text-sm text-yellow-400 hover:text-yellow-300 transition-colors">
                            <ClipboardListIcon />
                            <span className="ml-1">{showStock ? 'Hide' : 'View'} Stock</span>
                        </button>
                        <button onClick={toggleHistory} className="flex items-center text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                            <HistoryIcon />
                            <span className="ml-1">{showHistory ? 'Hide' : 'View'} History</span>
                        </button>
                        <button onClick={() => onDelete(job)} className="text-gray-500 hover:text-red-500"><TrashIcon /></button>
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
                                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${matchingFilms.length > 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                            {matchingFilms.length > 0 ? 'In Stock' : 'Out of Stock'}
                                        </span>
                                    </div>
                                    {matchingFilms.length > 0 && (
                                        <div className="text-sm text-gray-400 mt-2">
                                            <p>{matchingFilms.length} roll(s) available. Total Weight: {totalWeight.toFixed(2)} kg</p>
                                        </div>
                                    )}
                                </div>
                            )
                        }) : <p className="text-gray-500">No materials specified for this job.</p>}
                    </div>
                )}
                {showHistory && (
                    <div className="mt-4 border-t border-gray-700 pt-4">
                        <h4 className="font-semibold text-lg text-cyan-400 mb-2">Consumed Roll History</h4>
                        {isLoadingHistory ? <p>Loading history...</p> : (
                            history.length > 0 ? (
                                <ul className="space-y-2">
                                    {history.map(roll => (
                                        <li key={roll.id} className="p-2 bg-gray-700 rounded-md flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">{roll.filmType}</p>
                                                <p className="text-sm text-gray-400">Consumed on: {toDDMMYYYY(roll.consumedAt.toDate())}</p>
                                            </div>
                                            <button onClick={() => setEditingHistoryEntry(roll)} className="text-blue-400 hover:text-blue-300"><EditIcon /></button>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p>No rolls have been consumed for this job.</p>
                        )}
                    </div>
                )}
            </div>
            <EditHistoryModal
                isOpen={!!editingHistoryEntry}
                onClose={() => setEditingHistoryEntry(null)}
                onSave={handleUpdateHistory}
                onDelete={handleDeleteHistory}
                historyEntry={editingHistoryEntry}
            />
        </>
    );
}

// --- ORDER MANAGEMENT COMPONENTS ---
function OrderManagement({ films, jobs, orders, db, userId }) {
    const [showForm, setShowForm] = useState(false);
    const [viewType, setViewType] = useState('active');
    const [completedSearch, setCompletedSearch] = useState('');
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [orderToComplete, setOrderToComplete] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);

    const handleOrderSubmit = async (orderData) => {
        if (!db || !userId) return;
        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/orders`), {
                ...orderData,
                status: 'active',
                createdAt: new Date(),
                ownerId: userId
            });
            setShowForm(false);
        } catch (error) { console.error("Error creating order:", error); }
    };

    const handleOpenCompleteModal = (order) => {
        setOrderToComplete(order);
        setIsCompleteModalOpen(true);
    };

    const handleCloseCompleteModal = () => {
        setOrderToComplete(null);
        setIsCompleteModalOpen(false);
    };

    const markOrderComplete = async (orderId, completionDate) => {
        if (!db || !userId || !orderId) return;
        const orderRef = doc(db, `artifacts/${appId}/users/${userId}/orders`, orderId);
        try {
            await updateDoc(orderRef, {
                status: 'completed',
                completedAt: completionDate
            });
        } catch (error) {
            console.error("Error completing order: ", error);
        } finally {
            handleCloseCompleteModal();
        }
    };

    const openDeleteModal = (order) => {
        setOrderToDelete(order);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setOrderToDelete(null);
        setIsDeleteModalOpen(false);
    };

    const executeDeleteOrder = async () => {
        if (!orderToDelete) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/orders`, orderToDelete.id));
        } catch (error) {
            console.error("Error deleting order: ", error);
        } finally {
            closeDeleteModal();
        }
    };

    const activeOrders = orders.filter(o => o.status === 'active');
    const completedOrders = orders.filter(o => o.status === 'completed')
        .filter(o => o.orderName.toLowerCase().includes(completedSearch.toLowerCase()));

    return (
        <section>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-200">Customer Orders</h2>
                <div className="flex-grow flex justify-center">
                    <div className="bg-gray-700 p-1 rounded-lg flex space-x-1">
                        <button onClick={() => setViewType('active')} className={`px-4 py-1 rounded-md text-sm font-semibold ${viewType === 'active' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Active</button>
                        <button onClick={() => setViewType('completed')} className={`px-4 py-1 rounded-md text-sm font-semibold ${viewType === 'completed' ? 'bg-cyan-600 text-white' : 'text-gray-300'}`}>Completed</button>
                    </div>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-transform duration-200 hover:scale-105 w-full md:w-auto">
                    <PlusIcon /><span className="ml-2 hidden md:inline">Add New Order</span>
                </button>
            </div>
            {showForm && <OrderForm jobs={jobs} onSubmit={handleOrderSubmit} onCancel={() => setShowForm(false)} />}

            <MarkCompleteModal
                isOpen={isCompleteModalOpen}
                onClose={handleCloseCompleteModal}
                onConfirm={markOrderComplete}
                order={orderToComplete}
            />

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={executeDeleteOrder}
                title="Delete Order?"
            >
                <p>Are you sure you want to delete the order <strong className="text-white">{orderToDelete?.orderName}</strong>?</p>
                <p className="mt-2">This action cannot be undone.</p>
            </ConfirmationModal>

            {viewType === 'active' ? (
                <OrderList orders={activeOrders} jobs={jobs} films={films} onDelete={openDeleteModal} onComplete={handleOpenCompleteModal} db={db} userId={userId} />
            ) : (
                <div>
                    <div className="relative mb-4">
                        <input type="text" value={completedSearch} onChange={e => setCompletedSearch(e.target.value)} placeholder="Search completed orders..." className="w-full bg-gray-700 p-2 pl-10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    </div>
                    <OrderList orders={completedOrders} jobs={jobs} films={films} onDelete={openDeleteModal} db={db} userId={userId} />
                </div>
            )}
        </section>
    );
}

function OrderForm({ jobs, onSubmit, onCancel }) {
    const [orderName, setOrderName] = useState('');
    const [weightMade, setWeightMade] = useState('');
    const [metersMade, setMetersMade] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);
    const [jobSearch, setJobSearch] = useState('');
    const [showJobResults, setShowJobResults] = useState(false);
    const jobSearchRef = useRef(null);
    const [messageModal, setMessageModal] = useState({ isOpen: false, title: '', body: '' });


    useEffect(() => {
        function handleClickOutside(event) {
            if (jobSearchRef.current && !jobSearchRef.current.contains(event.target)) {
                setShowJobResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [jobSearchRef]);


    const filteredJobs = jobSearch ? jobs.filter(job => job.jobName.toLowerCase().includes(jobSearch.toLowerCase())) : [];

    const handleJobSelect = (job) => {
        setSelectedJob(job);
        setJobSearch(job.jobName);
        setShowJobResults(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedJob) {
            setMessageModal({ isOpen: true, title: "Input Error", body: "Please select a job for this order." });
            return;
        }
        onSubmit({
            orderName,
            weightMade: parseFloat(weightMade) || 0,
            metersMade: parseFloat(metersMade) || 0,
            jobId: selectedJob.id,
            jobName: selectedJob.jobName,
        });
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg mb-8 shadow-lg">
            <MessageModal isOpen={messageModal.isOpen} onClose={() => setMessageModal({ isOpen: false, title: '', body: '' })} title={messageModal.title}>{messageModal.body}</MessageModal>
            <h3 className="text-xl font-semibold mb-4 text-cyan-400">Add New Order</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input value={orderName} onChange={e => setOrderName(e.target.value)} placeholder="Order Name / Customer" required className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="number" value={weightMade} onChange={e => setWeightMade(e.target.value)} placeholder="Weight to be Made (kg)" className="w-full bg-gray-700 p-2 rounded-md" />
                    <input type="number" value={metersMade} onChange={e => setMetersMade(e.target.value)} placeholder="Meters to be Made" className="w-full bg-gray-700 p-2 rounded-md" />
                </div>
                <div ref={jobSearchRef} className="relative">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Select Associated Job</label>
                    <input
                        type="text" value={jobSearch}
                        onChange={e => { setJobSearch(e.target.value); setShowJobResults(true); }}
                        onFocus={() => setShowJobResults(true)}
                        placeholder="Type to search for a job..."
            _git             className="w-full bg-gray-700 p-2 pl-10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                    <div className="absolute inset-y-0 left-0 pl-3 top-6 flex items-center pointer-events-none"><SearchIcon /></div>
                    {showJobResults && jobSearch && (
                        <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-gray-700 rounded-md border border-gray-600">
                            {filteredJobs.length > 0 ? filteredJobs.map(job => (
                                <div key={job.id} onClick={() => handleJobSelect(job)} className="p-2 cursor-pointer hover:bg-cyan-600">
                                    {job.jobName}
                                </div>
                            )) : <div className="p-2 text-gray-400">No jobs found.</div>}
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
}

function OrderList({ orders, jobs, films, onDelete, onComplete, db, userId }) {
    if (orders.length === 0) return <p className="text-center text-gray-500 py-8">No orders found.</p>;
    return <div className="space-y-4">{orders.map(order => <OrderCard key={order.id} order={order} jobs={jobs} films={films} onDelete={onDelete} onComplete={onComplete} db={db} userId={userId} />)}</div>;
}

function OrderCard({ order, jobs, films, onDelete, onComplete, db, userId }) {
    const job = useMemo(() => jobs.find(j => j.id === order.jobId), [jobs, order.jobId]);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const stockStatus = useMemo(() => {
        if (!job || !job.materials || job.materials.length === 0) {
            return { ready: true, missing: [], details: [] };
        }
        let ready = true;
        const missing = [];
        const details = job.materials.map(material => {
            const matchingFilms = films.filter(f => f.filmType.toLowerCase() === material.toLowerCase() && f.currentWeight > 0);
            const inStock = matchingFilms.length > 0;
            const rollCount = matchingFilms.length;
            const totalWeight = matchingFilms.reduce((sum, film) => sum + (film.currentWeight || 0), 0);

            if (!inStock) {
                ready = false;
                missing.push(material);
            }
            return { name: material, inStock, rollCount, totalWeight };
        });
        return { ready, missing, details };
    }, [job, films]);

    const toggleHistory = async () => {
        if (!showHistory) {
            if (!job) return;
            setIsLoadingHistory(true);
            const historyCollectionPath = `artifacts/${appId}/users/${userId}/jobs/${job.id}/consumedRolls`;
            const q = query(collection(db, historyCollectionPath));
            const querySnapshot = await getDocs(q);
            const historyData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            historyData.sort((a,b) => (b.consumedAt?.toDate() || 0) - (a.consumedAt?.toDate() || 0));
            setHistory(historyData);
            setIsLoadingHistory(false);
        }
        setShowHistory(!showHistory);
    };

    return (
        <div className={`bg-gray-800 rounded-lg p-4 shadow-md border-l-4 ${order.status === 'completed' ? 'border-purple-500' : (stockStatus.ready ? 'border-green-500' : 'border-red-500')}`}>
            <div className="flex justify-between items-start gap-4">
    _git           <div>
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
                    <button onClick={() => onDelete(order)} className="text-gray-500 hover:text-red-500"><TrashIcon /></button>
                    {order.status === 'active' && onComplete && (
                        <button onClick={() => onComplete(order)} className="flex items-center text-sm bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-lg">
                            <CheckCircleIcon />
                            <span className="ml-2">Mark Complete</span>
                        </button>
                    )}
                </div>
            </div>
            {job && (
                <div className="mt-4 border-t border-gray-700 pt-3">
                    <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-md mb-2 text-gray-300">Job Details & Stock Status</h4>
                        <button onClick={toggleHistory} className="flex items-center text-sm text-cyan-400 hover:text-cyan-300">
                            <HistoryIcon />
                            <span className="ml-1">{showHistory ? 'Hide' : 'View'} History</span>
                        </button>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">Job Size: <span className="font-semibold">{job.jobSize || 'N/A'}</span></p>
                    <div className="space-y-1">
                        {stockStatus.details.map((detail, i) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                                <span className="text-gray-300">{detail.name}</span>
                                {detail.inStock ?
                                    <span className="font-semibold text-green-400">{detail.rollCount} rolls ({detail.totalWeight.toFixed(2)} kg)</span>
                                    : <span className="font-semibold text-red-400">Out of Stock</span>
                        _git       }
                            </div>
                        ))}
                    </div>
                    {showHistory && (
                        <div className="mt-4 border-t border-gray-600 pt-3">
                            <h5 className="font-semibold text-cyan-400 mb-2">Consumed Roll History</h5>
                            {isLoadingHistory ? <p className="text-sm text-gray-400">Loading history...</p> : (
                                history.length > 0 ? (
                                    <ul className="space-y-2 text-sm">
                                        {history.map(roll => (
                                            <li key={roll.id} className="p-2 bg-gray-700/50 rounded-md">
                                                <p className="font-semibold text-gray-200">{roll.filmType}</p>
                                                <p className="text-gray-400">Consumed: {toDDMMYYYY(roll.consumedAt?.toDate())}</p>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <p className="text-sm text-gray-400">No rolls consumed for this job yet.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


// --- USE STOCK COMPONENTS ---
function UseStock({ films, jobs, db, userId, setView }) {
    const [selectedJob, setSelectedJob] = useState(null);
    const [jobSearch, setJobSearch] = useState('');
    const [showJobResults, setShowJobResults] = useState(false);
    const [selectedFilmType, setSelectedFilmType] = useState('');
    const [selectedRoll, setSelectedRoll] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [dateOfUse, setDateOfUse] = useState(toYYYYMMDD(new Date()));
    const jobSearchRef = useRef(null);
    const [messageModal, setMessageModal] = useState({ isOpen: false, title: '', body: '' });

    useEffect(() => {
        function handleClickOutside(event) {
            if (jobSearchRef.current && !jobSearchRef.current.contains(event.target)) {
                setShowJobResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [jobSearchRef]);

    useEffect(() => {
        if (selectedJob && selectedJob.materials && selectedJob.materials.length > 0) {
            const jobFilmTypesInStock = [...new Set(films
                .filter(film => film.currentWeight > 0 && selectedJob.materials.some(mat => mat.toLowerCase() === film.filmType.toLowerCase()))
                .map(film => film.filmType)
            )];

            if (jobFilmTypesInStock.length === 1) {
                setSelectedFilmType(jobFilmTypesInStock[0]);
            } else {
                setSelectedFilmType('');
            }
        } else {
            setSelectedFilmType('');
        }
        setSelectedRoll(null);
    }, [selectedJob, films]);


    const handleUseRoll = async () => {
        if (!selectedRoll || !selectedJob || !db) {
            setMessageModal({ isOpen: true, title: "Input Error", body: "A job and a film roll must be selected." });
            return;
        }

        setIsProcessing(true);

        const batch = writeBatch(db);
        const originalFilmRef = doc(db, `artifacts/${appId}/users/${userId}/films`, selectedRoll.id);
        const historyCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/jobs/${selectedJob.id}/consumedRolls`);
        const newHistoryDocRef = doc(historyCollectionRef);

        const consumedData = {
            filmType: selectedRoll.filmType || "N/A", netWeight: selectedRoll.netWeight || 0,
            supplier: selectedRoll.supplier || "N/A", purchaseDate: selectedRoll.purchaseDate,
            createdAt: selectedRoll.createdAt, originalId: selectedRoll.id, consumedAt: new Date(dateOfUse + 'T00:00:00Z'),
            jobId: selectedJob.id, jobName: selectedJob.jobName, consumedBy: userId,
        };

        batch.set(newHistoryDocRef, consumedData);
        batch.delete(originalFilmRef);

        try {
            await batch.commit();
            setMessageModal({ isOpen: true, title: "Success", body: "Roll has been used and recorded in the job history." });
            setView('stock');
        } catch (error) {
            console.error("CRITICAL ERROR in handleUseRoll:", error);
            setMessageModal({ isOpen: true, title: "Database Error", body: `Failed to use roll. Please check console for details.` });
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredJobs = jobSearch ? jobs.filter(job => job.jobName.toLowerCase().includes(jobSearch.toLowerCase())) : [];

    const availableFilmTypes = useMemo(() => {
        const allInStockTypes = [...new Set(films.filter(film => film.currentWeight > 0).map(film => film.filmType))].sort();
        if (selectedJob && selectedJob.materials && selectedJob.materials.length > 0) {
            return allInStockTypes.filter(type => selectedJob.materials.some(mat => mat.toLowerCase() === type.toLowerCase()));
        }
        return allInStockTypes;
    }, [films, selectedJob]);

    const availableRolls = selectedFilmType ? films.filter(film => film.filmType === selectedFilmType && film.currentWeight > 0) : [];

    const handleJobSelect = (job) => {
        setSelectedJob(job);
        setJobSearch(job.jobName);
        setShowJobResults(false);
    };

    return (
        <section>
            <MessageModal
                isOpen={messageModal.isOpen}
                onClose={() => setMessageModal({ isOpen: false, title: '', body: '' })}
                title={messageModal.title}
            >
                {messageModal.body}
            </MessageModal>
            <h2 className="text-2xl font-semibold text-gray-200 mb-6">Record Stock Usage</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-6">
                <div ref={jobSearchRef}>
                    <label className="block text-sm font-medium text-cyan-400 mb-2">1. Search and Select Job</label>
                    <div className="relative">
                        <input type="text" value={jobSearch}
                            onChange={e => { setJobSearch(e.target.value); setShowJobResults(true); }}
                            onFocus={() => setShowJobResults(true)}
                            placeholder="Type to search for a job..."
                            className="w-full bg-gray-700 p-2 pl-10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    </div>
                    {showJobResults && jobSearch && (
                        <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-gray-700 rounded-md border border-gray-600">
                            {filteredJobs.length > 0 ? filteredJobs.map(job => (
                                <div key={job.id} onClick={() => handleJobSelect(job)} className="p-2 cursor-pointer hover:bg-cyan-600">
                                    {job.jobName}
                                </div>
                            )) : <div className="p-2 text-gray-400">No jobs found.</div>}
                        </div>
                    )}
                </div>

                {selectedJob && (
                    <div>
                        <label className="block text-sm font-medium text-cyan-400 mb-2">2. Select Film Type (Filtered by Job)</label>
                        <select
                            value={selectedFilmType}
                            onChange={e => { setSelectedFilmType(e.target.value); setSelectedRoll(null); }}
                            className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" >
                            <option value="">-- Select a Film Type --</option>
                            {availableFilmTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                )}

                {selectedFilmType && (
                    <div className="border-t border-gray-700 pt-6 space-y-4">
                        <h3 className="text-lg font-medium text-cyan-400 mb-2">3. Select a Roll to Use</h3>
                        {availableRolls.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {availableRolls.map(roll => (
                                    <button key={roll.id} onClick={() => setSelectedRoll(roll)}
                                        disabled={isProcessing}
                                        className={`w-full text-left p-3 rounded-md cursor-pointer transition-all ${selectedRoll?.id === roll.id ? 'bg-cyan-500 text-white shadow-lg' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-wait`} >
                                        <div className="font-bold">{roll.filmType}</div>
                                        <div className="text-sm">Supplier: {roll.supplier} | Wt: {roll.currentWeight.toFixed(2)}kg</div>
                                        <div className="text-xs text-gray-400">ID: {roll.id}</div>
                                    </button>
                                ))}
                            </div>
                        ) : <p className="text-gray-500 pt-4 ">No rolls of type '{selectedFilmType}' currently in stock.</p>}
                    </div>
                )}

                {selectedRoll && (
                    <div className="border-t border-gray-700 pt-6 space-y-4">
                        <h3 className="text-lg font-medium text-cyan-400">4. Confirm Usage</h3>
                        <div>
                            <p>Selected Job: <span className="font-bold">{selectedJob.jobName}</span></p>
                            <p>Selected Roll: <span className="font-bold">{selectedRoll.filmType}</span> from <span className="font-bold">{selectedRoll.supplier}</span></p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-cyan-400 mb-2">Date of Use</label>
                            <input
                                type="date"
                                value={dateOfUse}
                                onChange={(e) => setDateOfUse(e.target.value)}
                                className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            />
                        </div>
                        <button onClick={handleUseRoll} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-red-800 disabled:cursor-wait">
                            {isProcessing ? 'Processing...' : 'Confirm & Use Selected Roll'}
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

// --- STOCK HISTORY ---
function StockHistory({ db, userId }) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingHistoryEntry, setEditingHistoryEntry] = useState(null);
    const [entryToDelete, setEntryToDelete] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Filters state
    const [filmFilter, setFilmFilter] = useState('');
    const [jobFilter, setJobFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        if (!db || !userId) {
            setIsLoading(false);
            return;
        }

        const historyCollectionRef = query(collectionGroup(db, 'consumedRolls'), where('consumedBy', '==', userId));
        const unsubscribe = onSnapshot(historyCollectionRef, (snapshot) => {
            const combinedHistory = snapshot.docs.map(doc => ({
                id: doc.id,
                jobId: doc.ref.parent.parent.id,
                ...doc.data()
            }));

            combinedHistory.sort((a, b) => (b.consumedAt?.toDate() || 0) - (a.consumedAt?.toDate() || 0));
            setHistory(combinedHistory);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching stock history:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, userId]);

    const handleUpdateHistory = async (historyId, newDate) => {
        if (!editingHistoryEntry) return;
        const { jobId } = editingHistoryEntry;
        const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${jobId}/consumedRolls`, historyId);
        try {
            await updateDoc(historyRef, { consumedAt: new Date(newDate + 'T00:00:00Z') });
            setEditingHistoryEntry(null);
        } catch (error) {
            console.error("Error updating history entry:", error);
        }
    };

    const openDeleteModal = (entry) => {
        setEntryToDelete(entry);
        setIsDeleteModalOpen(true);
    };

    const executeDeleteHistory = async () => {
        if (!entryToDelete) return;
        const { jobId, id } = entryToDelete;
        const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${jobId}/consumedRolls`, id);
        try {
            await deleteDoc(historyRef);
            setIsDeleteModalOpen(false);
            setEntryToDelete(null);
        } catch (error) {
            console.error("Error deleting history entry:", error);
        }
    };

    const clearFilters = () => {
        setFilmFilter('');
        setJobFilter('');
        setStartDate('');
        setEndDate('');
    };

    const filteredHistory = history.filter(item => {
        const filmMatch = filmFilter ? item.filmType?.toLowerCase().includes(filmFilter.toLowerCase()) : true;
        const jobMatch = jobFilter ? item.jobName?.toLowerCase().includes(jobFilter.toLowerCase()) : true;
        
        const consumedDate = item.consumedAt?.toDate();
        if (!consumedDate) return false;

        const startDateMatch = startDate ? consumedDate >= new Date(startDate + 'T00:00:00Z') : true;
        const endDateMatch = endDate ? consumedDate <= new Date(endDate + 'T23:59:59Z') : true;

        return filmMatch && jobMatch && startDateMatch && endDateMatch;
    });

    return (
        <section>
            <h2 className="text-2xl font-semibold text-gray-200 mb-4">Stock Usage History</h2>

            {/* Filter Section */}
            <div className="bg-gray-800 p-4 rounded-lg mb-6 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <input
                        type="text"
                        value={filmFilter}
                        onChange={(e) => setFilmFilter(e.target.value)}
                        placeholder="Filter by Film Type..."
                        className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none lg:col-span-2"
                    />
                    <input
                        type="text"
                        value={jobFilter}
                        onChange={(e) => setJobFilter(e.target.value)}
                        placeholder="Filter by Job Name..."
                        className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none lg:col-span-2"
                    />
                     <div className="flex items-center space-x-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                        <span>to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                    </div>
                </div>
                 <button onClick={clearFilters} className="mt-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">Clear Filters</button>
            </div>


            {isLoading ? <p>Loading history...</p> : (
                <div className="space-y-3">
                    {filteredHistory.length > 0 ? filteredHistory.map(item => (
                        <div key={item.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-bold text-lg text-cyan-400">{item.filmType}</p>
                                <p className="text-gray-300">Used in Job: <span className="font-semibold">{item.jobName || 'N/A'}</span></p>
                                <p className="text-gray-400 text-sm">Date Used: {toDDMMYYYY(item.consumedAt)}</p>
                                <p className="text-gray-400 text-sm">Supplier: {item.supplier} | Original Wt: {item.netWeight.toFixed(2)}kg</p>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => setEditingHistoryEntry(item)} className="text-blue-400 hover:text-blue-300 p-2"><EditIcon /></button>
                                <button onClick={() => openDeleteModal(item)} className="text-red-500 hover:text-red-400 p-2"><TrashIcon /></button>
                            </div>
                        </div>
                    )) : <p className="text-center text-gray-500 py-8">No usage history found matching your filters.</p>}
                </div>
            )}
            <EditHistoryModal
                isOpen={!!editingHistoryEntry}
                onClose={() => setEditingHistoryEntry(null)}
                onSave={handleUpdateHistory}
                onDelete={executeDeleteHistory} // Pass delete function
                historyEntry={editingHistoryEntry}
            />
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={executeDeleteHistory}
                title="Delete History Entry?"
            >
                <p>Are you sure you want to delete this history entry for <strong className="text-white">{entryToDelete?.filmType}</strong>?</p>
                <p className="mt-2">This will permanently remove the record. This action cannot be undone.</p>
            </ConfirmationModal>
        </section>
    );
}


export default App;
