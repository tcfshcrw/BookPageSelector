document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const STORAGE_KEY = 'bookPageSelectorData';
    let books = [];
    let currentBookId = null;

    // --- DOM Elements ---
    const bookSelect = document.getElementById('bookSelect');
    const bookForm = document.getElementById('bookForm');
    const bookIdInput = document.getElementById('bookId');
    const bookNameInput = document.getElementById('bookName');
    const bookPagesInput = document.getElementById('bookPages');
    
    const saveBookBtn = document.getElementById('saveBookBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const deleteBookBtn = document.getElementById('deleteBookBtn');
    
    const pageDisplay = document.getElementById('pageDisplay');
    const resultLabel = document.getElementById('resultLabel');
    const pickPageBtn = document.getElementById('pickPageBtn');
    
    const exportBtn = document.getElementById('exportBtn');
    const importFile = document.getElementById('importFile');
    const toast = document.getElementById('toast');

    // --- Initialization ---
    init();

    function init() {
        loadData();
        renderSelect();
        setupEventListeners();
        registerServiceWorker();
    }

    // --- Core Functions ---
    function loadData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                books = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse stored data", e);
                books = [];
            }
        }
    }

    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    }

    function renderSelect() {
        // Clear except first option
        bookSelect.innerHTML = '<option value="" disabled selected>Select a book...</option>';
        
        books.forEach(book => {
            const option = document.createElement('option');
            option.value = book.id;
            option.textContent = `${book.name} (${book.pages} pages)`;
            bookSelect.appendChild(option);
        });

        if (currentBookId && books.find(b => b.id === currentBookId)) {
            bookSelect.value = currentBookId;
            pickPageBtn.disabled = false;
            pickPageBtn.classList.add('pulse-anim');
        } else {
            bookSelect.value = '';
            pickPageBtn.disabled = true;
            pickPageBtn.classList.remove('pulse-anim');
            resetDisplay();
        }
    }

    function resetForm() {
        bookIdInput.value = '';
        bookNameInput.value = '';
        bookPagesInput.value = '';
        saveBookBtn.textContent = 'Save Book';
        cancelEditBtn.classList.add('hidden');
        deleteBookBtn.classList.add('hidden');
    }

    function resetDisplay() {
        pageDisplay.textContent = '--';
        resultLabel.textContent = 'Ready to read?';
    }

    function showToast(message, duration = 3000) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        
        // Trigger reflow
        void toast.offsetWidth;
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 400); // match transition duration
        }, duration);
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Form Submit (Add/Edit)
        bookForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = bookIdInput.value;
            const name = bookNameInput.value.trim();
            const pages = parseInt(bookPagesInput.value, 10);

            if (!name || isNaN(pages) || pages < 1) {
                showToast("Please enter valid book details.");
                return;
            }

            if (id) {
                // Edit
                const index = books.findIndex(b => b.id === id);
                if (index !== -1) {
                    books[index] = { id, name, pages };
                    showToast("Book updated successfully!");
                }
            } else {
                // Add
                const newId = Date.now().toString();
                books.push({ id: newId, name, pages });
                currentBookId = newId; // Select the new book automatically
                showToast("Book added successfully!");
            }

            saveData();
            renderSelect();
            resetForm();
        });

        // Select Change
        bookSelect.addEventListener('change', (e) => {
            currentBookId = e.target.value;
            const selectedBook = books.find(b => b.id === currentBookId);
            
            if (selectedBook) {
                // Populate form for editing
                bookIdInput.value = selectedBook.id;
                bookNameInput.value = selectedBook.name;
                bookPagesInput.value = selectedBook.pages;
                
                saveBookBtn.textContent = 'Update Book';
                cancelEditBtn.classList.remove('hidden');
                deleteBookBtn.classList.remove('hidden');

                pickPageBtn.disabled = false;
                pickPageBtn.classList.add('pulse-anim');
                resetDisplay();
            }
        });

        // Cancel Edit
        cancelEditBtn.addEventListener('click', () => {
            resetForm();
            // Deselect in dropdown if we are cancelling edit
            bookSelect.value = '';
            currentBookId = null;
            pickPageBtn.disabled = true;
            pickPageBtn.classList.remove('pulse-anim');
            resetDisplay();
        });

        // Delete Book
        deleteBookBtn.addEventListener('click', () => {
            const id = bookIdInput.value;
            if (id && confirm("Are you sure you want to delete this book?")) {
                books = books.filter(b => b.id !== id);
                if (currentBookId === id) {
                    currentBookId = null;
                }
                saveData();
                renderSelect();
                resetForm();
                showToast("Book deleted.");
            }
        });

        // Pick Page Logic
        pickPageBtn.addEventListener('click', () => {
            if (!currentBookId) return;
            const book = books.find(b => b.id === currentBookId);
            if (!book) return;

            pickPageBtn.disabled = true;
            pickPageBtn.classList.remove('pulse-anim');
            
            // Animation effect
            pageDisplay.classList.add('animating');
            resultLabel.textContent = 'Selecting...';
            
            let counter = 0;
            const interval = setInterval(() => {
                pageDisplay.textContent = Math.floor(Math.random() * book.pages) + 1;
                counter++;
                if (counter > 15) { // 15 cycles
                    clearInterval(interval);
                    const finalPage = Math.floor(Math.random() * book.pages) + 1;
                    pageDisplay.textContent = finalPage;
                    pageDisplay.classList.remove('animating');
                    resultLabel.textContent = `Selected from: ${book.name}`;
                    pickPageBtn.disabled = false;
                    pickPageBtn.classList.add('pulse-anim');
                }
            }, 50);
        });

        // Export JSON
        exportBtn.addEventListener('click', () => {
            if (books.length === 0) {
                showToast("No data to export!");
                return;
            }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(books, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "book_page_selector_backup.json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            showToast("Export successful!");
        });

        // Import JSON
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if (Array.isArray(importedData)) {
                        books = importedData;
                        saveData();
                        currentBookId = null;
                        renderSelect();
                        resetForm();
                        showToast("Data imported successfully!");
                    } else {
                        showToast("Invalid data format!");
                    }
                } catch (err) {
                    console.error(err);
                    showToast("Failed to read JSON file!");
                }
            };
            reader.readAsText(file);
            // Reset input so the same file can be selected again
            importFile.value = '';
        });
    }

    // --- PWA Service Worker Registration ---
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed: ', error);
                    });
            });
        }
    }
});
