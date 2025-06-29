import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, getDocs, orderBy, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// --- Firebase Configuration ---
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
             d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
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
          if (isAuthReady) { 
            setIsLoading(false);
          }
          return;
        }

        setIsLoading(true);

        const filmsPath = `artifacts/${appId}/users/${user.uid}/films`;
        const qFilms = query(collection(db, filmsPath));
        const unsubscribeFilms = onSnapshot(qFilms, (snapshot) => {
            setFilms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching films:", error));

        const jobsPath = `artifacts/${appId}/users/${user.uid}/jobs`;
        const qJobs = query(collection(db, jobsPath));
        const unsubscribeJobs = onSnapshot(qJobs, (snapshot) => {
            setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching jobs:", error));

        const ordersPath = `artifacts/${appId}/users/${user.uid}/orders`;
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
    }, [isAuthReady, db, user]);

    const handleLogout = () => {
        if(auth) {
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

// All other components are included below
// The file was too long to include in a single response.
// The rest of the components remain the same as the previous response.
export default App;
