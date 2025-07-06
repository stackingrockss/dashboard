// Functions are now available globally from utility files

document.addEventListener('DOMContentLoaded', () => {
    const tradeModal = document.getElementById('tradeModal');
    const pnlModal = document.getElementById('pnlModal');
    const weeklyReviewModal = document.getElementById('editWeeklyReviewModal');
    const closeButtons = document.querySelectorAll('.close');

    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            tradeModal.style.display = 'none';
            pnlModal.style.display = 'none';
            weeklyReviewModal.style.display = 'none';
        });
    });

    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const id = button.getAttribute('data-id');
            const type = button.getAttribute('data-type');
            let modal;

            if (type === 'trade') {
                modal = tradeModal;
                const trades = await loadTrades();
                const trade = trades.find(t => t.id === parseInt(id));
                if (trade) {
                    document.getElementById('editTradeId').value = trade.id;
                    document.getElementById('editTradeDate').value = trade.date.split('T')[0];
                    document.getElementById('editTradeAsset').value = trade.asset;
                    document.getElementById('editTradeType').value = trade.trade_type;
                    document.getElementById('editTradeQuantity').value = trade.quantity;
                    document.getElementById('editTradePrice').value = trade.price;
                    document.getElementById('editTradeTotalCost').value = trade.total_cost;
                    document.getElementById('editTradeFees').value = trade.fees || '';
                    document.getElementById('editTradeNotes').value = trade.notes || '';
                }
            } else if (type === 'pnl') {
                modal = pnlModal;
                const pnls = await loadPnL();
                const pnl = pnls.find(p => p.id === parseInt(id));
                if (pnl) {
                    document.getElementById('editPnLId').value = pnl.id;
                    document.getElementById('editPnLDate').value = pnl.date.split('T')[0];
                    document.getElementById('editPnLStartingBalance').value = pnl.starting_balance;
                    document.getElementById('editPnLCurrentBalance').value = pnl.current_balance;
                }
            } else if (type === 'weekly_review') {
                modal = weeklyReviewModal;
                const response = await fetch(`/api/weekly_reviews?id=${id}`);
                const reviews = await response.json();
                const review = reviews[0];
                if (review) {
                    document.getElementById('editWeeklyReviewId').value = review.id;
                    document.getElementById('editWeeklyReviewYear').value = review.year;
                    document.getElementById('editWeeklyReviewWeek').value = review.week;
                    document.getElementById('editWeeklyReviewWhatWorked').value = review.what_worked || '';
                    document.getElementById('editWeeklyReviewWhatDidnt').value = review.what_didnt || '';
                }
            }

            modal.style.display = 'flex';
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const id = button.getAttribute('data-id');
            const type = button.getAttribute('data-type');
            if (confirm(`Are you sure you want to delete this ${type}?`)) {
                let success;
                if (type === 'pnl') {
                    success = await deletePnL(id);
                } else if (type === 'weekly_review') {
                    success = await deleteWeeklyReview(id);
                } else {
                    success = await deleteTrade(id);
                }
                if (success) location.reload();
            }
        });
    });

    document.getElementById('editTradeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = formData.get('id');
        if (await editTrade(id, formData)) {
            tradeModal.style.display = 'none';
            location.reload();
        }
    }, { once: true });

    document.getElementById('editPnLForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = formData.get('id');
        if (await editPnL(id, formData)) {
            pnlModal.style.display = 'none';
            location.reload();
        }
    }, { once: true });

    document.getElementById('editWeeklyReviewForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = formData.get('id');
        if (await editWeeklyReview(id, formData)) {
            weeklyReviewModal.style.display = 'none';
            location.reload();
        }
    }, { once: true });

    async function deletePnL(id) {
        const response = await fetch(`/api/pnl/${id}`, {
            method: 'DELETE'
        });
        return response.ok;
    }

    async function editPnL(id, formData) {
        const response = await fetch(`/edit_pnl/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(formData))
        });
        return response.ok;
    }

    async function deleteWeeklyReview(id) {
        const response = await fetch(`/api/weekly_reviews/${id}`, {
            method: 'DELETE'
        });
        return response.ok;
    }

    async function editWeeklyReview(id, formData) {
        const response = await fetch(`/edit_weekly_review/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(formData))
        });
        return response.ok;
    }
});