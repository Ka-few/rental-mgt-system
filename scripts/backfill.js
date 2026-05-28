const { db, initializeDatabase } = require('../server/db/init');
const { recordJournalEntry, getAccountByName } = require('../server/controllers/accounting');

const runBackfill = async () => {
    await initializeDatabase();
    console.log('Starting historical data backfill into Journal...');

    const arAcc = getAccountByName('Accounts Receivable');
    const cashAcc = getAccountByName('Cash');
    const revAcc = getAccountByName('Rental Income');
    const lateAcc = getAccountByName('Late Fees');

    // Get all transactions
    const txns = db.prepare('SELECT * FROM transactions').all();
    let txnSyncCount = 0;

    for (const txn of txns) {
        // Skip if already in journal
        const exists = db.prepare('SELECT id FROM journal_entries WHERE reference_id = ?').get(txn.id);
        if (exists) continue;

        try {
            if (txn.type === 'Payment') {
                if (cashAcc && arAcc) {
                    recordJournalEntry(txn.date || new Date().toISOString(), 'Tenant Payment: ' + txn.description, txn.id, [
                        { account_id: cashAcc.id, type: 'debit', amount: Number(txn.amount) },
                        { account_id: arAcc.id, type: 'credit', amount: Number(txn.amount) }
                    ]);
                    txnSyncCount++;
                }
            } else if (txn.type === 'Rent Charge' || txn.type === 'Water Bill' || txn.type === 'Garbage' || txn.type === 'Security') {
                if (arAcc && revAcc) {
                    recordJournalEntry(txn.date || new Date().toISOString(), txn.type + ': ' + txn.description, txn.id, [
                        { account_id: arAcc.id, type: 'debit', amount: Number(txn.amount) },
                        { account_id: revAcc.id, type: 'credit', amount: Number(txn.amount) }
                    ]);
                    txnSyncCount++;
                }
            } else if (txn.type === 'Adjustment') {
                if (arAcc && lateAcc) {
                    recordJournalEntry(txn.date || new Date().toISOString(), txn.type + ': ' + txn.description, txn.id, [
                        { account_id: arAcc.id, type: 'debit', amount: Number(txn.amount) },
                        { account_id: lateAcc.id, type: 'credit', amount: Number(txn.amount) }
                    ]);
                    txnSyncCount++;
                }
            }
        } catch (e) {
            console.error('Failed to sync txn', txn.id, e);
        }
    }

    console.log(`Synced ${txnSyncCount} past transactions to the Journal.`);

    // Expenses
    const exps = db.prepare('SELECT * FROM expenses').all();
    let expSyncCount = 0;

    for (const exp of exps) {
        const exists = db.prepare('SELECT id FROM journal_entries WHERE reference_id = ?').get(exp.id);
        if (exists) continue;

        try {
            const expAccMatch = exp.category + ' Expense';
            const expAcc = getAccountByName(expAccMatch) || getAccountByName('Other Expense') || getAccountByName('Maintenance Expense');
            const expCashAcc = getAccountByName(exp.payment_method === 'Bank' ? 'Bank' : 'Cash');

            if (expAcc && expCashAcc) {
                recordJournalEntry(exp.date || new Date().toISOString(), `Expense: ${exp.category} - ${exp.description}`, exp.id, [
                    { account_id: expAcc.id, type: 'debit', amount: Number(exp.amount) },
                    { account_id: expCashAcc.id, type: 'credit', amount: Number(exp.amount) }
                ]);
                expSyncCount++;
            }
        } catch (e) {
            console.error('Failed to sync exp', exp.id, e);
        }
    }

    console.log(`Synced ${expSyncCount} past expenses to the Journal.`);
    console.log('Backfill complete!');
};

runBackfill();
