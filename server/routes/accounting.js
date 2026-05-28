const express = require('express');
const router = express.Router();
const accCtrl = require('../controllers/accounting');

router.get('/accounts', accCtrl.getChartOfAccounts);
router.get('/pl', accCtrl.getProfitAndLoss);
router.get('/balance-sheet', accCtrl.getBalanceSheet);
router.get('/journal', accCtrl.getJournalEntries);

module.exports = router;
