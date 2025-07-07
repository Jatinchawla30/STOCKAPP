import React, { useState, useEffect, useMemo, useRef } from 'react';
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

// NEW: Reusable helper function to calculate stock status for a job.
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

        // Script loading function
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
            console.log("jsPDF script loaded.");
            loadScript(autoTableScriptId, "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js", () => {
                console.log("jsPDF AutoTable plugin loaded.");
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

// --- MODAL AND HEADER COMPONENTS ---
// ... (Modal and Header components remain unchanged)

// --- FILM INVENTORY COMPONENTS ---
function FilmInventory({ films, db, userId, isPdfReady }) {
    // ... (Component logic remains unchanged)
    
    const handleExportPDF = () => {
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
    };

    return (
        <section>
            {/* ... ConfirmationModal ... */}
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
                    <button onClick={() => { setEditingFilm(null); setShowForm(true); }} className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-transform duration-200 hover:scale-105">
                        <PlusIcon /><span className="ml-2 hidden md:inline">Add New Roll</span>
                    </button>
                </div>
            </div>
            
            {/* ... Rest of the component ... */}
        </section>
    );
}
// ... (FilmForm, CategoryList, FilmList components remain unchanged)


// --- JOB MANAGEMENT COMPONENTS ---
function JobManagement({ films, jobs, orders, db, userId, setView, isPdfReady }) {
    // ... (Component logic remains unchanged)
    
    const filteredJobs = useMemo(() => jobSearch ? jobs.filter(job => job.jobName.toLowerCase().includes(jobSearch.toLowerCase())) : jobs, [jobs, jobSearch]);
    
    const handleExportJobsPDF = () => {
        const title = "Production Jobs Report";
        const head = [['Job Name', 'Size', 'Colours', 'Print Type', 'Materials']];
        const body = filteredJobs.map(job => [
            job.jobName, job.jobSize, job.numberOfColors, 
            job.printType ? (job.printType.charAt(0).toUpperCase() + job.printType.slice(1)) : '', 
            job.materials ? job.materials.join(', ') : ''
        ]);
        const fileName = `job-management-report-${toYYYYMMDD(new Date())}.pdf`;
        exportToPDF(title, head, body, fileName);
    };

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
                    {/* ... Add New Job button ... */}
                </div>
            </div>
            {/* ... Rest of the component ... */}
        </section>
    );
}
// ... (JobForm, JobList, JobCard components remain unchanged)


// --- ORDER MANAGEMENT COMPONENTS ---
function OrderManagement({ films, jobs, orders, db, userId, isPdfReady }) {
    const [showForm, setShowForm] = useState(false);
    const [viewType, setViewType] = useState('active');
    const [completedSearch, setCompletedSearch] = useState('');
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [orderToComplete, setOrderToComplete] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);

    // ... (Component logic like handleOrderSubmit, etc. remains unchanged)
    
    const activeOrders = useMemo(() => orders.filter(o => o.status === 'active'), [orders]);
    const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed' && o.orderName.toLowerCase().includes(completedSearch.toLowerCase())), [orders, completedSearch]);

    // NEW: Overhauled PDF export for detailed reports.
    const handleExportOrdersPDF = () => {
        const currentOrders = viewType === 'active' ? activeOrders : completedOrders;
        const title = `${viewType.charAt(0).toUpperCase() + viewType.slice(1)} Orders Report`;
        const fileName = `orders-${viewType}-report-${toYYYYMMDD(new Date())}.pdf`;

        const doc = new window.jspdf.jsPDF();
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(10);
        doc.text(`Report generated on: ${new Date().toLocaleDateString()}`, 14, 30);

        let yPos = 40; 

        currentOrders.forEach((order, index) => {
            if (yPos > 220 && index > 0) {
                doc.addPage();
                yPos = 20;
            }

            const job = jobs.find(j => j.id === order.jobId);
            const stockStatus = calculateStockStatus(job, films);

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`Order: ${order.orderName || 'N/A'}`, 14, yPos);
            yPos += 8;

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');

            // Two-column layout for details
            const detailsCol1 = [
                `Weight to be Made: ${order.weightMade || '0'} kg`,
                `Meters to be Made: ${order.metersMade || '0'} m`,
                `Status: ${order.status || 'N/A'}`
            ];
            const detailsCol2 = [
                `Associated Job: ${job?.jobName || 'N/A'}`,
                `Job Size: ${job?.jobSize || 'N/A'}`,
                `Colours: ${job?.numberOfColors || 'N/A'}`,
                `Print Type: ${job?.printType ? (job.printType.charAt(0).toUpperCase() + job.printType.slice(1)) : 'N/A'}`
            ];

            doc.text(detailsCol1, 14, yPos);
            doc.text(detailsCol2, 105, yPos);
            yPos += (detailsCol1.length * 5) + 5;

            if (stockStatus.details.length > 0) {
                const head = [['Material', 'Stock Status', 'Available Rolls', 'Total Weight (kg)']];
                const body = stockStatus.details.map(detail => [
                    detail.name,
                    detail.inStock ? 'In Stock' : 'Out of Stock',
                    detail.rollCount,
                    detail.totalWeight.toFixed(2)
                ]);

                doc.autoTable({
                    startY: yPos,
                    head: head, body: body,
                    theme: 'striped',
                    headStyles: { fillColor: [60, 60, 60] }
                });
                
                yPos = doc.autoTable.previous.finalY + 10;
            } else {
                 doc.text('No materials specified for this job.', 14, yPos);
                 yPos += 10;
            }

            if (index < currentOrders.length - 1) {
                doc.setDrawColor(80, 80, 80);
                doc.line(14, yPos, 196, yPos);
                yPos += 10;
            }
        });

        doc.save(fileName);
    };

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
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={handleExportOrdersPDF} 
                        disabled={!isPdfReady}
                        className={`flex items-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:scale-105 ${!isPdfReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={!isPdfReady ? "PDF exporter is loading..." : "Export orders to PDF"}
                    >
                        <DownloadIcon /><span className="ml-2 hidden md:inline">Export PDF</span>
                    </button>
                    <button onClick={() => setShowForm(true)} className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-transform duration-200 hover:scale-105 w-full md:w-auto">
                        <PlusIcon /><span className="ml-2 hidden md:inline">Add New Order</span>
                    </button>
                </div>
            </div>
            {/* ... Rest of the component ... */}
            {viewType === 'active' ? (
                <OrderList orders={activeOrders} jobs={jobs} films={films} onDelete={openDeleteModal} onComplete={handleOpenCompleteModal} db={db} userId={userId} />
            ) : (
                // ... Completed orders list ...
            )}
        </section>
    );
}
// ... (OrderForm remains unchanged)

function OrderList({ orders, jobs, films, onDelete, onComplete, db, userId }) {
    if (orders.length === 0) return <p className="text-center text-gray-500 py-8">No orders found.</p>;
    return <div className="space-y-4">{orders.map(order => <OrderCard key={order.id} order={order} jobs={jobs} films={films} onDelete={onDelete} onComplete={onComplete} db={db} userId={userId}/>)}</div>;
}

function OrderCard({ order, jobs, films, onDelete, onComplete, db, userId }) {
    const job = useMemo(() => jobs.find(j => j.id === order.jobId), [jobs, order.jobId]);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    
    // NEW: Use the reusable helper function here as well
    const stockStatus = useMemo(() => calculateStockStatus(job, films), [job, films]);

    // ... (Rest of OrderCard remains the same)
}

// ... (UseStock, FilmHistory, and AdvancedEditHistoryModal components also need to be passed the isPdfReady prop and use it to disable their respective buttons, similar to FilmInventory and JobManagement)
// The rest of the file (UseStock, FilmHistory, AdvancedEditHistoryModal) is unchanged from the previous version, but for completeness, ensure you pass isPdfReady to FilmHistory and disable its export button accordingly.
