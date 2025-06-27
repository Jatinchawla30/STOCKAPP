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

// --- Helper functions to format dates correctly ---
const toYYYYMMDD = (date) => {
    if (!date) return '';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset()); // Adjust for timezone
    const year = d.getFullYear();
    const month = (`0${d.getMonth() + 1}`).slice(-2);
    const day = (`0${d.getDate()}`).slice(-2);
    return `${year}-${month}-${day}`;
};

const toDDMMYYYY = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset()); // Adjust for timezone
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
const HistoryIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" /></svg>);
const ClipboardListIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>);
const XIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ExclamationIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const LockClosedIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400 mb-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>);
const CheckCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>);

// --- Login Screen Component ---
function LoginScreen({ auth }) {
    // ... LoginScreen code remains the same
}

// --- Main App Component ---
function App() {
    // ... App component state and useEffect hooks remain the same
}

// ... All other components are defined below...

// --- MODAL AND HEADER COMPONENTS ---
// ... (ConfirmationModal, MarkCompleteModal, MessageModal, Header, Nav, NavButton remain the same) ...

// --- FILM INVENTORY COMPONENTS ---
function FilmInventory({ films, db, userId }) {
    // ... FilmInventory logic remains the same ...

    const handleFormSubmit = async (filmData) => {
        if (!db || !userId) return;
        const filmsCollectionPath = `artifacts/${appId}/users/${userId}/films`;
        
        const dataToSave = {
            ...filmData,
            purchaseDate: new Date(filmData.purchaseDate + 'T00:00:00Z'), // Correctly handle date
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
    // ...
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

    // ... handle change and submit logic remains the same
}

function FilmList({ films, onEdit, onDelete }) {
    return (
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-md">
            <table className="w-full text-left">
                {/* ... table head ... */}
                <tbody>
                    {films.map(film => (
                        <tr key={film.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                            {/* ... other tds ... */}
                            <td className="p-3">{toDDMMYYYY(film.purchaseDate?.toDate())}</td>
                            {/* ... actions ... */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ... (CategoryList remains the same)

// --- JOB MANAGEMENT COMPONENTS ---

// NEW/UPDATED COMPONENT
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

// UPDATED COMPONENT
function JobManagement({ films, jobs, orders, db, userId }) {
    const [showForm, setShowForm] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [jobSearch, setJobSearch] = useState('');
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [messageModalContent, setMessageModalContent] = useState({title: '', body: ''});

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

    // ... (rest of JobManagement component remains the same)
}

// ... (JobForm updated to handle `initialData` for editing)

// UPDATED COMPONENT
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
        const q = query(collection(db, historyCollectionPath), orderBy("consumedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
                    {/* ... Job details ... */}
                    <div className="flex items-center space-x-3">
                         <button onClick={() => onEdit(job)} className="text-blue-400 hover:text-blue-300"><EditIcon /></button>
                         {/* ... other buttons ... */}
                    </div>
                </div>
                {/* ... rest of JobCard display ... */}
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

// ... (RollDetailModal and OrderManagement components remain largely the same, but date displays should be updated) ...
// Example update for OrderCard:
function OrderCard({ order /* ...other props */ }) {
    // ...
    return (
        // ...
        <p className="text-xs text-purple-400 mt-1">Completed: {toDDMMYYYY(order.completedAt?.toDate())}</p>
        // ...
    );
}

// --- GLOBAL FILM HISTORY ---
// UPDATED COMPONENT
function FilmHistory({ db, userId, jobs }) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [historySearch, setHistorySearch] = useState('');
    const [editingHistoryEntry, setEditingHistoryEntry] = useState(null);

    useEffect(() => {
        // ... data fetching logic is the same ...
    }, [db, userId, jobs]);

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

    const handleDeleteHistory = async (historyId) => {
        if (!editingHistoryEntry) return;
        const { jobId } = editingHistoryEntry;
        const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${jobId}/consumedRolls`, historyId);
        try {
            await deleteDoc(historyRef);
            setEditingHistoryEntry(null);
        } catch (error) {
            console.error("Error deleting history entry:", error);
        }
    };

    const filteredHistory = history.filter(item => {
        // ... filtering logic is the same ...
    });

    return(
        <section>
            {/* ... search bar ... */}
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
                            <button onClick={() => setEditingHistoryEntry(item)} className="text-blue-400 hover:text-blue-300"><EditIcon /></button>
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
