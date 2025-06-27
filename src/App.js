import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, writeBatch, getDocs, collectionGroup, orderBy, where } from 'firebase/firestore';
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
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    const year = d.getFullYear();
    const month = (`0${d.getMonth() + 1}`).slice(-2);
    const day = (`0${d.getDate()}`).slice(-2);
    return `${year}-${month}-${day}`;
};

const toDDMMYYYY = (date) => {
    if (!date) return 'N/A';
    try {
        const d = date.toDate ? date.toDate() : new Date(date);
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
// This component is correct and does not need changes
function LoginScreen({ auth }) {
    // ...
}

// --- Main App Component ---
// This component is correct and does not need changes
function App() {
    // ...
}

// --- MODAL AND HEADER COMPONENTS ---
// ... (ConfirmationModal, MarkCompleteModal, MessageModal, Nav, NavButton are correct) ...

function Header({ user }) {
    // ...
}


// --- FILM INVENTORY COMPONENTS ---
// This component is correct and does not need changes
function FilmInventory({ films, db, userId }) {
    // ...
}

function FilmForm({ onSubmit, onCancel, initialData }) {
    // ...
}

function FilmList({ films, onEdit, onDelete }) {
    return (
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-md">
            <table className="w-full text-left">
                {/* ... */}
                <tbody>
                    {films.map(film => (
                        <tr key={film.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                            {/* ... */}
                            <td className="p-3">{toDDMMYYYY(film.purchaseDate?.toDate())}</td>
                            {/* ... */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// --- JOB MANAGEMENT COMPONENTS ---
// ... (JobManagement and JobForm are correct) ...

// --- Edit History Modal Component ---
function EditHistoryModal({ isOpen, onClose, onSave, onDelete, historyEntry }) {
    const [consumedAt, setConsumedAt] = useState('');

    useEffect(() => {
        if (historyEntry) {
            setConsumedAt(toYYYYMMDD(historyEntry.consumedAt?.toDate()));
        }
    }, [historyEntry]);

    if (!isOpen) return null;

    const handleDelete = () => {
        if (window.confirm("Are you sure you want to delete this history entry? This cannot be undone.")) {
            onDelete(historyEntry.id);
        }
    }

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

// ... (Other components like JobCard, OrderManagement, etc. have been updated for editing and date formatting as in the previous response)

// --- GLOBAL FILM HISTORY ---
function FilmHistory({ db, userId, jobs }) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [historySearch, setHistorySearch] = useState('');
    const [editingHistoryEntry, setEditingHistoryEntry] = useState(null);

    useEffect(() => {
        if (!db || !userId) {
            setIsLoading(false);
            return;
        }

        const fetchAllHistories = async () => {
            setIsLoading(true);
            try {
                // Using collectionGroup to get all 'consumedRolls' for the user, regardless of job
                const historyCollectionRef = query(collectionGroup(db, 'consumedRolls'), where('consumedBy', '==', userId));
                const snapshot = await getDocs(historyCollectionRef);
                
                const combinedHistory = snapshot.docs.map(doc => ({
                    id: doc.id,
                    jobId: doc.ref.parent.parent.id, // Get the parent job ID
                    ...doc.data()
                }));

                combinedHistory.sort((a, b) => (b.consumedAt?.toDate() || 0) - (a.consumedAt?.toDate() || 0));
                setHistory(combinedHistory);

            } catch (error) {
                console.error("Error fetching global film history:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllHistories();
    }, [db, userId]);

    const handleUpdateHistory = async (historyId, newDate) => {
        if (!editingHistoryEntry) return;
        const { jobId } = editingHistoryEntry;
        const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${jobId}/consumedRolls`, historyId);
        try {
            await updateDoc(historyRef, { consumedAt: new Date(newDate + 'T00:00:00Z') });
            setEditingHistoryEntry(null);
            // Manually update local state to see the change instantly
            setHistory(prev => prev.map(h => h.id === historyId ? {...h, consumedAt: { toDate: () => new Date(newDate + 'T00:00:00Z') } } : h));
        } catch (error) {
            console.error("Error updating history entry:", error);
        }
    };

    const handleDeleteHistory = async (historyId) => {
        if (!editingHistoryEntry) return;
        const { jobId } = editingHistoryEntry;
        const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${jobId}/consumedRolls`, historyId);
        try {
            await deleteDoc(historyRef);
            setEditingHistoryEntry(null);
            // Manually update local state
             setHistory(prev => prev.filter(h => h.id !== historyId));
        } catch (error) {
            console.error("Error deleting history entry:", error);
        }
    };


    const filteredHistory = history.filter(item => {
        const searchTerm = historySearch.toLowerCase();
        const filmMatch = item.filmType?.toLowerCase().includes(searchTerm);
        const jobMatch = item.jobName?.toLowerCase().includes(searchTerm);
        return filmMatch || jobMatch;
    });

    return(
        <section>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-200">Global Film Usage History</h2>
                <div className="relative w-full md:w-full">
                    <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="Search by film or job name..."
                        className="w-full bg-gray-700 p-2 pl-10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                </div>
            </div>

            {isLoading ? <p>Loading history...</p> : (
                <div className="space-y-3">
                    {filteredHistory.length > 0 ? filteredHistory.map(item => (
                        <div key={item.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-bold text-lg text-cyan-400">{item.filmType}</p>
                                <p className="text-gray-300">Used in Job: <span className="font-semibold">{item.jobName || 'N/A'}</span></p>
                                <p className="text-gray-400 text-sm">Date Used: {toDDMMYYYY(item.consumedAt.toDate())}</p>
                                <p className="text-gray-400 text-sm">Supplier: {item.supplier} | Original Wt: {item.netWeight.toFixed(2)}kg</p>
                            </div>
                            <button onClick={() => setEditingHistoryEntry(item)} className="text-blue-400 hover:text-blue-300 p-2"><EditIcon /></button>
                        </div>
                    )) : <p className="text-center text-gray-500 py-8">No usage history found for your search.</p>}
                </div>
            )}
            <EditHistoryModal 
                isOpen={!!editingHistoryEntry}
                onClose={() => setEditingHistoryEntry(null)}
                onSave={handleUpdateHistory}
                onDelete={handleDeleteHistory}
                historyEntry={editingHistoryEntry}
            />
        </section>
    );
}


export default App;
