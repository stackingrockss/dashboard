import { showSnack } from './utils.js';

document.addEventListener('DOMContentLoaded', function() {
    const workTab = document.querySelector('.tab-button[data-tab="work"]');
    if (workTab) {
        // If the work tab is active on page load, fetch entries.
        if (workTab.classList.contains('active')) {
            window.fetchWorkEntries();
        }
        // Also fetch entries when the tab is clicked.
        workTab.addEventListener('click', window.fetchWorkEntries);
    }

    // Modal setup
    const addModal = document.getElementById('addWorkModal');
    const editModal = document.getElementById('editWorkModal');
    const addBtn = document.getElementById('add-opportunity-btn');

    const setupModal = (modal, openBtn) => {
        const closeBtn = modal.querySelector('.close');
        const form = modal.querySelector('form');

        if (openBtn) {
            openBtn.addEventListener('click', () => modal.style.display = 'flex');
        }
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        if (form) {
            if (modal.id === 'addWorkModal') {
                form.addEventListener('submit', submitAddWorkEntry);
            } else if (modal.id === 'editWorkModal') {
                form.addEventListener('submit', submitEditWorkEntry);
                const cancelBtn = modal.querySelector('.cancel');
                if(cancelBtn) {
                    cancelBtn.addEventListener('click', () => modal.style.display = 'none');
                }
            }
        }
    };

    if (addModal && addBtn) {
        setupModal(addModal, addBtn);
    }
    if (editModal) {
        setupModal(editModal);
    }

    // Set up event listeners for editable kanban titles
    setupColumnTitleListeners();

    // --- Target Accounts Tab Logic ---
    const targetAccountsTabBtn = document.querySelector('.work-sub-tab-button[data-work-sub-tab="target-accounts"]');
    const targetAccountsTab = document.getElementById('work-target-accounts-tab');
    const kanbanTargetAccountsBoard = document.getElementById('kanban-target-accounts-board');
    const addTargetAccountBtn = document.getElementById('add-target-account-btn');
    const addTargetAccountModal = document.getElementById('addTargetAccountModal');
    const editTargetAccountModal = document.getElementById('editTargetAccountModal');

    // Tab switching logic
    if (targetAccountsTabBtn) {
        targetAccountsTabBtn.addEventListener('click', () => {
            // Hide all sub-tabs
            document.querySelectorAll('.work-sub-tab-content').forEach(tab => tab.style.display = 'none');
            // Remove active from all sub-tab buttons
            document.querySelectorAll('.work-sub-tab-button').forEach(btn => btn.classList.remove('active'));
            // Show target accounts tab
            targetAccountsTab.style.display = 'block';
            targetAccountsTabBtn.classList.add('active');
            // Load target accounts Kanban
            fetchTargetAccounts();
        });
    }

    // Modal setup for Target Accounts
    function setupTargetAccountModal(modal, openBtn, isEdit = false) {
        const closeBtn = modal.querySelector('.close');
        const form = modal.querySelector('form');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                modal.style.display = 'flex';
                if (!isEdit) form.reset();
            });
        }
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        if (form) {
            if (!isEdit) {
                form.addEventListener('submit', submitAddTargetAccount);
            } else {
                form.addEventListener('submit', submitEditTargetAccount);
                const cancelBtn = modal.querySelector('.cancel');
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => modal.style.display = 'none');
                }
            }
        }
    }
    if (addTargetAccountModal && addTargetAccountBtn) {
        setupTargetAccountModal(addTargetAccountModal, addTargetAccountBtn, false);
    }
    if (editTargetAccountModal) {
        setupTargetAccountModal(editTargetAccountModal, null, true);
    }

    // --- Kanban for Target Accounts ---
    window.fetchTargetAccounts = async function() {
        try {
            // Get statuses (columns)
            const response = await fetch('/work/api/target-accounts/statuses');
            let statuses = ['Prospecting', 'Contacted', 'Qualified', 'Closed'];
            if (response.ok) {
                const data = await response.json();
                if (data.statuses && data.statuses.length > 0) {
                    statuses = data.statuses;
                }
            }
            createTargetAccountKanbanColumns(statuses);
            // Fetch accounts
            const accountsRes = await fetch('/work/api/target-accounts');
            if (!accountsRes.ok) throw new Error('Failed to fetch target accounts');
            const accounts = await accountsRes.json();
            renderTargetAccountKanban(accounts, statuses);
        } catch (error) {
            console.error('Error fetching target accounts:', error);
        }
    }

    function createTargetAccountKanbanColumns(statuses) {
        if (!kanbanTargetAccountsBoard) return;
        kanbanTargetAccountsBoard.innerHTML = '';
        statuses.forEach(status => {
            const column = document.createElement('div');
            column.className = 'kanban-column';
            column.dataset.status = status;
            column.innerHTML = `
                <h4>${status}</h4>
                <div class="kanban-cards" id="target-accounts-${status.replace(/\s+/g, '-')}"></div>
            `;
            kanbanTargetAccountsBoard.appendChild(column);
        });
    }

    function renderTargetAccountKanban(accounts, statuses) {
        // Clear all cards
        statuses.forEach(status => {
            const col = document.getElementById(`target-accounts-${status.replace(/\s+/g, '-')}`);
            if (col) col.innerHTML = '';
        });
        // Place accounts in columns
        accounts.forEach(account => {
            const col = document.getElementById(`target-accounts-${account.status.replace(/\s+/g, '-')}`);
            if (col) {
                col.appendChild(createTargetAccountCard(account));
            }
        });
        // Set up drag and drop for Target Accounts
        setupTargetAccountsDragAndDrop();
    }

    function createTargetAccountCard(account) {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.dataset.id = account.id;
        card.draggable = true;
        card.innerHTML = `
            <div class="card-header">
                <strong>${account.account_name}</strong>
                <div class="card-actions">
                    <button class="edit-btn" title="Edit">✏️</button>
                    <button class="delete-btn" title="Delete">✕</button>
                </div>
            </div>
            <div class="card-content">
                <div><strong>Description:</strong> ${account.description || ''}</div>
                <div><strong>Notes:</strong> ${account.notes || ''}</div>
                <div><strong>ARR:</strong> ${account.arr ? `$${account.arr}` : 'N/A'}</div>
            </div>
        `;
        // Edit
        card.querySelector('.edit-btn').addEventListener('click', () => openEditTargetAccountModal(account));
        // Delete
        card.querySelector('.delete-btn').addEventListener('click', () => deleteTargetAccount(account.id));
        // Drag events
        card.addEventListener('dragstart', handleTargetAccountDragStart);
        card.addEventListener('dragend', handleTargetAccountDragEnd);
        return card;
    }

    function setupTargetAccountsDragAndDrop() {
        // Cards
        document.querySelectorAll('#kanban-target-accounts-board .kanban-card').forEach(card => {
            card.addEventListener('dragstart', handleTargetAccountDragStart);
            card.addEventListener('dragend', handleTargetAccountDragEnd);
        });
        // Columns
        document.querySelectorAll('#kanban-target-accounts-board .kanban-cards').forEach(col => {
            col.addEventListener('dragover', handleTargetAccountDragOver);
            col.addEventListener('drop', handleTargetAccountDrop);
        });
    }

    let draggedTargetAccountId = null;
    function handleTargetAccountDragStart(e) {
        draggedTargetAccountId = e.target.dataset.id;
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('dragging');
    }
    function handleTargetAccountDragEnd(e) {
        draggedTargetAccountId = null;
        e.target.classList.remove('dragging');
    }
    function handleTargetAccountDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
    async function handleTargetAccountDrop(e) {
        e.preventDefault();
        const col = e.currentTarget;
        const newStatus = col.parentElement.dataset.status;
        if (!draggedTargetAccountId || !newStatus) return;
        try {
            const response = await fetch(`/work/api/target-accounts/${draggedTargetAccountId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (!response.ok) throw new Error('Failed to update account status');
            fetchTargetAccounts();
        } catch (error) {
            showSnack(error.message);
        }
    }

    function openEditTargetAccountModal(account) {
        const modal = document.getElementById('editTargetAccountModal');
        if (!modal) return;
        document.getElementById('edit-target-account-id').value = account.id;
        document.getElementById('edit-target-account-name').value = account.account_name;
        document.getElementById('edit-target-account-description').value = account.description || '';
        document.getElementById('edit-target-account-status').value = account.status;
        document.getElementById('edit-target-account-notes').value = account.notes || '';
        document.getElementById('edit-target-account-arr').value = account.arr || '';
        modal.style.display = 'flex';
    }

    async function submitAddTargetAccount(event) {
        event.preventDefault();
        const form = event.target;
        const data = {
            account_name: form.account_name.value,
            description: form.description.value,
            status: form.status.value,
            notes: form.notes.value,
            arr: form.arr.value
        };
        try {
            const response = await fetch('/work/api/target-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to add account');
            showSnack('Target account added!');
            form.closest('.modal').style.display = 'none';
            fetchTargetAccounts();
        } catch (error) {
            showSnack(error.message);
        }
    }

    async function submitEditTargetAccount(event) {
        event.preventDefault();
        const form = event.target;
        const id = form.id.value;
        const data = {
            account_name: form.account_name.value,
            description: form.description.value,
            status: form.status.value,
            notes: form.notes.value,
            arr: form.arr.value
        };
        try {
            const response = await fetch(`/work/api/target-accounts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to update account');
            showSnack('Target account updated!');
            form.closest('.modal').style.display = 'none';
            fetchTargetAccounts();
        } catch (error) {
            showSnack(error.message);
        }
    }

    async function deleteTargetAccount(id) {
        if (!confirm('Delete this target account?')) return;
        try {
            const response = await fetch(`/work/api/target-accounts/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete account');
            showSnack('Target account deleted!');
            fetchTargetAccounts();
        } catch (error) {
            showSnack(error.message);
        }
    }

    // --- Work Dashboard Tab Logic ---
    const dashboardTabBtn = document.querySelector('.work-sub-tab-button[data-work-sub-tab="dashboard"]');
    const dashboardTab = document.getElementById('work-dashboard-tab');
    const dashboardContent = document.getElementById('work-dashboard');

    if (dashboardTabBtn) {
        dashboardTabBtn.addEventListener('click', () => {
            // Hide all sub-tabs
            document.querySelectorAll('.work-sub-tab-content').forEach(tab => tab.style.display = 'none');
            // Remove active from all sub-tab buttons
            document.querySelectorAll('.work-sub-tab-button').forEach(btn => btn.classList.remove('active'));
            // Show dashboard tab
            dashboardTab.style.display = 'block';
            dashboardTabBtn.classList.add('active');
            // Load dashboard content
            loadWorkDashboard();
        });
    }

    async function loadWorkDashboard() {
        if (!dashboardContent) return;
        dashboardContent.innerHTML = '<div class="dashboard-spinner"></div>';
        try {
            // Fetch all dashboard data in parallel
            const [overviewRes, nextStepsRes, cbcRes] = await Promise.all([
                fetch('/work/api/dashboard/opportunity-overview'),
                fetch('/work/api/dashboard/next-steps-week'),
                fetch('/work/api/dashboard/cbc-week')
            ]);
            const overview = overviewRes.ok ? await overviewRes.json() : null;
            const nextSteps = nextStepsRes.ok ? await nextStepsRes.json() : [];
            const cbc = cbcRes.ok ? await cbcRes.json() : [];
            // Render
            dashboardContent.innerHTML = `
                <div class="dashboard-section">
                    <h4>📊 Opportunity Overview</h4>
                    <div class="dashboard-overview-cards">
                        <div class="dashboard-card"><strong>Opportunities <span title='Total number of opportunities'>📈</span></strong><br>${overview ? overview.total_opportunities : '-'}</div>
                        <div class="dashboard-card"><strong>Total ARR <span title='Annual Recurring Revenue'>💰</span></strong><br>$${overview ? Number(overview.total_arr).toLocaleString() : '-'}</div>
                        <div class="dashboard-card"><strong>By Status <span title='Breakdown by status'>🗂️</span></strong><br>${overview ? Object.entries(overview.status_breakdown).map(([status, count]) => `<span class='status-badge ${status.replace(/\s+/g, '')}' title='${status}'>${status}</span>: ${count}`).join('<br>') : '-'}</div>
                    </div>
                </div>
                <div class="dashboard-section">
                    <h4>🗓️ Opportunities with Next Steps in the Next Week</h4>
                    ${renderOpportunitiesTable(nextSteps, 'next_step_date', 'Next Step Date', 'next_steps')}
                </div>
                <div class="dashboard-section">
                    <h4>📅 Opportunities with CBC in the Next Week</h4>
                    ${renderOpportunitiesTable(cbc, 'cbc', 'CBC Date')}
                </div>
            `;
        } catch (error) {
            dashboardContent.innerHTML = '<div>Error loading dashboard.</div>';
        }
    }

    function renderOpportunitiesTable(opps, dateField, dateLabel, extraField) {
        if (!opps || !Array.isArray(opps) || opps.length === 0) {
            return '<div>No opportunities found.</div>';
        }
        let header = `<tr><th>🔖 Name</th><th>🏷️ Status</th><th>💵 ARR</th><th>🕒 ${dateLabel}</th>`;
        if (extraField) header += `<th>📝 Next Steps</th>`;
        header += '</tr>';
        let today = new Date();
        let rows = opps.map(o => {
            // Status badge with tooltip
            let statusBadge = `<span class='status-badge ${o.status.replace(/\s+/g, '')}' title='${o.status}'>${o.status}</span>`;
            // Urgency highlight
            let urgent = false;
            if (o[dateField]) {
                let dateVal = new Date(o[dateField]);
                let diff = (dateVal - today) / (1000 * 60 * 60 * 24);
                if (diff <= 2 && diff >= 0) urgent = true;
            }
            let row = `<tr class='${urgent ? 'urgent' : ''}' style='cursor:pointer' title='Click to edit'>`;
            row += `<td>${o.opportunity_name}</td>`;
            row += `<td>${statusBadge}</td>`;
            row += `<td>${o.arr ? '$' + Number(o.arr).toLocaleString() : 'N/A'}</td>`;
            row += `<td>${o[dateField] || ''}</td>`;
            if (extraField) row += `<td>${o[extraField] || ''}</td>`;
            row += '</tr>';
            return {row, id: o.id};
        });
        // Table with clickable rows
        let tableId = 'dashboard-table-' + Math.random().toString(36).substr(2, 5);
        setTimeout(() => {
            let table = document.getElementById(tableId);
            if (table) {
                Array.from(table.querySelectorAll('tr')).forEach((tr, idx) => {
                    if (idx === 0) return; // skip header
                    let opp = rows[idx-1];
                    tr.addEventListener('click', () => {
                        if (opp && opp.id) editWorkEntry(opp.id);
                    });
                });
            }
        }, 0);
        return `<table class="dashboard-table" id="${tableId}">${header}${rows.map(r => r.row).join('')}</table>`;
    }
});

function setupColumnTitleListeners() {
    document.querySelectorAll('.kanban-column h4').forEach(title => {
        const originalTitle = title.textContent;
        title.dataset.originalTitle = originalTitle;

        // Click to edit
        title.addEventListener('click', (e) => {
            if (!title.classList.contains('saving')) {
                title.focus();
                // Select all text for easy editing
                const range = document.createRange();
                range.selectNodeContents(title);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });

        title.addEventListener('blur', (e) => {
            const newTitle = e.target.textContent.trim();
            const oldTitle = e.target.dataset.originalTitle;

            if (newTitle && newTitle !== oldTitle) {
                updateColumnTitle(oldTitle, newTitle, e.target);
            } else if (!newTitle) {
                // If empty, revert to original title
                e.target.textContent = oldTitle;
            }
        });

        title.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.target.textContent = e.target.dataset.originalTitle;
                e.target.blur();
            }
        });

        // Prevent paste of HTML content
        title.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    });
}

// Make fetchWorkEntries globally accessible
window.fetchWorkEntries = async function() {
    try {
        // First, load column titles
        await loadColumnTitles();
        
        // Then fetch work entries
        const response = await fetch('/work/api/entries');
        if (!response.ok) {
            throw new Error('Failed to fetch work entries');
        }
        const entries = await response.json();
        renderKanbanBoard(entries);
    } catch (error) {
        console.error('Error fetching work entries:', error);
        // We won't use a snackbar here as it might be annoying on page load.
    }
}

async function loadColumnTitles() {
    try {
        const response = await fetch('/work/api/column-titles');
        if (!response.ok) {
            throw new Error('Failed to fetch column titles');
        }
        const data = await response.json();
        createKanbanColumns(data.column_titles);
    } catch (error) {
        console.error('Error loading column titles:', error);
        // Fallback to default columns
        createKanbanColumns(['Q2', 'Q3', 'Q4', 'Q5', 'Strategic Opps']);
    }
}

function createKanbanColumns(columnTitles) {
    const kanbanBoard = document.getElementById('kanban-board');
    if (!kanbanBoard) return;
    
    // Clear existing columns
    kanbanBoard.innerHTML = '';
    
    // Create columns for each title
    columnTitles.forEach(title => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.status = title;
        
        const columnId = getColumnId(title);
        
        column.innerHTML = `
            <h4 contenteditable="true">${title}</h4>
            <div class="kanban-cards" id="${columnId}"></div>
        `;
        
        kanbanBoard.appendChild(column);
    });
    
    // Set up event listeners for the new column titles
    setupColumnTitleListeners();
    
    // Update the status dropdown in the add modal
    updateStatusDropdown(columnTitles);
}

function updateStatusDropdown(columnTitles) {
    const statusSelect = document.getElementById('work-status');
    if (!statusSelect) return;
    
    // Clear existing options
    statusSelect.innerHTML = '';
    
    // Add new options
    columnTitles.forEach(title => {
        const option = document.createElement('option');
        option.value = title;
        option.textContent = title;
        statusSelect.appendChild(option);
    });
}

function renderKanbanBoard(entries) {
    // Clear all existing cards
    document.querySelectorAll('.kanban-cards').forEach(column => {
        column.innerHTML = '';
    });

    // Group entries by status
    const entriesByStatus = {};
    
    // Initialize with existing columns
    document.querySelectorAll('.kanban-column').forEach(column => {
        const status = column.dataset.status;
        entriesByStatus[status] = [];
    });

    entries.forEach(entry => {
        if (entriesByStatus[entry.status]) {
            entriesByStatus[entry.status].push(entry);
        }
    });

    // Render cards in each column
    Object.keys(entriesByStatus).forEach(status => {
        const columnId = getColumnId(status);
        const column = document.getElementById(columnId);
        if (!column) return;

        entriesByStatus[status].forEach(entry => {
            const card = createKanbanCard(entry);
            column.appendChild(card);
        });
    });

    // Set up drag and drop
    setupDragAndDrop();
}

function getColumnId(status) {
    // Convert status to a safe ID format
    const safeId = status.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${safeId}-cards`;
}

function createKanbanCard(entry) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.id = entry.id;
    card.dataset.status = entry.status;
    card.dataset.arr = entry.arr || '';
    card.dataset.cbc = entry.cbc || '';
    card.dataset.nextStepDate = entry.next_step_date || '';
    card.dataset.risks = entry.risks || '';

    // Color coding based on ARR
    let arr = Number(entry.arr) || 0;
    let borderColor = '#ccc'; // default gray
    if (arr >= 1000000) {
        borderColor = '#2ecc40'; // green
    } else if (arr >= 350000) {
        borderColor = '#ff9800'; // orange
    } else if (arr >= 100000) {
        borderColor = '#2196f3'; // blue
    }
    card.style.borderLeft = `8px solid ${borderColor}`;

    // Format next_step_date
    let nextStepDateStr = entry.next_step_date ? new Date(entry.next_step_date).toLocaleDateString() : 'N/A';
    let risksStr = entry.risks ? entry.risks : 'None';

    card.innerHTML = `
        <div class="card-header">
            <strong>${entry.opportunity_name}</strong>
            <div class="card-actions">
                <button class="edit-btn" onclick="editWorkEntry(${entry.id})" title="Edit">✏️</button>
                <button class="delete-btn" onclick="deleteWorkEntry(${entry.id})" title="Delete">✕</button>
            </div>
        </div>
        <div class="card-content">
            <div class="next-steps">
                <strong>Next Steps:</strong>
                <div class="next-steps-text">${entry.next_steps || 'No next steps defined'}</div>
            </div>
            <div class="action-items">
                <strong>Action Items:</strong>
                <div class="action-items-text">${entry.action_items || 'No action items defined'}</div>
            </div>
            <div class="card-footer">
                <div class="arr-info">
                    <strong>ARR:</strong>
                    <span>${entry.arr ? `$${entry.arr.toLocaleString()}` : 'N/A'}</span>
                </div>
                <div class="cbc-info">
                    <strong>CBC:</strong>
                    <span>${entry.cbc || 'N/A'}</span>
                </div>
                <div class="next-step-date-info">
                    <strong>Next Step Date:</strong>
                    <span>${nextStepDateStr}</span>
                </div>
                <div class="risks-info">
                    <strong>Risks:</strong>
                    <span>${risksStr}</span>
                </div>
            </div>
        </div>
    `;

    return card;
}

function setupDragAndDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-cards');

    cards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });

    columns.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    const card = document.querySelector(`[data-id="${cardId}"]`);
    const newStatus = e.target.closest('.kanban-column').dataset.status;

    if (card && card.dataset.status !== newStatus) {
        updateWorkEntryStatus(cardId, newStatus);
        card.dataset.status = newStatus;
        e.target.closest('.kanban-cards').appendChild(card);
    }
}

async function deleteWorkEntry(id) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
        const response = await fetch(`/work/delete/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete work entry');
        }
        showSnack('Work entry deleted successfully!');
        fetchWorkEntries();
    } catch (error) {
        console.error('Error deleting work entry:', error);
        showSnack(error.message);
    }
}

async function updateWorkEntryStatus(id, newStatus) {
    try {
        const response = await fetch(`/work/edit/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update status');
        }
        showSnack('Work entry updated successfully!');
    } catch (error) {
        console.error('Error updating status:', error);
        showSnack(error.message);
    }
}

async function editWorkEntry(id) {
    try {
        const card = document.querySelector(`.kanban-card[data-id="${id}"]`);
        if(!card) {
            showSnack("Could not find the card to edit.");
            return;
        }

        const opportunityName = card.querySelector("strong").textContent;
        const nextSteps = card.querySelector(".next-steps-text").textContent;
        const actionItems = card.querySelector(".action-items-text").textContent;
        const arr = card.dataset.arr;
        const cbc = card.dataset.cbc;
        const nextStepDate = card.dataset.nextStepDate || '';
        const risks = card.dataset.risks || '';

        document.getElementById('edit-work-id').value = id;
        document.getElementById('edit-opportunity-name').value = opportunityName;
        document.getElementById('edit-next-steps').value = nextSteps;
        document.getElementById('edit-action-items').value = actionItems;
        document.getElementById('edit-arr').value = arr;
        document.getElementById('edit-cbc').value = cbc;
        document.getElementById('edit-next-step-date').value = nextStepDate;
        document.getElementById('edit-risks').value = risks;

        document.getElementById('editWorkModal').style.display = 'flex';
    } catch(e) {
        showSnack("Error populating edit form.");
    }
}

async function submitEditWorkEntry(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const id = formData.get('id');
    const data = {
        opportunity_name: formData.get('opportunity_name'),
        next_steps: formData.get('next_steps'),
        action_items: formData.get('action_items'),
        arr: formData.get('arr'),
        cbc: formData.get('cbc'),
        next_step_date: formData.get('next_step_date'),
        risks: formData.get('risks')
    };

    try {
        const response = await fetch(`/work/edit/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update work entry');
        }

        document.getElementById('editWorkModal').style.display = 'none';
        showSnack('Work entry updated successfully!');
        fetchWorkEntries();

    } catch (error) {
        console.error('Error updating work entry:', error);
        showSnack(error.message);
    }
}

async function submitAddWorkEntry(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch('/work/add', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add work entry');
        }

        document.getElementById('addWorkModal').style.display = 'none';
        form.reset();
        showSnack('Work entry added successfully!');
        fetchWorkEntries();

    } catch (error) {
        console.error('Error adding work entry:', error);
        showSnack(error.message);
    }
}

async function updateColumnTitle(oldTitle, newTitle, element) {
    try {
        // Show loading state
        element.classList.add('saving');
        
        const response = await fetch('/work/update_column_title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_title: oldTitle, new_title: newTitle })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update column title');
        }

        // Remove loading state
        element.classList.remove('saving');
        
        showSnack('Column title updated successfully!');
        
        // Refresh the entire board to ensure consistency
        await fetchWorkEntries();
        
    } catch (error) {
        console.error('Error updating column title:', error);
        showSnack(error.message, 'error');
        
        // Revert on failure
        element.textContent = oldTitle;
        element.classList.remove('saving');
    }
}

window.editWorkEntry = editWorkEntry;

// --- ARR Dashboard ---
window.renderWorkDashboard = async function() {
    const dashboardDiv = document.getElementById('work-dashboard');
    if (!dashboardDiv) return;
    dashboardDiv.innerHTML = '<div class="loading">Loading ARR by quarter...</div>';
    try {
        const response = await fetch('/work/api/arr_by_quarter');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        const arrs = data.arr_by_quarter;
        if (!arrs.length) {
            dashboardDiv.innerHTML = '<div>No ARR data available.</div>';
            return;
        }
        // Group by year
        const grouped = {};
        arrs.forEach(row => {
            if (!grouped[row.year]) grouped[row.year] = [];
            grouped[row.year].push(row);
        });
        let html = '';
        for (const year of Object.keys(grouped).sort()) {
            html += `<h3>Year: ${year}</h3><table class="arr-table"><tr><th>Quarter</th><th>Total ARR</th></tr>`;
            grouped[year].forEach(q => {
                html += `<tr><td>Q${q.quarter}</td><td>$${q.total_arr.toLocaleString(undefined, {maximumFractionDigits:0})}</td></tr>`;
            });
            html += '</table>';
        }
        dashboardDiv.innerHTML = html;
    } catch (e) {
        dashboardDiv.innerHTML = `<div class='error'>${e.message}</div>`;
    }
}
