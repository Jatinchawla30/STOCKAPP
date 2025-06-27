import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, getDocs
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

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
  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  const year = d.getFullYear();
  const month = (`0${d.getMonth() + 1}`).slice(-2);
  const day = (`0${d.getDate()}`).slice(-2);
  return `${year}-${month}-${day}`;
};
const toDDMMYYYY = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  const day = (`0${d.getDate()}`).slice(-2);
  const month = (`0${d.getMonth() + 1}`).slice(-2);
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// --- Main App Component ---
function App() {
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [films, setFilms] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    setDb(getFirestore(app));
    const auth = getAuth(app);
    onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
  }, []);

  // Fetch films
  useEffect(() => {
    if (!db || !userId) return;
    const filmsCollection = collection(db, `artifacts/${appId}/users/${userId}/films`);
    const unsubscribe = onSnapshot(filmsCollection, (snapshot) => {
      setFilms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [db, userId]);

  // Fetch jobs (for history)
  useEffect(() => {
    if (!db || !userId) return;
    const jobsCollection = collection(db, `artifacts/${appId}/users/${userId}/jobs`);
    const unsubscribe = onSnapshot(jobsCollection, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [db, userId]);

  return (
    <div style={{ padding: 32 }}>
      <h1>Rotogravure Stock Manager</h1>
      <button onClick={() => setShowHistory(!showHistory)} style={{ marginBottom: 16 }}>
        {showHistory ? "Back to Inventory" : "Show Film History"}
      </button>
      {showHistory
        ? <FilmHistory db={db} userId={userId} jobs={jobs} />
        : <FilmInventory films={films} db={db} userId={userId} />}
    </div>
  );
}

// --- FILM INVENTORY COMPONENTS ---
function FilmInventory({ films, db, userId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingFilm, setEditingFilm] = useState(null);

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
        await addDoc(collection(db, filmsCollectionPath), {
          ...dataToSave,
          currentWeight: dataToSave.netWeight,
          createdAt: new Date()
        });
      }
      setShowForm(false);
    } catch (error) {
      console.error("Error saving film:", error);
    }
  };

  return (
    <div>
      <h2>Film Inventory</h2>
      <button onClick={() => setShowForm(true)}>Add Film</button>
      {showForm && (
        <FilmForm
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingFilm(null); }}
          initialData={editingFilm}
        />
      )}
      <FilmList
        films={films}
        onEdit={film => { setEditingFilm(film); setShowForm(true); }}
        onDelete={async (filmId) => {
          if (!db || !userId) return;
          const filmRef = doc(db, `artifacts/${appId}/users/${userId}/films`, filmId);
          await deleteDoc(filmRef);
        }}
      />
    </div>
  );
}

function FilmForm({ onSubmit, onCancel, initialData }) {
  const [formData, setFormData] = useState({
    filmType: '',
    netWeight: '',
    supplier: '',
    purchaseDate: toYYYYMMDD(new Date())
  });

  useEffect(() => {
    if (initialData) {
      const purchaseDate = initialData.purchaseDate?.toDate
        ? toYYYYMMDD(initialData.purchaseDate.toDate())
        : toYYYYMMDD(initialData.purchaseDate || new Date());
      setFormData({
        filmType: initialData.filmType || '',
        netWeight: initialData.netWeight || '',
        supplier: initialData.supplier || '',
        purchaseDate: purchaseDate,
      });
    }
  }, [initialData]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ margin: '16px 0' }}>
      <input name="filmType" placeholder="Film Type" value={formData.filmType} onChange={handleChange} required />
      <input name="netWeight" placeholder="Net Weight" value={formData.netWeight} onChange={handleChange} required type="number" />
      <input name="supplier" placeholder="Supplier" value={formData.supplier} onChange={handleChange} required />
      <input name="purchaseDate" type="date" value={formData.purchaseDate} onChange={handleChange} required />
      <button type="submit">Save</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}

function FilmList({ films, onEdit, onDelete }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Film Type</th>
          <th>Current Wt. (kg)</th>
          <th>Supplier</th>
          <th>Purchase Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {films.map(film => (
          <tr key={film.id}>
            <td>{film.filmType}</td>
            <td>{parseFloat(film.currentWeight || film.netWeight).toFixed(2)}</td>
            <td>{film.supplier}</td>
            <td>
              {film.purchaseDate
                ? toDDMMYYYY(film.purchaseDate?.toDate
                  ? film.purchaseDate.toDate()
                  : film.purchaseDate)
                : ''}
            </td>
            <td>
              <button onClick={() => onEdit(film)}>Edit</button>
              <button onClick={() => onDelete(film.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --- FILM HISTORY COMPONENT WITH EDIT/DELETE ---
function FilmHistory({ db, userId, jobs }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    if (!db || !userId || jobs.length === 0) return;
    setIsLoading(true);
    const fetchHistory = async () => {
      let allHistory = [];
      for (const job of jobs) {
        const rollsCol = collection(db, `artifacts/${appId}/users/${userId}/jobs/${job.id}/consumedRolls`);
        const snap = await getDocs(rollsCol);
        snap.forEach(docSnap => {
          allHistory.push({
            id: docSnap.id,
            jobId: job.id,
            jobName: job.name,
            ...docSnap.data()
          });
        });
      }
      setHistory(allHistory);
      setIsLoading(false);
    };
    fetchHistory();
  }, [db, userId, jobs]);

  const startEdit = (entry) => {
    setEditingEntry(entry);
    setEditDate(toYYYYMMDD(entry.consumedAt?.toDate ? entry.consumedAt.toDate() : entry.consumedAt));
  };

  const handleEditSave = async () => {
    if (!editingEntry) return;
    const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${editingEntry.jobId}/consumedRolls`, editingEntry.id);
    await updateDoc(historyRef, { consumedAt: new Date(editDate + 'T00:00:00Z') });
    setEditingEntry(null);
    setEditDate('');
    // Refresh history
    window.location.reload();
  };

  const handleDelete = async (entry) => {
    if (!window.confirm('Delete this history entry?')) return;
    const historyRef = doc(db, `artifacts/${appId}/users/${userId}/jobs/${entry.jobId}/consumedRolls`, entry.id);
    await deleteDoc(historyRef);
    // Refresh history
    window.location.reload();
  };

  if (isLoading) return <div>Loading history...</div>;

  return (
    <div>
      <h2>Film Usage History</h2>
      <table>
        <thead>
          <tr>
            <th>Film Type</th>
            <th>Job</th>
            <th>Date Used</th>
            <th>Supplier</th>
            <th>Original Wt</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 && <tr><td colSpan={6}>No usage history found.</td></tr>}
          {history.map(item => (
            <tr key={item.id}>
              <td>{item.filmType}</td>
              <td>{item.jobName || 'N/A'}</td>
              <td>
                {editingEntry && editingEntry.id === item.id ? (
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                  />
                ) : (
                  toDDMMYYYY(item.consumedAt?.toDate ? item.consumedAt.toDate() : item.consumedAt)
                )}
              </td>
              <td>{item.supplier}</td>
              <td>{item.netWeight ? parseFloat(item.netWeight).toFixed(2) : ''}kg</td>
              <td>
                {editingEntry && editingEntry.id === item.id ? (
                  <>
                    <button onClick={handleEditSave}>Save</button>
                    <button onClick={() => setEditingEntry(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(item)}>Edit</button>
                    <button onClick={() => handleDelete(item)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
