import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, getDocs, collectionGroup, orderBy, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth';

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

// --- Helper functions to format dates correctly ---
const toYYYYMMDD = (date) => {
    if (!date || isNaN(new Date(date).getTime())) return '';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    const year = d.getFullYear();
    const month = (`0${d.getMonth() + 1}`).slice(-2);
    const day = (`0${d.getDate()}`).slice(-2);
    return `${year}-${month}-${day}`;
};

const toDDMMYYYY = (date) => {
    if (!date || isNaN(new Date(date).getTime())) return 'N/A';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    const day = (`0${d.getDate()}`).slice(-2);
    const month = (`0${d.getMonth() + 1}`).slice(-2);
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// --- Icon Components ---
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const EditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>);
const PackageIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m0 0v10l8 4m0-14L4 7m16 0L4 7" /></svg>);
const ChevronLeftIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>);
const SearchIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>);
const HistoryIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>);
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
        try {
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, email, password);
            setError('');
        } catch (err) {
            setError('Failed to log in. Please check your credentials.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <LockClosedIcon />
                </div>
                <h2 className="text-2xl font-bold text-center text-cyan-400 mb-6">Login</h2>
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full mt-1 p-2 bg-gray-700 rounded-md text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full mt-1 p-2 bg-gray-700 rounded-md text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg"
                    >
                        Log In
                    </button>
                </form>
            </div>
        </div>
    );
}

// --- Main App Component ---
function App() {
    const [userId, setUserId] = useState(null);
    const [films, setFilms] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [orders, setOrders] = useState([]);
    const [activeSection, setActiveSection] = useState('filmInventory');
    const app = useMemo(() => initializeApp(firebaseConfig), []);
    const db = useMemo(() => getFirestore(app), [app]);
    const auth = useMemo(() => getAuth(app), [app]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(null);
            }
        });
        return () => unsubscribe();
    }, [auth]);

    useEffect(() => {
        if (!userId || !db) return;

        const filmsCollectionPath = `artifacts/${appId}/users/${userId}/films`;
        const jobsCollectionPath = `artifacts/${appId}/users/${userId}/jobs`;
        const ordersCollectionPath = `artifacts/${appId}/users/${userId}/orders`;

        const unsubFilms = onSnapshot(collection(db, filmsCollectionPath), (snapshot) => {
            setFilms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubJobs = onSnapshot(query(collection(db, jobsCollectionPath), orderBy('createdAt', 'desc')), (snapshot) => {
            setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubOrders = onSnapshot(query(collection(db, ordersCollectionPath), orderBy('createdAt', 'desc')), (snapshot) => {
            setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubFilms();
            unsubJobs();
            unsubOrders();
        };
    }, [db, userId]);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    if (!userId) {
        return <LoginScreen auth={auth} />;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <Header onSignOut={handleSignOut} />
            <Nav activeSection={activeSection} setActiveSection={setActiveSection} />
            <main className="container mx-auto p-4">
                {activeSection === 'filmInventory' && <FilmInventory films={films} db={db} userId={userId} />}
                {activeSection === 'jobManagement' && <JobManagement films={films} jobs={jobs} orders={orders} db={db} userId={userId} />}
                {activeSection === 'orderManagement' && <OrderManagement orders={orders} jobs={jobs} db={db} userId={userId} />}
                {activeSection === 'filmHistory' && <FilmHistory db={db} userId={userId} jobs={jobs} />}
            </main>
        </div>
    );
}

// --- MODAL AND HEADER COMPONENTS ---
function ConfirmationModal({ isOpen, onClose, onConfirm, message }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <div className="flex justify-center mb-4"><ExclamationIcon /></div>
                <h3 className="text-xl font-bold text-center text-red-500 mb-4">Confirm Deletion</h3>
                <p className="text-center text-gray-300 mb-6">{message}</p>
                <div className="flex justify-between">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Delete</button>
                </div>
            </div>
        </div>
    );
}

function MarkCompleteModal({ isOpen, onClose, onConfirm }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">Mark as Complete</h3>
                <p className="text-gray-300 mb-6">Are you sure you want to mark this job as complete? This will update its status.</p>
                <div className="flex justify-between">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button onClick={onConfirm} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Confirm</button>
                </div>
            </div>
        </div>
    );
}

function MessageModal({ isOpen, onClose, title, body }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">{title}</h3>
                <p className="text-gray-300 mb-6">{body}</p>
                <div className="flex justify-end">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Close</button>
                </div>
            </div>
        </div>
    );
}

function Header({ onSignOut }) {
    return (
        <header className="bg-gray-800 p-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center">
                <h1 className="text-2xl font-bold text-cyan-400">Film Inventory Management</h1>
                <button onClick={handleSignOut} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Sign Out</button>
            </div>
        </header>
    );
}

function Nav({ activeSection, setActiveSection }) {
    return (
        <nav className="bg-gray-800 p-4 shadow-md">
            <div className="container mx-auto flex space-x-4">
                <NavButton section="filmInventory" activeSection={activeSection} setActiveSection={setActiveSection} icon={<PackageIcon />} label="Film Inventory" />
                <NavButton section="jobManagement" activeSection={activeSection} setActiveSection={setActiveSection} icon={<ClipboardListIcon />} label="Job Management" />
                <NavButton section="orderManagement" activeSection={activeSection} setActiveSection={setActiveSection} icon={<ClipboardListIcon />} label="Order Management" />
                <NavButton section="filmHistory" activeSection={activeSection} setActiveSection={setActiveSection} icon={<HistoryIcon />} label="Film History" />
            </div>
        </nav>
    );
}

function NavButton({ section, activeSection, setActiveSection, icon, label }) {
    return (
        <button
            onClick={() => setActiveSection(section)}
            className={`flex items-center px-4 py-2 rounded-lg ${activeSection === section ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

// --- FILM INVENTORY COMPONENTS ---
function FilmInventory({ films, db, userId }) {
    const [showForm, setShowForm] = useState(false);
    const [editingFilm, setEditingFilm] = useState(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
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

    const handleEditFilm = (film) => {
        setEditingFilm(film);
        setShowForm(true);
    };

    const handleDeleteFilm = async () => {
        if (!filmToDelete || !db) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/films`, filmToDelete.id));
            setDeleteModalOpen(false);
            setFilmToDelete(null);
        } catch (error) { console.error("Error deleting film:", error); }
    };

    return (
        <section>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-cyan-400">Film Inventory</h2>
                <button onClick={() => { setEditingFilm(null); setShowForm(true); }} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg flex items-center"><PlusIcon /><span className="ml-2">Add Film</span></button>
            </div>
            {showForm && (
                <FilmForm
                    onSubmit={handleFormSubmit}
                    onCancel={() => setShowForm(false)}
                    initialData={editingFilm}
                />
            )}
            <FilmList
                films={films}
                onEdit={handleEditFilm}
                onDelete={(film) => { setFilmToDelete(film); setDeleteModalOpen(true); }}
            />
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteFilm}
                message="Are you sure you want to delete this film? This action cannot be undone."
            />
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
                filmType: initialData.filmType || '',
                netWeight: initialData.netWeight || '',
                supplier: initialData.supplier || '',
                purchaseDate: purchaseDate,
            });
        } else {
            setFormData(defaultState);
        }
    }, [initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-6">
            <h3 className="text-xl font-bold text-cyan-400 mb-4">{initialData ? 'Edit Film' : 'Add New Film'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300">Film Type</label>
                    <input
                        type="text"
                        name="filmType"
                        value={formData.filmType}
                        onChange={handleChange}
                        className="w-full mt-1 p-2 bg-gray-700 rounded-md text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Net Weight (kg)</label>
                    <input
                        type="number"
                        name="netWeight"
                        value={formData.netWeight}
                        onChange={handleChange}
                        className="w-full mt-1 p-2 bg-gray-700 rounded-md text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        required
                        min="0"
                        step="0.01"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Supplier</label>
                    <input
                        type="text"
                        name="supplier"
                        value={formData.supplier}
                        onChange={handleChange}
                        className="w-full mt-1 p-2 bg-gray-700 rounded-md text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Purchase Date</label>
                    <input
                        type="date"
                        name="purchaseDate"
                        value={formData.purchaseDate}
                        onChange={handleChange}
                        className="w-full mt-1 p-2 bg-gray-700 rounded-md text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        required
                    />
                </div>
                <div className="flex justify-end space-x-4">
                    <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg">Save</button>
                </div>
            </form>
        </div>
    );
}

function FilmList({ films, onEdit, onDelete }) {
    return (
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-md">
            <table className="w-full text-left">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="p-3">Film Type</th>
                        <th className="p-3">Net Weight (kg)</th>
                        <th className="p-3">Current Weight (kg)</th>
                        <th className="p-3">Supplier</th>
                        <th className="p-3">Purchase Date</th>
                        <th className="p-3">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {films.map(film => (
                        <tr key={film.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                            <td className="p-3">{film.filmType}</td>
                            <td className="p-3">{film.netWeight.toFixed(2)}</td>
                            <td className="p-3">{film.currentWeight.toFixed(2)}</td>
                            <td className="p-3">{film.supplier}</td>
                            <td className="p-3">{toDDMMYYYY(film.purchaseDate?.toDate())}</td>
                            <td className="p-3">
                                <div className="flex space-x-3">
                                    <button onClick={() => onEdit(film)} className="text-blue-400 hover:text-blue-300"><EditIcon /></button>
                                    <button onClick={() => onDelete(film)} className="text-red-400 hover:text-red-300"><TrashIcon /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function CategoryList({ films }) {
    const categories = useMemo(() => {
        const grouped = films.reduce((acc, film) => {
            const type = film.filmType || 'Uncategorized';
            acc[type] = (acc[type] || 0) + film.currentWeight;
            return acc;
        }, {});
        return Object.entries(grouped).map(([type, weight]) => ({ type, weight }));
    }, [films]);

    return (
        <div className="mt-6 bg-gray-800 rounded-lg shadow-md p-4">
            <h3 className="text-xl font-bold text-cyan-400 mb-4">Film Categories</h3>
            <ul className="space-y-2">
                {categories.map(cat => (
                    <li key={cat.type} className="flex justify-between p-2 bg-gray-700 rounded-md">
                        <span>{cat.type}</span>
                        <span>{cat.weight.toFixed(2)} kg</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// --- JOB MANAGEMENT COMPONENTS ---
function EditHistoryModal({ isOpen, onClose, onSave, onDelete, historyEntry }) {
    const [consumedAt, setConsumedAt] = useState('');

    useEffect(() => {
        if (historyEntry) {
            setConsumedAt(toYYYYMMDD(historyEntry.consumedAt.toDate()));
        }
    }, [historyEntry]);

    if (!isOpen) return null;

    const handleDelete = () => {
        if (window.confirm("Are you sure you want to delete this history entry? This cannot be undone.")) {
            onDelete(historyEntry.id);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">Edit History Entry</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Film Type</label>
                        <p className="text-white bg-gray-700 p-2 rounded-md">{historyEntry.filmType}</p>
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
                    <button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Delete Entry</button>
                    <div>
                        <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg mr-2">Cancel</button>
                        <button onClick={() => onSave(historyEntry.id, consumedAt)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Update</button>
                    </div>
                </div>
            </div>
        </div>
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

    const handleDeleteJob = async () => {
        if (!jobToDelete || !db) return;
        try {
            const jobRef = doc(db, `artifacts/${appId}/users/${userId}/jobs`, jobToDelete.id);
            const consumedRollsRef = collection(db, `artifacts/${appId}/users/${userId}/jobs/${jobToDelete.id}/consumedRolls`);
            const batch = writeBatch(db);
            const consumedRolls = await getDocs(consumedRollsRef);
            consumedRolls.forEach(doc => batch.delete(doc.ref));
            batch.delete(jobRef);
            await batch.commit();
            setDeleteModalOpen(false);
            setJobToDelete(null);
        } catch (error) { console.error("Error deleting job:", error); }
    };

    const filteredJobs = jobs.filter(job =>
        job.jobName.toLowerCase().includes(jobSearch.toLowerCase()) ||
        job.orderId?.toLowerCase().includes(jobSearch.toLowerCase())
    );

    return (
        <section>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-cyan-400">Job Management</h2>
                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search jobs..."
                            value={jobSearch}
                            onChange={(e) => setJobSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3"><SearchIcon /></div>
                    </div>
                    <button onClick={() => { setEditingJob(null); setShowForm(true); }} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg flex items-center"><PlusIcon /><span className="ml-2">Add Job</span></button>
                </div>
            </div>
            {showForm && (
                <JobForm
                    films={films}
                    orders={orders}
                    onSubmit={handleJobSubmit}
                    onCancel={() => setShowForm(false)}
                    initialData={editingJob}
                    db={db}
                    userId={userId}
                />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredJobs.map(job => (
                    <JobCard
                        key={job.id}
                        job={job}
                        films={films}
                        onEdit={handleEditJob}
                        onDelete={(job) => { setJobToDelete(job); setDeleteModalOpen(true); }}
                        db={db}
                        userId={userId}
                    />
                ))}
            </div>
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteJob}
                message="Are you sure you want to delete this job and all its consumed rolls? This action cannot be undone."
            />
            <MessageModal
                isOpen={isMessageModalOpen}
                onClose={() => setIsMessageModalOpen(false)}
                title={messageModalContent.title}
                body={messageModalContent.body}
            />
        </section>
    );
}

function JobForm({ films, orders, onSubmit, onCancel, initialData, db, userId }) {
    const [formData, setFormData] = useState({
        jobName: '',
        orderId: '',
        filmId: '',
        filmWeight: '',
        completed: false,
        completedAt: ''
    });
    const [isCompleteModalOpen, setCompleteModalOpen] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                jobName: initialData.jobName || '',
                orderId: initialData.orderId || '',
                filmId: initialData.filmId || '',
                filmWeight: initialData.filmWeight || '',
                completed: initialData.completed || false,
                completedAt: initialData.completedAt ? toYYYYMMDD(initialData.completedAt.toDate()) : ''
            });
        }
    },
